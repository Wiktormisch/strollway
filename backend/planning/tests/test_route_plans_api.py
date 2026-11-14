import httpx
import pytest
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from planning import fixtures
from planning.tests.conftest import OTHER_END, OTHER_START, PAIR_3_END, PAIR_3_START, load
from planning.views import RoutePlanView
from walks.models import FamilyProfile

URL = "/api/route-plans/"
CLIENT_A = "11111111-1111-4111-8111-111111111111"
PAIR_2 = ((54.3561, 18.6437), (54.3580, 18.6405))
ERROR_2009 = load("ors_pair2_avoid_2009.json")


@pytest.fixture
def api():
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID=CLIENT_A)
    return client


def payload(start=PAIR_3_START, end=PAIR_3_END, **extra):
    return {
        "start": {"lat": start[0], "lng": start[1]},
        "end": {"lat": end[0], "lng": end[1]},
        **extra,
    }


def post(api, data):
    return api.post(URL, data, format="json")


# --- Live ORS --------------------------------------------------------------------------


@pytest.mark.django_db
def test_live_route_matches_contract(api, ors):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    response = post(api, payload())

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "source", "step_free_available", "route", "baseline", "detour_m", "extra_min",
        "pois_status", "pois", "transit_stops",
    }  # fmt: skip
    assert body["source"] == "ors"
    assert body["step_free_available"] is True
    assert (body["baseline"]["distance_m"], body["route"]["distance_m"]) == (827, 833)
    assert (body["detour_m"], body["extra_min"]) == (6, 0)
    assert body["baseline"]["stairs_m"] == 12.6
    assert body["route"]["stairs_m"] == 0
    # Stroller pace, 4 km/h: 833 m -> 12.5 min.
    assert body["route"]["duration_min"] == 12
    assert body["route"]["geometry"][0][0] == pytest.approx(54.41, abs=0.01)  # [lat, lng]
    assert body["baseline"]["stairs_segments"]
    assert (body["pois_status"], body["pois"], body["transit_stops"]) == ("ok", [], [])


@pytest.mark.django_db
def test_no_step_free_route_is_200(api, ors):
    ors.add(body=load("ors_pair2_normal.json")).add(status=404, body=ERROR_2009)

    response = post(api, payload(*PAIR_2))

    assert response.status_code == 200
    body = response.json()
    assert body["step_free_available"] is False
    assert body["route"] == body["baseline"]
    assert body["detour_m"] is None
    assert body["route"]["stairs_m"] == 39.9


@pytest.mark.django_db
def test_2009_on_normal_request_is_422(api, ors):
    ors.add(status=404, body=ERROR_2009)
    response = post(api, payload(OTHER_START, OTHER_END))
    assert response.status_code == 422
    assert response.json()["code"] == "no_route"


@pytest.mark.django_db
def test_2010_is_422(api, ors):
    ors.add(status=404, body={"error": {"code": 2010, "message": "x"}})
    response = post(api, payload(OTHER_START, OTHER_END))
    assert response.status_code == 422
    assert response.json()["code"] == "no_routable_point"


@pytest.mark.django_db
def test_avoid_stairs_false(api, ors):
    ors.add(body=load("ors_pair3_normal.json"))
    body = post(api, payload(avoid_stairs=False)).json()
    assert body["step_free_available"] is None
    assert body["route"] == body["baseline"]
    assert len(ors.requests) == 1


@pytest.mark.django_db
def test_profile_pace_changes_duration(api, ors):
    profile = FamilyProfile.objects.create(
        client_id=CLIENT_A, name="Slow", children_ages=[2], wheels="none", pace="relaxed"
    )
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    body = post(api, payload(profile_id=profile.id)).json()

    assert body["route"]["duration_min"] == round(833 / (3500 / 60))


# --- Fallbacks -------------------------------------------------------------------------


@pytest.mark.django_db
def test_no_key_demo_pair_uses_fixture(api):
    body = post(api, payload()).json()
    assert body["source"] == "fixture"
    assert body["step_free_available"] is True
    assert body["detour_m"] == 6


@pytest.mark.django_db
def test_no_key_demo_pair_2_fixture_has_no_step_free_route(api):
    response = post(api, payload(*PAIR_2))
    assert response.status_code == 200
    assert response.json()["step_free_available"] is False


@pytest.mark.django_db
def test_no_key_other_points_use_mock(api):
    body = post(api, payload(OTHER_START, OTHER_END)).json()
    assert body["source"] == "mock"
    assert body["route"]["geometry"][0] == list(OTHER_START)
    assert body["route"]["stairs_m"] is None
    assert body["step_free_available"] is None
    assert body["detour_m"] is None


@pytest.mark.django_db
def test_demo_pair_matches_within_100_m(api):
    near_start = (PAIR_3_START[0] + 0.0005, PAIR_3_START[1])  # about 55 m north
    assert post(api, payload(near_start, PAIR_3_END)).json()["source"] == "fixture"


@pytest.mark.django_db
def test_mock_provider_ignores_key(api, ors, settings):
    settings.ROUTING_PROVIDER = "mock"
    assert post(api, payload()).json()["source"] == "fixture"
    assert ors.requests == []


@pytest.mark.django_db
@pytest.mark.parametrize(
    "failure",
    [
        {"error": httpx.ReadTimeout("slow")},
        {"status": 429, "body": {"error": "Rate limit"}},
        {"status": 503, "body": {}},
    ],
)
def test_ors_failure_falls_back(api, ors, failure):
    ors.add(**failure).add(**failure)
    assert post(api, payload()).json()["source"] == "fixture"
    assert post(api, payload(OTHER_START, OTHER_END)).json()["source"] == "mock"


@pytest.mark.django_db
def test_overpass_failure_still_returns_route(api, ors, overpass):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))
    overpass.add(status=504, body={})

    response = post(api, payload())

    assert response.status_code == 200
    assert response.json()["pois_status"] == "unavailable"
    assert response.json()["pois"] == []


@pytest.mark.django_db
def _with_recorded_cafe(monkeypatch):
    fixture = fixtures.load_fixture(fixtures.DEMO_PAIRS[2])
    cafe = {"type": "node", "id": 7, "lat": 54.41, "lon": 18.57, "tags": {"amenity": "cafe"}}
    fixture["overpass"] = {"elements": [cafe]}
    monkeypatch.setattr(fixtures, "load_fixture", lambda pair: fixture)


@pytest.mark.django_db
def test_demo_pair_uses_recorded_places_without_overpass(api, overpass, monkeypatch):
    _with_recorded_cafe(monkeypatch)

    body = post(api, payload()).json()

    assert body["source"] == "fixture"
    assert body["pois_status"] == "ok"
    assert [p["poi_id"] for p in body["pois"]] == ["node/7"]
    assert overpass.requests == []  # the demo answers at once


@pytest.mark.django_db
def test_demo_pair_with_a_live_route_still_uses_recorded_places(api, ors, overpass, monkeypatch):
    _with_recorded_cafe(monkeypatch)
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    body = post(api, payload()).json()

    assert body["source"] == "ors"
    assert [p["poi_id"] for p in body["pois"]] == ["node/7"]
    assert overpass.requests == []


@pytest.mark.django_db
def test_mock_route_never_invents_places(api):
    body = post(api, payload(OTHER_START, OTHER_END)).json()
    assert body["pois"] == []
    assert body["transit_stops"] == []


# --- Validation and throttling ---------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "data",
    [
        {},
        {"start": {"lat": 54.4, "lng": 18.5}},
        payload((91, 18.5)),
        payload((54.4, 181)),
        payload(start=("a", 18.5)),
        payload((54.0, 18.0), (54.5, 18.0)),  # 55 km apart
        payload(avoid_stairs="maybe"),
    ],
)
def test_invalid_input_is_400(api, data):
    assert post(api, data).status_code == 400


@pytest.mark.django_db
def test_foreign_profile_is_400(api):
    other = FamilyProfile.objects.create(client_id="demo", name="Other", children_ages=[3])
    response = post(api, payload(profile_id=other.id))
    assert response.status_code == 400
    assert "profile_id" in response.json()


@pytest.mark.django_db
def test_bad_client_id_is_400():
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID="not-a-uuid")
    assert post(client, payload()).status_code == 400


@pytest.mark.django_db
def test_throttle_limits_requests(api, monkeypatch):
    monkeypatch.setattr(RoutePlanView, "throttle_classes", [ScopedRateThrottle])
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"route_plans": "1/hour"})

    assert post(api, payload()).status_code == 200
    assert post(api, payload()).status_code == 429


def test_get_is_not_allowed(api):
    assert api.get(URL).status_code == 405

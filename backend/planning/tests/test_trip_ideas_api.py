import pytest
from django.urls import reverse

from planning import pois
from planning.tests.factories import START, candidate
from walks.models import FamilyProfile

URL = reverse("trip-ideas")
CLIENT_A = "11111111-1111-4111-8111-111111111111"
CLIENT_B = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def mock_engines(settings, monkeypatch):
    settings.ROUTING_PROVIDER = "mock"
    settings.POI_PROVIDER = "overpass"
    settings.LLM_BACKEND = "mock"
    found = pois.PoiResult(
        [candidate("node/1", "playground", 40, 0), candidate("node/2", "cafe", 0, 60)],
        [],
        pois.STATUS_OK,
    )
    monkeypatch.setattr(pois, "find_candidates", lambda start, radius: found)


def post(client, body, client_id=CLIENT_A):
    return client.post(URL, body, content_type="application/json", HTTP_X_CLIENT_ID=client_id)


def body(**extra):
    return {"start": {"lat": START[0], "lng": START[1]}, "max_minutes": 60, **extra}


def test_mock_mode_returns_a_rule_based_trip(client, mock_engines):
    response = post(client, body(wishes="playground", language="en"))

    assert response.status_code == 200
    data = response.json()
    assert data["engine"] == "rules"
    assert data["stops"][0]["poi_id"] == "node/1"
    assert data["over_limit"] is False


@pytest.mark.parametrize(
    ("extra", "field"),
    [
        ({"max_minutes": 10}, "max_minutes"),
        ({"max_minutes": 181}, "max_minutes"),
        ({"wishes": "x" * 201}, "wishes"),
        ({"language": "de"}, "language"),
        ({"start": {"lat": 91, "lng": 0}}, "start"),
    ],
)
def test_validation_errors(client, mock_engines, extra, field):
    response = post(client, {**body(), **extra})

    assert response.status_code == 400
    assert field in response.json()


def test_a_client_candidate_list_is_ignored(client, mock_engines):
    fake = [{"poi_id": "node/666", "name": "Injected", "category": "cafe"}]

    response = post(client, body(candidates=fake))

    assert response.status_code == 200
    assert "node/666" not in [s["poi_id"] for s in response.json()["stops"]]


@pytest.mark.django_db
def test_foreign_profile_is_a_validation_error(client, mock_engines):
    profile = FamilyProfile.objects.create(client_id=CLIENT_B, name="B", children_ages=[3])

    response = post(client, body(profile_id=profile.pk))

    assert response.status_code == 400
    assert "profile_id" in response.json()


@pytest.mark.django_db
def test_own_profile_ages_are_used(client, mock_engines):
    profile = FamilyProfile.objects.create(client_id=CLIENT_A, name="A", children_ages=[4])

    response = post(client, body(profile_id=profile.pk))

    assert [s["poi_id"] for s in response.json()["stops"]] == ["node/1", "node/2"]


def test_no_places_is_422(client, settings, monkeypatch):
    settings.POI_PROVIDER = "overpass"
    monkeypatch.setattr(
        pois, "find_candidates", lambda s, r: pois.PoiResult([], [], pois.STATUS_OK)
    )

    response = post(client, body())

    assert response.status_code == 422
    assert response.json()["code"] == "no_places_nearby"


def test_overpass_down_is_422_places_unavailable(client, settings, monkeypatch):
    settings.POI_PROVIDER = "overpass"
    monkeypatch.setattr(
        pois, "find_candidates", lambda s, r: pois.PoiResult([], [], pois.STATUS_UNAVAILABLE)
    )

    response = post(client, body())

    assert response.status_code == 422
    assert response.json()["code"] == "places_unavailable"


def test_trip_ideas_has_its_own_throttle_scope():
    from planning.views import TripIdeaView

    assert TripIdeaView.throttle_scope == "trip_ideas"


def test_throttle_rate_is_20_per_hour(settings):
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["trip_ideas"] == "20/hour"

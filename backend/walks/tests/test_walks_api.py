import pytest

from walks.models import Stop, Walk
from walks.tests.conftest import CLIENT_B, make_profile, make_stop, make_walk, walk_payload

pytestmark = pytest.mark.django_db

URL = "/api/walks/"


def test_list_is_light_with_stops_count(api):
    walk = make_walk()
    make_stop(walk, order=1)
    make_stop(walk, order=2)

    response = api.get(URL)

    assert response.status_code == 200
    item = response.json()[0]
    assert item["stops_count"] == 2
    assert "geometry" not in item
    assert "stops" not in item
    assert item["kcal"] > 0


def test_kcal_uses_the_profile_pace_and_wheels(api):
    # 4 km at 4 km/h is 1 h: 3.0 MET x 70 kg = 210 kcal; no stroller, so no +5%.
    profile = make_profile(wheels="none", pace_kmh=4.0)
    walk = make_walk(profile=profile, distance_m=4000)
    assert api.get(f"{URL}{walk.id}/").json()["kcal"] == 210
    # Without a profile the app assumes a stroller at 4 km/h: +5%.
    walk = make_walk(distance_m=4000)
    assert api.get(f"{URL}{walk.id}/").json()["kcal"] == round(210 * 1.05)


def test_create(api):
    response = api.post(URL, walk_payload(), format="json")

    assert response.status_code == 201
    walk = Walk.objects.get()
    assert (walk.status, walk.rating) == ("planned", None)


def test_create_with_nested_stops(api):
    stops = [
        {"order": 1, "name": "", "category": "bench", "lat": 54.351, "lng": 18.601},
        {"order": 2, "name": "Cafe", "category": "cafe", "lat": 54.352, "lng": 18.602},
    ]

    response = api.post(URL, walk_payload(stops=stops), format="json")

    assert response.status_code == 201
    assert [s["name"] for s in response.json()["stops"]] == ["", "Cafe"]
    assert Stop.objects.count() == 2


def test_create_with_invalid_nested_stop_saves_nothing(api):
    stops = [{"order": 1, "category": "bench", "lat": 91, "lng": 18.6}]

    response = api.post(URL, walk_payload(stops=stops), format="json")

    assert response.status_code == 400
    assert not Walk.objects.exists()


def test_nested_stops_need_different_orders(api):
    stop = {"order": 1, "category": "bench", "lat": 54.35, "lng": 18.6}

    response = api.post(URL, walk_payload(stops=[stop, stop]), format="json")

    assert response.status_code == 400
    assert "stops" in response.json()


def test_too_many_nested_stops(api):
    stops = [{"order": i, "category": "bench", "lat": 54.35, "lng": 18.6} for i in range(21)]

    assert api.post(URL, walk_payload(stops=stops), format="json").status_code == 400


def test_retrieve_has_geometry_and_stops(api):
    walk = make_walk()
    make_stop(walk, order=2, name="Second")
    make_stop(walk, order=1, name="First")

    data = api.get(f"{URL}{walk.pk}/").json()

    assert data["geometry"] == [[54.35, 18.6], [54.36, 18.61]]
    assert [s["name"] for s in data["stops"]] == ["First", "Second"]


def test_update(api):
    walk = make_walk()

    response = api.put(f"{URL}{walk.pk}/", walk_payload(name="Renamed"), format="json")

    assert response.status_code == 200
    walk.refresh_from_db()
    assert walk.name == "Renamed"


def test_update_ignores_stops(api):
    walk = make_walk()
    make_stop(walk)
    # Invalid on purpose: on update stops are ignored, so they are not validated.
    new_stops = [{"order": 5, "category": "cafe", "lat": 99, "lng": 18.6}]

    response = api.patch(f"{URL}{walk.pk}/", {"stops": new_stops}, format="json")

    assert response.status_code == 200
    assert list(walk.stops.values_list("order", flat=True)) == [1]


def test_partial_update(api):
    walk = make_walk()

    response = api.patch(f"{URL}{walk.pk}/", {"notes": "Nice"}, format="json")

    assert response.status_code == 200
    walk.refresh_from_db()
    assert (walk.notes, walk.name) == ("Nice", "Test walk")


def test_delete_removes_stops(api):
    walk = make_walk()
    make_stop(walk)

    assert api.delete(f"{URL}{walk.pk}/").status_code == 204
    assert not Stop.objects.exists()


@pytest.mark.parametrize(
    "field, value",
    [
        ("start_lat", 90.1),
        ("start_lat", -90.1),
        ("end_lat", 100),
        ("start_lng", 180.1),
        ("end_lng", -180.1),
    ],
)
def test_coordinates_out_of_range(api, field, value):
    response = api.post(URL, walk_payload(**{field: value}), format="json")

    assert response.status_code == 400
    assert field in response.json()


@pytest.mark.parametrize(
    "geometry",
    [[], [[54.35, 18.6]], [[54.35], [1, 2]], [[91, 18.6], [54.36, 18.61]], [["a", 1], [1, 2]], "x"],
)
def test_invalid_geometry(api, geometry):
    response = api.post(URL, walk_payload(geometry=geometry), format="json")

    assert response.status_code == 400
    assert "geometry" in response.json()


def test_rating_with_done(api):
    response = api.post(URL, walk_payload(status="done", rating=5), format="json")

    assert response.status_code == 201
    assert response.json()["rating"] == 5


def test_rating_without_done_is_rejected(api):
    response = api.post(URL, walk_payload(rating=4), format="json")

    assert response.status_code == 400
    assert "rating" in response.json()


@pytest.mark.parametrize("rating", [0, 6])
def test_rating_out_of_range(api, rating):
    response = api.post(URL, walk_payload(status="done", rating=rating), format="json")

    assert response.status_code == 400
    assert "rating" in response.json()


def test_patch_rating_uses_saved_status(api):
    done = make_walk(status="done")
    planned = make_walk(name="Planned")

    assert api.patch(f"{URL}{done.pk}/", {"rating": 3}, format="json").status_code == 200
    assert api.patch(f"{URL}{planned.pk}/", {"rating": 3}, format="json").status_code == 400


def test_back_to_planned_clears_rating(api):
    walk = make_walk(status="done", rating=5)

    response = api.patch(f"{URL}{walk.pk}/", {"status": "planned"}, format="json")

    assert response.status_code == 200
    walk.refresh_from_db()
    assert walk.rating is None


def test_notes_limit(api):
    assert api.post(URL, walk_payload(notes="x" * 1000), format="json").status_code == 201

    response = api.post(URL, walk_payload(notes="x" * 1001), format="json")

    assert response.status_code == 400
    assert "notes" in response.json()


def test_ai_summary_limit(api):
    response = api.post(URL, walk_payload(ai_summary="x" * 2001), format="json")

    assert response.status_code == 400
    assert "ai_summary" in response.json()


def test_own_profile_is_allowed(api):
    profile = make_profile()

    response = api.post(URL, walk_payload(profile=profile.pk), format="json")

    assert response.status_code == 201


def test_foreign_profile_is_rejected(api):
    profile = make_profile(client_id=CLIENT_B)

    response = api.post(URL, walk_payload(profile=profile.pk), format="json")

    assert response.status_code == 400
    assert "profile" in response.json()


def test_status_filter(api):
    make_walk(name="P")
    make_walk(name="D", status="done")

    assert [w["name"] for w in api.get(f"{URL}?status=done").json()] == ["D"]
    assert [w["name"] for w in api.get(f"{URL}?status=planned").json()] == ["P"]


def test_invalid_status_filter(api):
    assert api.get(f"{URL}?status=don").status_code == 400

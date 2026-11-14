import pytest

from walks.models import Stop
from walks.serializers import MAX_NESTED_STOPS
from walks.tests.conftest import CLIENT_B, make_stop, make_walk

pytestmark = pytest.mark.django_db

URL = "/api/stops/"


def stop_payload(walk, **kwargs):
    data = {"walk": walk.pk, "order": 1, "category": "playground", "lat": 54.35, "lng": 18.6}
    return data | kwargs


def test_list(api):
    make_stop(make_walk())
    make_stop(make_walk(client_id=CLIENT_B))

    response = api.get(URL)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_create(api):
    walk = make_walk()

    response = api.post(URL, stop_payload(walk), format="json")

    assert response.status_code == 201
    stop = Stop.objects.get()
    assert (stop.walk, stop.planned_minutes, stop.source) == (walk, 10, "user")


def test_empty_name_is_allowed(api):
    response = api.post(URL, stop_payload(make_walk(), name=""), format="json")

    assert response.status_code == 201


@pytest.mark.parametrize("category", ["park", "zoo", "museum", "beach"])
def test_trip_categories_are_allowed(api, category):
    response = api.post(URL, stop_payload(make_walk(), category=category), format="json")

    assert response.status_code == 201


def test_unknown_category_is_rejected(api):
    response = api.post(URL, stop_payload(make_walk(), category="indoor_play"), format="json")

    assert response.status_code == 400
    assert "category" in response.json()


def test_retrieve(api):
    stop = make_stop(make_walk(), name="Bench")

    response = api.get(f"{URL}{stop.pk}/")

    assert response.status_code == 200
    assert response.json()["name"] == "Bench"


def test_update(api):
    walk = make_walk()
    stop = make_stop(walk)

    response = api.put(f"{URL}{stop.pk}/", stop_payload(walk, order=3), format="json")

    assert response.status_code == 200
    stop.refresh_from_db()
    assert stop.order == 3


def test_partial_update(api):
    stop = make_stop(make_walk())

    response = api.patch(f"{URL}{stop.pk}/", {"planned_minutes": 45}, format="json")

    assert response.status_code == 200
    stop.refresh_from_db()
    assert stop.planned_minutes == 45


def test_delete(api):
    stop = make_stop(make_walk())

    assert api.delete(f"{URL}{stop.pk}/").status_code == 204
    assert not Stop.objects.exists()


@pytest.mark.parametrize("minutes", [0, 121])
def test_planned_minutes_out_of_range(api, minutes):
    response = api.post(URL, stop_payload(make_walk(), planned_minutes=minutes), format="json")

    assert response.status_code == 400
    assert "planned_minutes" in response.json()


@pytest.mark.parametrize("minutes", [1, 120])
def test_planned_minutes_limits_are_allowed(api, minutes):
    response = api.post(URL, stop_payload(make_walk(), planned_minutes=minutes), format="json")

    assert response.status_code == 201


@pytest.mark.parametrize("field, value", [("lat", 90.5), ("lng", -181)])
def test_coordinates_out_of_range(api, field, value):
    response = api.post(URL, stop_payload(make_walk(), **{field: value}), format="json")

    assert response.status_code == 400
    assert field in response.json()


def test_foreign_walk_is_rejected(api):
    response = api.post(URL, stop_payload(make_walk(client_id=CLIENT_B)), format="json")

    assert response.status_code == 400
    assert "walk" in response.json()
    assert not Stop.objects.exists()


def test_stop_cannot_move_to_another_walk(api):
    stop = make_stop(make_walk())
    other = make_walk(name="Other")

    response = api.patch(f"{URL}{stop.pk}/", {"walk": other.pk}, format="json")

    assert response.status_code == 400
    stop.refresh_from_db()
    assert stop.walk_id != other.pk


def test_walk_filter(api):
    first = make_walk()
    second = make_walk(name="Second")
    make_stop(first, name="A")
    make_stop(second, name="B")

    response = api.get(f"{URL}?walk={first.pk}")

    assert [s["name"] for s in response.json()] == ["A"]


def test_walk_filter_with_foreign_walk_is_empty(api):
    foreign = make_walk(client_id=CLIENT_B)
    make_stop(foreign)

    assert api.get(f"{URL}?walk={foreign.pk}").json() == []


def test_invalid_walk_filter(api):
    assert api.get(f"{URL}?walk=abc").status_code == 400


def test_create_rejects_a_used_order(api):
    """Regression (audit W1): /api/stops/ checks order like the nested create."""
    walk = make_walk()
    make_stop(walk, order=1)

    response = api.post(URL, stop_payload(walk, order=1), format="json")

    assert response.status_code == 400
    assert "order" in response.json()
    assert walk.stops.count() == 1


def test_create_rejects_more_than_max_stops(api):
    """Regression (audit W1): at most MAX_NESTED_STOPS stops per walk."""
    walk = make_walk()
    for order in range(1, MAX_NESTED_STOPS + 1):
        make_stop(walk, order=order)

    response = api.post(URL, stop_payload(walk, order=99), format="json")

    assert response.status_code == 400
    assert "walk" in response.json()
    assert walk.stops.count() == MAX_NESTED_STOPS


def test_update_rejects_the_order_of_another_stop(api):
    walk = make_walk()
    make_stop(walk, order=1)
    stop = make_stop(walk, order=2)

    response = api.patch(f"{URL}{stop.pk}/", {"order": 1}, format="json")

    assert response.status_code == 400
    assert "order" in response.json()


def test_update_keeps_its_own_order_on_a_full_walk(api):
    walk = make_walk()
    stops = [make_stop(walk, order=order) for order in range(1, MAX_NESTED_STOPS + 1)]

    response = api.patch(f"{URL}{stops[0].pk}/", {"order": 1, "planned_minutes": 15}, format="json")

    assert response.status_code == 200

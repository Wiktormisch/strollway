import pytest

from walks.models import FamilyProfile
from walks.tests.conftest import make_profile, make_walk

pytestmark = pytest.mark.django_db

URL = "/api/profiles/"


def test_list(api):
    make_profile(name="A")
    make_profile(name="B")

    response = api.get(URL)

    assert response.status_code == 200
    assert {p["name"] for p in response.json()} == {"A", "B"}


def test_create(api):
    payload = {"name": "Family", "children_ages": [0, 17], "wheels": "kid_bike", "pace_kmh": 4.5}

    response = api.post(URL, payload, format="json")

    assert response.status_code == 201
    assert response.json()["children_ages"] == [0, 17]
    assert FamilyProfile.objects.get().wheels == "kid_bike"


def test_retrieve(api):
    profile = make_profile(name="Mine")

    response = api.get(f"{URL}{profile.pk}/")

    assert response.status_code == 200
    assert response.json()["name"] == "Mine"


def test_update(api):
    profile = make_profile()
    payload = {"name": "New", "children_ages": [4, 6], "wheels": "none", "pace_kmh": 4.5}

    response = api.put(f"{URL}{profile.pk}/", payload, format="json")

    assert response.status_code == 200
    profile.refresh_from_db()
    assert (profile.name, profile.children_ages) == ("New", [4, 6])


def test_partial_update(api):
    profile = make_profile(name="Old")

    response = api.patch(f"{URL}{profile.pk}/", {"pace_kmh": 4.5}, format="json")

    assert response.status_code == 200
    profile.refresh_from_db()
    assert (profile.name, profile.pace_kmh) == ("Old", 4.5)


def test_delete(api):
    profile = make_profile()

    assert api.delete(f"{URL}{profile.pk}/").status_code == 204
    assert not FamilyProfile.objects.exists()


def test_delete_keeps_walks_and_clears_their_profile(api):
    profile = make_profile()
    walk = make_walk(profile=profile)

    api.delete(f"{URL}{profile.pk}/")

    walk.refresh_from_db()
    assert walk.profile is None


@pytest.mark.parametrize(
    "ages",
    [[1, 2, 3, 4, 5, 6, 7], [-1], [18], [2.5], ["3"], [True], "3", None],
)
def test_invalid_children_ages(api, ages):
    response = api.post(URL, {"name": "F", "children_ages": ages}, format="json")

    assert response.status_code == 400
    assert "children_ages" in response.json()


@pytest.mark.parametrize("payload", [{"children_ages": []}, {}])
def test_a_profile_without_children_is_allowed(api, payload):
    """Audit idea 5: a profile can be only a pace and a way of moving."""
    response = api.post(URL, {"name": "F", **payload}, format="json")

    assert response.status_code == 201
    assert response.json()["children_ages"] == []


def test_six_children_is_allowed(api):
    response = api.post(URL, {"name": "F", "children_ages": [1, 2, 3, 4, 5, 6]}, format="json")

    assert response.status_code == 201


@pytest.mark.parametrize("pace", [2.0, 6.0, 3.3])
def test_pace_outside_range_or_step_is_rejected(api, pace):
    response = api.post(URL, {"name": "F", "pace_kmh": pace}, format="json")

    assert response.status_code == 400
    assert "pace_kmh" in response.json()


def test_pace_defaults_to_relaxed_value(api):
    response = api.post(URL, {"name": "F"}, format="json")

    assert response.json()["pace_kmh"] == 3.5

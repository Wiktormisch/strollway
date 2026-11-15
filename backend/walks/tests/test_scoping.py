import pytest
from rest_framework.test import APIClient

from walks.models import FamilyProfile, Stop, Walk
from walks.tests.conftest import CLIENT_A, CLIENT_B, make_profile, make_stop, make_walk

pytestmark = pytest.mark.django_db


def bad_header_client():
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID="not-a-uuid")
    return client


def test_missing_header_uses_demo_client():
    make_profile(client_id="demo", name="Demo")
    make_profile(client_id=CLIENT_A, name="Other")

    response = APIClient().get("/api/profiles/")

    assert response.status_code == 200
    assert [p["name"] for p in response.json()] == ["Demo"]


def test_create_without_header_gives_400():
    """Regression (audit S3): the shared demo client is read-only."""
    response = APIClient().post(
        "/api/profiles/", {"name": "X", "children_ages": [1]}, format="json"
    )

    assert response.status_code == 400
    assert "read-only" in response.json()["X-Client-Id"]
    assert not FamilyProfile.objects.exists()


def test_demo_walk_cannot_be_changed_without_header():
    """Regression (audit S3): POST, PUT, PATCH and DELETE without a header change nothing."""
    walk = make_walk(client_id="demo", name="Demo walk")
    stop = make_stop(walk)
    client = APIClient()

    assert client.patch(f"/api/walks/{walk.pk}/", {"name": "X"}, format="json").status_code == 400
    assert client.put(f"/api/stops/{stop.pk}/", {}, format="json").status_code == 400
    assert client.delete(f"/api/walks/{walk.pk}/").status_code == 400
    assert client.post("/api/demo-data/").status_code == 400
    walk.refresh_from_db()
    assert walk.name == "Demo walk"
    assert Walk.objects.count() == 1


def test_demo_data_can_be_read_without_header():
    walk = make_walk(client_id="demo")

    assert APIClient().get(f"/api/walks/{walk.pk}/").status_code == 200


@pytest.mark.parametrize("url", ["/api/profiles/", "/api/walks/", "/api/stops/"])
def test_invalid_header_gives_400(url):
    response = bad_header_client().get(url)

    assert response.status_code == 400
    assert "X-Client-Id" in response.json()


def test_invalid_header_gives_400_before_404():
    assert bad_header_client().get("/api/walks/999/").status_code == 400


def test_invalid_header_gives_400_on_demo_data():
    assert bad_header_client().post("/api/demo-data/").status_code == 400
    assert not Walk.objects.exists()


def test_upper_case_uuid_is_the_same_client():
    make_profile(client_id=CLIENT_A)
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID=CLIENT_A.upper())

    assert len(client.get("/api/profiles/").json()) == 1


def test_list_shows_only_own_data(api):
    make_walk(client_id=CLIENT_A, name="Mine")
    make_walk(client_id=CLIENT_B, name="Theirs")

    names = [w["name"] for w in api.get("/api/walks/").json()]

    assert names == ["Mine"]


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_foreign_profile_gives_404(api, method):
    profile = make_profile(client_id=CLIENT_B)

    response = getattr(api, method)(f"/api/profiles/{profile.pk}/", {}, format="json")

    assert response.status_code == 404
    assert FamilyProfile.objects.filter(pk=profile.pk).exists()


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_foreign_walk_gives_404(api, method):
    walk = make_walk(client_id=CLIENT_B)

    response = getattr(api, method)(f"/api/walks/{walk.pk}/", {}, format="json")

    assert response.status_code == 404
    assert Walk.objects.filter(pk=walk.pk).exists()


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_foreign_stop_gives_404(api, method):
    stop = make_stop(make_walk(client_id=CLIENT_B))

    response = getattr(api, method)(f"/api/stops/{stop.pk}/", {}, format="json")

    assert response.status_code == 404
    assert Stop.objects.filter(pk=stop.pk).exists()


def test_schema_documents_client_id_header(client):
    schema = client.get("/api/schema/").content.decode()

    assert "X-Client-Id" in schema
    for path in ["/api/profiles/", "/api/walks/{id}/", "/api/stops/", "/api/demo-data/"]:
        assert path in schema

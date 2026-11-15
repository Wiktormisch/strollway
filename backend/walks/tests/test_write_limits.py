"""Limits for writes to the walks API (audit S2)."""

import pytest
from rest_framework.test import APIClient

from walks.models import Walk
from walks.tests.conftest import CLIENT_A, CLIENT_B, make_walk, walk_payload
from walks.throttles import WriteRateThrottle

pytestmark = pytest.mark.django_db


@pytest.fixture
def writes_rate(monkeypatch):
    # DRF reads the rates once at import, so the test sets them on the class.
    monkeypatch.setattr(WriteRateThrottle, "THROTTLE_RATES", {"writes": "3/hour"})


def client_with_id(client_id):
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID=client_id)
    return client


def test_writes_are_limited_per_ip(writes_rate):
    """Regression (audit S2): a new client id does not reset the limit."""
    for client_id in [CLIENT_A, CLIENT_B, CLIENT_A]:
        response = client_with_id(client_id).post("/api/walks/", walk_payload(), format="json")
        assert response.status_code == 201

    response = client_with_id(CLIENT_B).post("/api/profiles/", {"name": "X"}, format="json")

    assert response.status_code == 429


def test_reads_are_not_limited(writes_rate):
    api = client_with_id(CLIENT_A)
    for _ in range(3):
        api.post("/api/walks/", walk_payload(), format="json")

    for _ in range(5):
        assert api.get("/api/walks/").status_code == 200


def test_demo_data_post_counts_as_a_write(writes_rate):
    for client_id in [CLIENT_A, CLIENT_B, "33333333-3333-4333-8333-333333333333"]:
        assert client_with_id(client_id).post("/api/demo-data/").status_code == 201

    response = client_with_id("44444444-4444-4444-8444-444444444444").post("/api/demo-data/")

    assert response.status_code == 429


def test_write_rate_default_is_120_per_hour(settings):
    # The default, not the current value: a developer may change the rate in .env.
    assert settings.WRITES_DEFAULT_RATE == "120/hour"
    assert settings.MAX_WALKS_PER_CLIENT_DEFAULT == 200


def test_walks_per_client_are_limited(api, settings):
    """Regression (audit S2): one client cannot keep an unlimited number of walks."""
    settings.MAX_WALKS_PER_CLIENT = 2
    make_walk()
    make_walk()
    make_walk(client_id=CLIENT_B)

    response = api.post("/api/walks/", walk_payload(), format="json")

    assert response.status_code == 400
    assert "At most 2 walks" in str(response.json())
    assert Walk.objects.filter(client_id=CLIENT_A).count() == 2


def test_walks_limit_does_not_block_edits(api, settings):
    settings.MAX_WALKS_PER_CLIENT = 1
    walk = make_walk()

    response = api.patch(f"/api/walks/{walk.pk}/", {"name": "Renamed"}, format="json")

    assert response.status_code == 200

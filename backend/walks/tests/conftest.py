import pytest
from rest_framework.test import APIClient

from walks.models import FamilyProfile, Stop, Walk

CLIENT_A = "11111111-1111-4111-8111-111111111111"
CLIENT_B = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def api():
    """An API client that acts as CLIENT_A."""
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID=CLIENT_A)
    return client


@pytest.fixture
def api_b():
    """An API client that acts as CLIENT_B."""
    client = APIClient()
    client.credentials(HTTP_X_CLIENT_ID=CLIENT_B)
    return client


def make_profile(client_id=CLIENT_A, **kwargs):
    data = {"name": "Test family", "children_ages": [3]} | kwargs
    return FamilyProfile.objects.create(client_id=client_id, **data)


def make_walk(client_id=CLIENT_A, **kwargs):
    data = walk_payload(name="Test walk") | kwargs
    return Walk.objects.create(client_id=client_id, **data)


def make_stop(walk, **kwargs):
    data = {"order": 1, "category": "bench", "lat": 54.355, "lng": 18.605} | kwargs
    return Stop.objects.create(walk=walk, **data)


def walk_payload(**kwargs):
    return {
        "name": "New walk",
        "start_lat": 54.35,
        "start_lng": 18.6,
        "end_lat": 54.36,
        "end_lng": 18.61,
        "distance_m": 500,
        "duration_min": 8,
        "geometry": [[54.35, 18.6], [54.36, 18.61]],
    } | kwargs

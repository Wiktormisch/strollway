import pytest
from django.core.management import call_command

from walks.demo_data import create_demo_data
from walks.models import FamilyProfile, Stop, Walk
from walks.tests.conftest import CLIENT_A, CLIENT_B

pytestmark = pytest.mark.django_db


def counts(client_id):
    return (
        FamilyProfile.objects.filter(client_id=client_id).count(),
        Walk.objects.filter(client_id=client_id).count(),
        Stop.objects.filter(walk__client_id=client_id).count(),
    )


def test_seed_demo_creates_data_once():
    call_command("seed_demo")
    call_command("seed_demo")

    assert counts("demo") == (1, 2, 3)


def test_demo_walks_use_real_numbers_from_decisions():
    create_demo_data(CLIENT_A)

    pair_1 = Walk.objects.get(name="Kartuska: around the stairs")
    pair_3 = Walk.objects.get(name="Oliwa SKM to Pacholek")
    assert (pair_1.distance_m, pair_1.stairs_avoided_m, pair_1.detour_m) == (420, 16, 288)
    assert (pair_3.distance_m, pair_3.stairs_avoided_m, pair_3.detour_m) == (833, 13, 6)
    assert pair_1.geometry[0] == [pair_1.start_lat, pair_1.start_lng]
    assert pair_1.geometry[-1] == [pair_1.end_lat, pair_1.end_lng]


def test_demo_data_endpoint_is_idempotent(api):
    first = api.post("/api/demo-data/")
    second = api.post("/api/demo-data/")

    assert (first.status_code, second.status_code) == (201, 200)
    assert counts(CLIENT_A) == (1, 2, 3)


def test_demo_data_is_only_for_the_calling_client(api):
    api.post("/api/demo-data/")

    assert counts(CLIENT_B) == (0, 0, 0)
    assert counts("demo") == (0, 0, 0)

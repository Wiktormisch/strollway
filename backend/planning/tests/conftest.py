import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import pytest

from planning import opening_hours, pois, routing
from planning.views import RoutePlanView, TripIdeaView

DATA_DIR = Path(__file__).parent / "data"

# Demo pair 3 in our [lat, lng] order (Oliwa SKM -> Pacholek).
PAIR_3_START = (54.4097, 18.5655)
PAIR_3_END = (54.4115, 18.5745)
# Far from every demo pair (Warsaw).
OTHER_START = (52.2297, 21.0122)
OTHER_END = (52.2310, 21.0150)


def load(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


class FakeHttp:
    """Answers HTTP calls from a queue and records every request."""

    def __init__(self):
        self.responses = []
        self.requests = []

    def add(self, status=200, body=None, error=None):
        self.responses.append(error or httpx.Response(status, json=body))
        return self

    def handler(self, request):
        self.requests.append(request)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def client(self, **kwargs):
        return httpx.Client(transport=httpx.MockTransport(self.handler))

    def json_bodies(self):
        return [json.loads(r.content) for r in self.requests]


# A fixed clock for opening hours: Wednesday 2026-11-11, 10:00 local time.
FIXED_NOW = datetime(2026, 11, 11, 10, 0, tzinfo=ZoneInfo("Europe/Warsaw"))


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch):
    monkeypatch.setattr(opening_hours, "_now", lambda: FIXED_NOW)


@pytest.fixture(autouse=True)
def no_throttling(monkeypatch):
    monkeypatch.setattr(RoutePlanView, "throttle_classes", [])
    monkeypatch.setattr(TripIdeaView, "throttle_classes", [])


@pytest.fixture
def ors(monkeypatch, settings):
    settings.ORS_API_KEY = "test-key"
    fake = FakeHttp()
    monkeypatch.setattr(routing, "make_client", fake.client)
    return fake


@pytest.fixture
def overpass(monkeypatch, settings):
    settings.POI_PROVIDER = "overpass"
    fake = FakeHttp()
    monkeypatch.setattr(pois, "make_client", fake.client)
    return fake

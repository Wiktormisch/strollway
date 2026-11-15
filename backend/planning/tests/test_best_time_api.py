from datetime import datetime

import pytest

from planning import best_time, weather
from planning.tests.test_best_time import FORECAST

URL = "/api/best-walk-time/"
GDANSK = {"lat": 54.3385, "lng": 18.62}


@pytest.fixture
def fixed_now(monkeypatch):
    monkeypatch.setattr(best_time, "local_now", lambda offset: datetime(2026, 11, 11, 10, 0))


def test_returns_the_best_windows(client, monkeypatch, fixed_now):
    monkeypatch.setattr(weather, "hourly_forecast", lambda point: FORECAST)

    response = client.get(URL, GDANSK)

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert [w["start"] for w in body["windows"]] == ["12:00", "11:00", "15:00"]


def test_no_forecast_is_not_an_error(client, monkeypatch):
    monkeypatch.setattr(weather, "hourly_forecast", lambda point: None)

    response = client.get(URL, GDANSK)

    assert response.status_code == 200
    assert response.json() == {"available": False, "windows": []}


def test_upstream_429_gives_no_forecast_not_500(client, settings, monkeypatch):
    from planning.tests.conftest import FakeHttp

    settings.WEATHER_PROVIDER = "auto"
    fake = FakeHttp().add(status=429, body={})
    monkeypatch.setattr(weather, "make_client", fake.client)

    response = client.get(URL, GDANSK)

    assert response.status_code == 200
    assert response.json()["available"] is False


def test_mock_provider_gives_windows_without_network(client, settings):
    settings.WEATHER_PROVIDER = "mock"

    body = client.get(URL, GDANSK).json()

    assert body["available"] is True


@pytest.mark.parametrize(
    "params", [{}, {"lat": 54.3}, {"lat": 91, "lng": 18.6}, {"lat": "x", "lng": 18.6}]
)
def test_rejects_bad_coordinates(client, params):
    assert client.get(URL, params).status_code == 400


def test_has_its_own_throttle_scope(settings):
    from planning.views import BestTimeView

    assert BestTimeView.throttle_scope == "best_time"
    assert settings.BEST_TIME_DEFAULT_RATE == "120/hour"


def test_is_throttled(client, monkeypatch):
    from rest_framework.throttling import ScopedRateThrottle

    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"best_time": "1/hour"})
    monkeypatch.setattr(weather, "hourly_forecast", lambda point: None)

    assert client.get(URL, GDANSK).status_code == 200
    assert client.get(URL, GDANSK).status_code == 429

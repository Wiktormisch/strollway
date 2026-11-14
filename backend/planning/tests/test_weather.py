import json
from datetime import date

import httpx
import pytest

from planning import weather
from planning.tests.conftest import FakeHttp

ANSWER = {
    "current": {"temperature_2m": 8.04, "precipitation_probability": 60, "wind_speed_10m": 19.96}
}


@pytest.fixture
def meteo(monkeypatch, settings):
    settings.WEATHER_PROVIDER = "auto"
    fake = FakeHttp()
    monkeypatch.setattr(weather, "make_client", fake.client)
    return fake


def test_current_weather_is_parsed(meteo):
    meteo.add(body=ANSWER)

    assert weather.current_weather((54.3385, 18.62)) == {
        "temp_c": 8.0,
        "precip_probability": 60,
        "wind_kmh": 20.0,
    }


def test_coordinates_are_rounded_before_sending(meteo):
    meteo.add(body=ANSWER)

    weather.current_weather((54.338512, 18.620049))

    params = meteo.requests[0].url.params
    assert params["latitude"] == "54.34" and params["longitude"] == "18.62"


def test_answer_is_cached_for_the_area(meteo):
    meteo.add(body=ANSWER)

    weather.current_weather((54.3385, 18.62))
    weather.current_weather((54.3401, 18.6199))  # same 0.01 degree cell

    assert len(meteo.requests) == 1


@pytest.mark.parametrize(
    "response",
    [
        {"status": 500, "body": {}},
        {"status": 200, "body": {"error": True}},
        {"error": httpx.ReadTimeout("slow")},
    ],
)
def test_failures_return_none_and_are_not_cached(meteo, response):
    meteo.add(**response)
    assert weather.current_weather((54.3385, 18.62)) is None

    meteo.add(body=ANSWER)
    assert weather.current_weather((54.3385, 18.62)) is not None


def test_missing_values_are_none(meteo):
    meteo.add(body={"current": {"temperature_2m": 3}})

    assert weather.current_weather((54.3385, 18.62)) == {
        "temp_c": 3.0,
        "precip_probability": None,
        "wind_kmh": None,
    }


def test_mock_provider_sends_nothing(settings):
    settings.WEATHER_PROVIDER = "mock"
    assert weather.current_weather((54.3385, 18.62)) is None


def test_timeout_is_five_seconds():
    assert weather.TIMEOUT_S == 5


# --- Hourly forecast (audit idea 2) ---------------------------------------------------

HOURLY_BODY = json.loads(weather.MOCK_FORECAST_PATH.read_text("utf-8"))


def test_hourly_forecast_is_parsed(meteo):
    meteo.add(body=HOURLY_BODY)

    forecast = weather.hourly_forecast((54.3385, 18.62))

    assert forecast["utc_offset_s"] == 3600
    assert len(forecast["hours"]) == 72
    assert forecast["hours"][12] == {
        "time": "2026-11-11T12:00",
        "temp_c": 9.0,
        "precip_probability": 10,
        "precip_mm": 0.0,
        "wind_kmh": 12.0,
        "sunshine_s": 3600,
        "weather_code": 1,
    }


def test_hourly_request_asks_for_3_days_at_a_rounded_point(meteo):
    meteo.add(body=HOURLY_BODY)

    weather.hourly_forecast((54.338512, 18.620049))

    params = meteo.requests[0].url.params
    assert params["latitude"] == "54.34" and params["longitude"] == "18.62"
    assert params["forecast_days"] == "3"
    assert "sunshine_duration" in params["hourly"] and "current" not in params


def test_hourly_forecast_is_cached_for_the_area(meteo):
    meteo.add(body=HOURLY_BODY)

    weather.hourly_forecast((54.3385, 18.62))
    weather.hourly_forecast((54.3401, 18.6199))

    assert len(meteo.requests) == 1


@pytest.mark.parametrize(
    "response",
    [
        {"status": 429, "body": {"reason": "Too many requests"}},
        {"status": 500, "body": {}},
        {"status": 200, "body": {"hourly": {}}},
        {"status": 200, "body": {"utc_offset_seconds": 0, "hourly": {"time": []}}},
        # Regression: columns of different length raised IndexError (a 500 in the view).
        {
            "status": 200,
            "body": {**HOURLY_BODY, "hourly": {**HOURLY_BODY["hourly"], "precipitation": [0.0]}},
        },
        {"error": httpx.ReadTimeout("slow")},
    ],
)
def test_hourly_failure_returns_none_and_waits_before_asking_again(meteo, response):
    meteo.add(**response)

    assert weather.hourly_forecast((54.3385, 18.62)) is None
    assert weather.hourly_forecast((54.3385, 18.62)) is None
    assert len(meteo.requests) == 1  # the second call did not hit the API


def test_hourly_failure_is_remembered_for_five_minutes():
    assert weather.FAILURE_CACHE_S == 5 * 60


def test_mock_provider_returns_the_fake_forecast_from_today(settings):
    settings.WEATHER_PROVIDER = "mock"

    forecast = weather.hourly_forecast((54.3385, 18.62))

    assert forecast["hours"][0]["time"] == f"{date.today().isoformat()}T00:00"
    assert len(forecast["hours"]) == 72


def test_mock_forecast_moves_dates_but_keeps_hours():
    forecast = weather.mock_forecast(today=date(2027, 2, 28))

    assert forecast["hours"][0]["time"] == "2027-02-28T00:00"
    assert forecast["hours"][-1]["time"] == "2027-03-02T23:00"

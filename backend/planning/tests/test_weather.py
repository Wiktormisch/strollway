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

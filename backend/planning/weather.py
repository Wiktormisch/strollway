"""Current weather from Open-Meteo (no key). Used only as a hint for the trip planner.

Privacy: coordinates are rounded to 0.01 degrees (about 1 km) before they leave the
server. The same rounded point is the cache key, so one call serves a whole area for 1 h.
Any failure returns None: a trip never fails because of the weather.
"""

import logging

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TIMEOUT_S = 5
CACHE_TIMEOUT_S = 60 * 60
CURRENT_FIELDS = "temperature_2m,precipitation_probability,wind_speed_10m"


def make_client():
    """The HTTP client. Tests replace this function with one that uses a MockTransport."""
    return httpx.Client(timeout=TIMEOUT_S)


def is_enabled():
    return settings.WEATHER_PROVIDER != "mock"


def current_weather(point):
    """{"temp_c", "precip_probability", "wind_kmh"} for the area of `point`, or None."""
    if not is_enabled():
        return None
    lat, lng = round(point[0], 2), round(point[1], 2)
    key = f"weather:{lat}:{lng}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    try:
        weather = _parse(_request(lat, lng))
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        logger.warning("Weather unavailable: %s", exc)
        return None
    cache.set(key, weather, CACHE_TIMEOUT_S)
    return weather


def _request(lat, lng):
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": CURRENT_FIELDS,
        "wind_speed_unit": "kmh",
        "timezone": "auto",
    }
    with make_client() as client:
        response = client.get(settings.WEATHER_URL, params=params)
    response.raise_for_status()
    return response.json()


def _parse(body):
    current = body["current"]
    precip = current.get("precipitation_probability")
    return {
        "temp_c": _number(current.get("temperature_2m")),
        "precip_probability": None if precip is None else int(precip),
        "wind_kmh": _number(current.get("wind_speed_10m")),
    }


def _number(value):
    return None if value is None else round(float(value), 1)

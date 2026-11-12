"""Safety nets for every test: no network, no shared cache, no real keys."""

import httpx
import pytest


def _no_network(request):
    raise AssertionError(f"Tests must not call the network: {request.method} {request.url}")


@pytest.fixture(autouse=True)
def isolated_external_services(settings, monkeypatch):
    # Memory cache, so tests do not read or write backend/.cache/.
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    # backend/.env may hold a real key; tests never use it.
    settings.ORS_API_KEY = ""
    settings.ANTHROPIC_API_KEY = ""
    settings.NVIDIA_API_KEY = ""
    settings.ROUTING_PROVIDER = "auto"
    settings.POI_PROVIDER = "mock"
    settings.WEATHER_PROVIDER = "mock"
    settings.LLM_BACKEND = "mock"

    def blocked_client(**kwargs):
        return httpx.Client(transport=httpx.MockTransport(_no_network))

    from pathlib import Path

    from planning import fixtures, pois, routing, weather

    # Fixed copies: `record_fixtures` may rewrite planning/fixtures/ with new OSM data.
    test_fixtures = Path(fixtures.__file__).parent / "tests" / "data" / "fixtures"
    monkeypatch.setattr(fixtures, "FIXTURES_DIR", test_fixtures)

    monkeypatch.setattr(routing, "make_client", blocked_client)
    monkeypatch.setattr(pois, "make_client", blocked_client)
    monkeypatch.setattr(weather, "make_client", blocked_client)
    from django.core.cache import cache

    cache.clear()

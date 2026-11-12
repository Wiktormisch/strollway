from django.urls import reverse


def test_health_returns_ok_and_engines(client, settings):
    settings.ROUTING_PROVIDER = "mock"
    settings.LLM_BACKEND = "mock"

    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "routing": "mock", "llm": "rules"}


def test_schema_is_served(client):
    response = client.get(reverse("schema"))

    assert response.status_code == 200

import pytest
from django.urls import reverse

ALLOWED = "http://localhost:5173"


@pytest.fixture(autouse=True)
def allowed_origins(settings):
    settings.CORS_ALLOWED_ORIGINS = [ALLOWED]


def test_cors_header_for_allowed_origin(client):
    response = client.get(reverse("health"), HTTP_ORIGIN=ALLOWED)

    assert response["Access-Control-Allow-Origin"] == ALLOWED


def test_no_cors_header_for_other_origin(client):
    response = client.get(reverse("health"), HTTP_ORIGIN="https://evil.example")

    assert "Access-Control-Allow-Origin" not in response


def test_preflight_allows_client_id_header(client):
    response = client.options(
        reverse("health"),
        HTTP_ORIGIN=ALLOWED,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-client-id",
    )

    assert "x-client-id" in response["Access-Control-Allow-Headers"]

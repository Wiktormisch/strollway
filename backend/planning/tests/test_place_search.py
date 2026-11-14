"""Place search by name in our own table (audit idea 15). Fake places only."""

import pytest

from planning.models import Place
from planning.place_search import normalize, search_places

URL = "/api/places/search/"


def place(osm_id, name=None, **tags):
    if name is not None:
        tags["name"] = name
    return Place.objects.create(osm_type="way", osm_id=osm_id, lat=54.4, lng=18.6, tags=tags)


@pytest.mark.parametrize(
    ("text", "expected"),
    [("Łąkowa", "lakowa"), ("  PARK Oliwski ", "park oliwski"), ("Źródło", "zrodlo")],
)
def test_normalize(text, expected):
    assert normalize(text) == expected


@pytest.mark.django_db
def test_search_ignores_case_and_polish_letters():
    place(1, "Park Łąkowy", leisure="park")
    assert [r["name"] for r in search_places("LAKOWY")] == ["Park Łąkowy"]


@pytest.mark.django_db
def test_names_that_start_with_the_query_come_first():
    place(1, "Stary Park Oliwski", leisure="park")
    place(2, "Oliwa Zoo", tourism="zoo")
    place(3, "Oliwa", highway="bus_stop")
    names = [r["name"] for r in search_places("oliw")]
    assert names == ["Oliwa", "Oliwa Zoo", "Stary Park Oliwski"]


@pytest.mark.django_db
def test_result_shape_and_categories():
    place(7, "Plac zabaw", leisure="playground")
    place(8, "Kiosk", shop="kiosk")
    results = {r["name"]: r for r in search_places("k")}  # too short: no results
    assert results == {}
    assert search_places("plac") == [
        {
            "poi_id": "way/7",
            "name": "Plac zabaw",
            "category": "playground",
            "lat": 54.4,
            "lng": 18.6,
        }
    ]
    assert search_places("kiosk")[0]["category"] == "other"


@pytest.mark.django_db
def test_duplicates_and_unnamed_places_are_skipped_and_results_are_capped():
    place(1, "Park", leisure="park")
    place(2, "Park", leisure="park")  # the same park mapped twice
    place(3, leisure="park")  # no name
    for osm_id in range(10, 30):
        place(osm_id, f"Park {osm_id}", leisure="park")
    results = search_places("park")
    assert len(results) == 8
    assert [r["name"] for r in results].count("Park") == 1


@pytest.mark.django_db
def test_api_returns_results(client):
    place(1, "Park Oliwski", leisure="park")
    response = client.get(URL, {"q": "oliwski"})
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Park Oliwski"


@pytest.mark.django_db
@pytest.mark.parametrize("params", [{}, {"q": "a"}, {"q": "x" * 101}])
def test_api_rejects_a_bad_query(client, params):
    assert client.get(URL, params).status_code == 400


def test_place_search_has_its_own_throttle_scope(settings):
    from planning.views import PlaceSearchView

    assert PlaceSearchView.throttle_scope == "place_search"
    assert settings.PLACE_SEARCH_DEFAULT_RATE == "300/hour"

import time
from urllib.parse import parse_qs

import httpx
import pytest

from planning import pois

# A straight north-south line of 11 vertices, about 11 m apart.
LINE = [[54.3500 + i * 0.0001, 18.6000] for i in range(11)]
START, END = tuple(LINE[0]), tuple(LINE[-1])
SPEED = 4000 / 60  # 4 km/h in m/min


def node(id_, lat, lng, **tags):
    return {"type": "node", "id": id_, "lat": lat, "lon": lng, "tags": tags}


def way(id_, lat, lng, **tags):
    return {"type": "way", "id": id_, "center": {"lat": lat, "lon": lng}, "tags": tags}


def parse(*elements):
    return pois.parse_overpass({"elements": list(elements)}, LINE, START, END, SPEED)


# --- Query -----------------------------------------------------------------------------


def test_query_is_one_combined_request_with_node_and_way():
    query = pois.build_query(LINE, START, END)

    assert query.startswith("[out:json][timeout:10];")
    assert query.rstrip().endswith("out center tags;")
    assert 'node["amenity"~"^(bench|cafe|drinking_water|fast_food|restaurant|toilets)$"]' in query
    assert 'way["leisure"~"^(park|playground)$"](around:150,' in query
    assert 'node["highway"~"^(bus_stop)$"](around:400,54.350000,18.600000)' in query
    assert "relation" not in query


# --- Parsing ---------------------------------------------------------------------------


def test_parse_node_and_way_with_center():
    result = parse(
        node(1, 54.3502, 18.6001, amenity="cafe", name="Miau", opening_hours="Mo-Su 10:00-20:00"),
        way(2, 54.3508, 18.6002, amenity="toilets"),
    )

    cafe, toilets = result.pois
    assert result.status == "ok"
    assert cafe == {
        "poi_id": "node/1",
        "name": "Miau",
        "category": "cafe",
        "lat": 54.3502,
        "lng": 18.6001,
        "at_min": 0,
        "off_route_m": 6,
        "opening_hours": "Mo-Su 10:00-20:00",
        "open_now": True,  # the fixed test clock: Wednesday 10:00
    }
    assert toilets["poi_id"] == "way/2"
    assert toilets["name"] is None
    assert toilets["at_min"] == round(geo_distance_to(8) / SPEED)


def geo_distance_to(index):
    from planning import geo

    return geo.cumulative_distances(LINE)[index]


@pytest.mark.parametrize(
    ("tags", "category"),
    [
        ({"leisure": "playground"}, "playground"),
        ({"amenity": "toilets"}, "toilets"),
        ({"amenity": "cafe"}, "cafe"),
        ({"amenity": "restaurant"}, "restaurant"),
        ({"amenity": "fast_food"}, "restaurant"),
        ({"amenity": "bench"}, "bench"),
        ({"amenity": "drinking_water"}, "water"),
        ({"leisure": "park"}, "park"),
        ({"tourism": "zoo"}, "zoo"),
        ({"tourism": "museum"}, "museum"),
        ({"natural": "beach"}, "beach"),
    ],
)
def test_category_mapping(tags, category):
    assert parse(node(1, 54.3501, 18.6, **tags)).pois[0]["category"] == category


def test_unknown_tags_and_missing_center_are_skipped():
    result = parse(
        node(1, 54.3501, 18.6, shop="bakery"),
        {"type": "way", "id": 2, "tags": {"amenity": "cafe"}},  # no center
    )
    assert result.pois == []


def test_zero_results():
    result = parse()
    assert (result.pois, result.transit_stops, result.status) == ([], [], "ok")


def test_sorted_by_minute_on_route():
    result = parse(
        node(1, 54.3509, 18.6, amenity="cafe", name="Late"),
        node(2, 54.3501, 18.6, amenity="cafe", name="Early"),
    )
    assert [p["name"] for p in result.pois] == ["Early", "Late"]


def test_playground_as_point_and_outline_is_merged():
    result = parse(
        node(1, 54.3504, 18.6001, leisure="playground"),
        way(2, 54.3505, 18.6002, leisure="playground"),
    )
    assert len(result.pois) == 1


def test_benches_grouped_about_every_30_m():
    # Three benches within a few metres, one 50 m away.
    result = parse(
        node(1, 54.3500, 18.6000, amenity="bench"),
        node(2, 54.35001, 18.60001, amenity="bench"),
        node(3, 54.35002, 18.60002, amenity="bench"),
        node(4, 54.3505, 18.6000, amenity="bench"),
    )
    assert [p["poi_id"] for p in result.pois] == ["node/1", "node/4"]


def test_benches_capped_at_10_closest_to_route():
    long_line = [[54.35 + i * 0.001, 18.6] for i in range(30)]
    # 20 benches about 110 m apart; the last 10 are 33 m off the route.
    benches = [
        node(i, 54.35 + i * 0.001, 18.6 + (0.0005 if i >= 10 else 0), amenity="bench")
        for i in range(20)
    ]
    cafe = node(99, 54.351, 18.6, amenity="cafe")
    result = pois.parse_overpass({"elements": [*benches, cafe]}, long_line, START, END, SPEED)

    bench_ids = {p["poi_id"] for p in result.pois if p["category"] == "bench"}
    assert bench_ids == {f"node/{i}" for i in range(10)}
    assert any(p["category"] == "cafe" for p in result.pois)


def test_transit_stops_near_start_and_end():
    result = parse(
        node(1, 54.3499, 18.6, highway="bus_stop", name="Hucisko"),
        node(2, 54.3498, 18.6001, highway="bus_stop", name="Hucisko"),  # other platform
        node(3, 54.3511, 18.6, railway="tram_stop", name="Brama"),
    )
    assert result.transit_stops == [
        {"name": "Hucisko", "kind": "bus", "near": "start", "distance_m": 11},
        {"name": "Brama", "kind": "tram", "near": "end", "distance_m": 11},
    ]
    assert result.pois == []


# --- HTTP and failures -----------------------------------------------------------------


def test_route_places_wait_as_short_as_trip_places(overpass, monkeypatch):
    """Regression: route plans waited 25 s for a server that almost never answers."""
    seen = []
    real_client = overpass.client

    def client(timeout=None):
        seen.append(timeout)
        return real_client()

    monkeypatch.setattr(pois, "make_client", client)
    overpass.add(body={"elements": []})

    pois.find_pois(LINE, START, END, SPEED)

    assert seen == [pois.TIMEOUT_S]
    assert pois.TIMEOUT_S <= 12
    assert pois.QUERY_TIMEOUT_S < pois.TIMEOUT_S  # the server gives up before the client


def test_find_pois_sends_one_query_and_caches(overpass):
    overpass.add(body={"elements": [node(1, 54.3501, 18.6, amenity="cafe")]})

    first = pois.find_pois(LINE, START, END, SPEED)
    second = pois.find_pois(LINE, START, END, SPEED)

    assert len(overpass.requests) == 1
    assert first == second
    sent = parse_qs(overpass.requests[0].content.decode())["data"][0]
    assert "[timeout:10]" in sent
    assert overpass.requests[0].headers["User-Agent"].startswith("StrollWay")


@pytest.mark.parametrize(
    "failure",
    [
        {"status": 429, "body": {}},
        {"status": 504, "body": {}},
        {"status": 502, "body": {}},
        {"error": httpx.ReadTimeout("slow")},
        {"error": httpx.ConnectError("down")},
        {"status": 200, "body": {"elements": [], "remark": "runtime error: Query timed out"}},
    ],
)
def test_failures_give_unavailable_without_sleep(overpass, monkeypatch, failure):
    def no_sleep(seconds):
        raise AssertionError("Must not sleep inside a request")

    monkeypatch.setattr(time, "sleep", no_sleep)
    overpass.add(**failure)

    result = pois.find_pois(LINE, START, END, SPEED)

    assert (result.pois, result.transit_stops, result.status) == ([], [], "unavailable")
    assert len(overpass.requests) == 1  # no retry


def test_failure_is_not_cached(overpass):
    overpass.add(status=429, body={}).add(body={"elements": []})

    assert pois.find_pois(LINE, START, END, SPEED).status == "unavailable"
    assert pois.find_pois(LINE, START, END, SPEED).status == "ok"

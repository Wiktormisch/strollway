import httpx

from planning import pois
from planning.tests.factories import START, node, way


def test_radius_comes_from_the_time_limit_and_is_capped():
    speed = 4000 / 60  # 66.7 m/min
    assert pois.trip_radius_m(speed, 30) == 1000
    assert pois.trip_radius_m(speed, 180) == pois.TRIP_MAX_RADIUS_M
    assert pois.trip_radius_m(speed, 5) == pois.TRIP_MIN_RADIUS_M


def test_query_has_trip_places_and_transit_but_no_benches():
    query = pois.build_around_query(START, 800)

    assert "bench" not in query
    assert "playground" in query and "ice_cream" in query and "supermarket" in query
    assert "(around:800,54.338500,18.620000)" in query
    assert "bus_stop" in query
    assert query.endswith("out center tags;")


def test_parse_candidates_gives_distance_and_relative_position():
    body = {
        "elements": [
            node(1, 54.3394, 18.6200, amenity="restaurant", cuisine="pizza", name="Roma"),
            way(2, 54.3385, 18.6215, leisure="playground"),
            node(3, 54.3386, 18.6201, amenity="ice_cream", name="Lody"),
        ]
    }

    result = pois.parse_candidates(body, START, 1500)

    assert result.status == pois.STATUS_OK
    assert [c["poi_id"] for c in result.pois] == ["node/3", "way/2", "node/1"]
    pizza = result.pois[2]
    assert pizza["category"] == "restaurant" and pizza["cuisine"] == "pizza"
    assert pizza["distance_m"] == 100
    assert abs(pizza["north_m"] - 100) <= 1 and pizza["east_m"] == 0
    playground = result.pois[1]
    assert playground["north_m"] == 0 and abs(playground["east_m"] - 97) <= 1
    ice_cream = result.pois[0]
    assert ice_cream["category"] == "cafe" and ice_cream["cuisine"] == "ice_cream"


def test_places_outside_the_radius_and_benches_are_skipped():
    body = {
        "elements": [
            node(1, 54.3485, 18.62, amenity="cafe"),  # about 1.1 km north
            node(2, 54.3386, 18.62, amenity="bench"),
        ]
    }

    assert pois.parse_candidates(body, START, 1000).pois == []


def test_transit_stops_near_the_start_are_returned():
    body = {"elements": [node(1, 54.3387, 18.62, highway="bus_stop", name="Sikorskiego")]}

    result = pois.parse_candidates(body, START, 1000)

    assert result.transit_stops == [
        {"name": "Sikorskiego", "kind": "bus", "near": "start", "distance_m": 22}
    ]


def test_cap_keeps_every_category():
    playgrounds = [
        node(i, 54.3385 + i * 0.0001, 18.62, leisure="playground", name=f"P{i}") for i in range(60)
    ]
    cafe = node(999, 54.3485 - 0.0001, 18.62, amenity="cafe", name="Far cafe")
    result = pois.parse_candidates({"elements": [*playgrounds, cafe]}, START, 1500)

    assert len(result.pois) == pois.MAX_CANDIDATES
    assert "node/999" in [c["poi_id"] for c in result.pois]
    distances = [c["distance_m"] for c in result.pois]
    assert distances == sorted(distances)


def test_zero_elements_give_an_empty_ok_result():
    result = pois.parse_candidates({"elements": []}, START, 1000)
    assert result.pois == [] and result.status == pois.STATUS_OK


def test_find_candidates_reports_unavailable_without_waiting(overpass):
    overpass.add(status=429, body={})
    assert pois.find_candidates(START, 1000).status == pois.STATUS_UNAVAILABLE

    overpass.add(error=httpx.ReadTimeout("slow"))
    assert pois.find_candidates(START, 900).status == pois.STATUS_UNAVAILABLE


def test_trip_search_uses_the_short_timeout(overpass, monkeypatch):
    seen = []
    real_client = overpass.client

    def client(timeout=None):
        seen.append(timeout)
        return real_client()

    monkeypatch.setattr(pois, "make_client", client)
    overpass.add(body={"elements": []})

    pois.find_candidates(START, 700)

    assert seen == [pois.TRIP_TIMEOUT_S]

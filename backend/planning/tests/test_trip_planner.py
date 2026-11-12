import json

import pytest

from planning import fixtures, geo, pois, routing, trip_planner
from planning.tests.factories import START, candidate, node

CANDIDATES = [
    candidate("node/1", "playground", 40, 0, name="Hop"),
    candidate("node/2", "cafe", 0, 40, name="Kawka"),
    candidate("node/3", "restaurant", -40, 0, name="Roma", cuisine="pizza"),
    candidate("node/4", "toilets", 0, -40),
]


@pytest.fixture
def places(monkeypatch, settings):
    """Replace the Overpass search with a fixed list (set `places.result`)."""
    settings.POI_PROVIDER = "overpass"

    class Places:
        result = pois.PoiResult(list(CANDIDATES), [], pois.STATUS_OK)
        calls = 0

    def find(start, radius_m):
        Places.calls += 1
        return Places.result

    monkeypatch.setattr(pois, "find_candidates", find)
    return Places


@pytest.fixture
def no_ors(settings):
    settings.ROUTING_PROVIDER = "mock"


@pytest.fixture
def fake_ors(monkeypatch, settings):
    """A fake ORS: route distance in metres by the number of points (`fake_ors.metres`)."""
    settings.ROUTING_PROVIDER = "ors"
    settings.ORS_API_KEY = "test-key"

    class Fake:
        metres = {}
        calls = []

    def fetch(points, avoid):
        Fake.calls.append((len(points), avoid))
        line = [list(p) for p in points]
        return routing.Route(
            line, Fake.metres.get(len(points), 100.0), 0.0, [], list(range(len(points)))
        )

    monkeypatch.setattr(routing, "fetch_ors_route", fetch)
    return Fake


def fixed_answer(monkeypatch, poi_ids, minutes=20):
    answer = {
        "summary": "Fixed plan.",
        "stops": [{"poi_id": p, "planned_minutes": minutes, "reason": "Test."} for p in poi_ids],
        "unmet_wishes": [],
        "tips": [],
    }
    monkeypatch.setattr(trip_planner, "_plan_answer", lambda c, ctx: (answer, "rules"))


def build(**kwargs):
    params = {"max_minutes": 60, "round_trip": True, "language": "en", "wishes": ""}
    params.update(kwargs)
    return trip_planner.build_trip_idea(START, **params)


def test_zero_candidates_is_no_places_nearby_and_plans_nothing(places, monkeypatch):
    places.result = pois.PoiResult([], [], pois.STATUS_OK)
    planner_called = []
    monkeypatch.setattr(trip_planner, "_plan_answer", lambda *a: planner_called.append(1))

    with pytest.raises(trip_planner.NoPlacesNearby):
        build()
    assert planner_called == []


def test_overpass_failure_is_places_unavailable(places):
    places.result = pois.PoiResult([], [], pois.STATUS_UNAVAILABLE)
    with pytest.raises(trip_planner.PlacesUnavailable):
        build()


def test_all_places_closed_is_no_places_nearby(places, no_ors):
    places.result = pois.PoiResult(
        [{**c, "open_now": False} for c in CANDIDATES], [], pois.STATUS_OK
    )
    with pytest.raises(trip_planner.NoPlacesNearby):
        build()


def test_rules_plan_on_a_mock_route(places, no_ors):
    idea = build(wishes="playground, then pizza", max_minutes=120)

    assert idea["engine"] == "rules"
    assert idea["source"] == "mock"
    assert idea["step_free_available"] is None
    assert [s["poi_id"] for s in idea["stops"]] == ["node/1", "node/3"]
    assert idea["stops"][0]["name"] == "Hop"
    assert idea["route"]["stairs_m"] is None
    assert idea["over_limit"] is False
    assert idea["total_min"] == idea["walking_min"] + idea["stops_min"]


def test_arrive_min_counts_walking_and_earlier_stops(places, fake_ors, monkeypatch):
    fixed_answer(monkeypatch, ["node/1", "node/2"], minutes=10)
    one, two = CANDIDATES[0], CANDIDATES[1]
    path = [START, (one["lat"], one["lng"]), (two["lat"], two["lng"]), START]
    legs = [geo.haversine_m(a, b) for a, b in zip(path, path[1:], strict=False)]
    fake_ors.metres = {4: sum(legs) * 10}  # 10x longer streets than the straight lines

    idea = build()

    speed = 4000 / 60
    first, second = idea["stops"]
    assert first["arrive_min"] == round(legs[0] * 10 / speed)
    assert second["arrive_min"] == round((legs[0] + legs[1]) * 10 / speed) + 10


def test_time_limit_loop_drops_the_last_stop_and_reroutes(places, fake_ors, monkeypatch):
    fixed_answer(monkeypatch, ["node/1", "node/2", "node/3"], minutes=20)
    # 3 stops: 45 min walking + 60 at stops; 2 stops: 30 + 40; 1 stop: 15 + 20.
    fake_ors.metres = {5: 3000.0, 4: 2000.0, 3: 1000.0}

    idea = build(max_minutes=60)

    assert [s["poi_id"] for s in idea["stops"]] == ["node/1"]
    assert idea["dropped_stops"] == [
        {"poi_id": "node/3", "name": "Roma"},
        {"poi_id": "node/2", "name": "Kawka"},
    ]
    assert idea["over_limit"] is False
    assert "Roma: skipped to fit the time limit." in idea["tips"]
    assert [n for n, avoid in fake_ors.calls if not avoid] == [5, 4, 3]


def test_time_limit_loop_stops_after_two_reroutes_and_sets_over_limit(
    places, fake_ors, monkeypatch
):
    fixed_answer(monkeypatch, ["node/1", "node/2", "node/3", "node/4"], minutes=10)
    fake_ors.metres = {6: 9000.0, 5: 9000.0, 4: 9000.0, 3: 9000.0}

    idea = build(max_minutes=60)

    assert len(idea["stops"]) == 2
    assert len(idea["dropped_stops"]) == 2
    assert idea["over_limit"] is True
    assert len([1 for _, avoid in fake_ors.calls if not avoid]) == 3  # first route + 2


def test_ten_percent_over_the_limit_is_still_fine(places, fake_ors, monkeypatch):
    fixed_answer(monkeypatch, ["node/1"], minutes=60)
    fake_ors.metres = {3: 400.0}  # 6 min walking -> 66 min = exactly +10%

    idea = build(max_minutes=60)

    assert idea["dropped_stops"] == [] and idea["over_limit"] is False


def test_pre_trim_drops_far_stops_without_routing(places, fake_ors, monkeypatch):
    far = candidate("node/9", "zoo", 1400, 0, name="Zoo")
    places.result = pois.PoiResult([*CANDIDATES, far], [], pois.STATUS_OK)
    fixed_answer(monkeypatch, ["node/1", "node/9"], minutes=30)

    idea = build(max_minutes=45)

    assert [s["poi_id"] for s in idea["stops"]] == ["node/1"]
    assert idea["dropped_stops"] == [{"poi_id": "node/9", "name": "Zoo"}]
    assert [n for n, avoid in fake_ors.calls if not avoid] == [3]


def test_one_way_trip_does_not_return_to_the_start(places, fake_ors, monkeypatch):
    fixed_answer(monkeypatch, ["node/1", "node/2"])

    build(round_trip=False)

    assert fake_ors.calls[0] == (3, False)


def test_ors_failure_falls_back_to_the_mock_route(places, settings, monkeypatch):
    settings.ROUTING_PROVIDER = "ors"
    settings.ORS_API_KEY = "test-key"

    def broken(points, avoid):
        raise routing.UpstreamUnavailable("down")

    monkeypatch.setattr(routing, "fetch_ors_route", broken)

    assert build()["source"] == "mock"


@pytest.mark.parametrize("error", [routing.NoRoute, routing.NoRoutablePoint])
def test_a_stop_ors_cannot_reach_gives_straight_lines_not_422(places, fake_ors, monkeypatch, error):
    # A park is its centre point in OSM, often more than 350 m from a path (ORS 2010).
    def fail(points, avoid):
        raise error()

    monkeypatch.setattr(routing, "fetch_ors_route", fail)

    idea = build()

    assert idea["source"] == "mock"
    assert idea["route"]["stairs_m"] is None
    assert idea["stops"]


def test_wishes_are_capped_at_200_characters(places, no_ors, monkeypatch):
    seen = {}
    real = trip_planner._plan_answer

    def spy(candidates, context):
        seen["wishes"] = context["wishes"]
        return real(candidates, context)

    monkeypatch.setattr(trip_planner, "_plan_answer", spy)
    build(wishes="x" * 500)

    assert len(seen["wishes"]) == 200


# --- The recorded demo trip ------------------------------------------------------------


@pytest.fixture
def demo_fixture(tmp_path, monkeypatch, settings):
    """A fake recorded demo trip: one playground and its recorded loop route."""
    settings.POI_PROVIDER = "mock"
    settings.ROUTING_PROVIDER = "mock"
    monkeypatch.setattr(fixtures, "FIXTURES_DIR", tmp_path)
    playground = (54.3391, 18.6195)
    points = [START, playground, START]
    route_body = {
        "routes": [
            {
                "summary": {"distance": 180.0},
                "geometry": "",
                "extras": {"waytype": {"summary": [], "values": []}},
                "way_points": [0, 0, 0],
            }
        ]
    }
    data = {
        "start": list(START),
        "overpass": {"elements": [node(1, *playground, leisure="playground")]},
        "ors": {
            routing.cache_key(points, False): {"status": 200, "body": route_body},
        },
    }
    (tmp_path / fixtures.TRIP_FILE).write_text(json.dumps(data), encoding="utf-8")
    return data


def test_demo_start_works_with_no_network(demo_fixture, monkeypatch):
    def no_network(*args, **kwargs):
        raise AssertionError("network used")

    monkeypatch.setattr(pois, "make_client", no_network)
    monkeypatch.setattr(routing, "make_client", no_network)

    idea = build(wishes="playground")

    assert idea["engine"] == "rules"
    assert idea["source"] == "fixture"
    assert idea["stops"][0]["poi_id"] == "node/1"
    assert idea["route"]["distance_m"] == 180
    assert idea["step_free_available"] is True  # recorded route has no stairs


def test_fixture_is_used_only_near_the_demo_start(demo_fixture):
    assert fixtures.load_trip_fixture(START) is not None
    assert fixtures.load_trip_fixture((52.2297, 21.0122)) is None


def test_the_committed_demo_recording_works_offline(settings, monkeypatch):
    """planning/fixtures/trip_demo.json: the DoD "demo start works with no network".

    The data may be recorded again, so only the shape of the answer is checked.
    """
    real_dir = fixtures.Path(fixtures.__file__).resolve().parent / "fixtures"
    if not (real_dir / fixtures.TRIP_FILE).exists():
        pytest.skip("The demo trip is not recorded yet (record_fixtures --trip).")
    monkeypatch.setattr(fixtures, "FIXTURES_DIR", real_dir)
    settings.POI_PROVIDER = "mock"
    settings.ROUTING_PROVIDER = "mock"

    idea = build(wishes="plac zabaw, lody, pizza", max_minutes=90, language="pl")

    assert idea["engine"] == "rules"
    assert idea["source"] == "fixture"
    assert 1 <= len(idea["stops"]) <= 4
    assert idea["route"]["stairs_m"] == 0

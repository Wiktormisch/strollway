import httpx
import pytest

from planning import routing
from planning.tests.conftest import PAIR_3_END, PAIR_3_START, load

ERROR_2009 = load("ors_pair2_avoid_2009.json")
ERROR_2010 = {"error": {"code": 2010, "message": "Could not find routable point"}}


def fetcher(start=PAIR_3_START, end=PAIR_3_END):
    return lambda avoid: routing.fetch_ors_route(start, end, avoid)


# --- Parsing ---------------------------------------------------------------------------


def test_parse_route_with_stairs():
    route = routing.parse_ors_response(200, load("ors_pair2_normal.json"))

    assert route.distance_m == 402.4
    assert route.stairs_m == 39.9
    assert route.stairs_segments
    # Every segment is a part of the geometry, in [lat, lng] order (Gdansk: lat ~54).
    for segment in route.stairs_segments:
        assert len(segment) >= 2
        assert all(point in route.geometry for point in segment)
        assert 54 < segment[0][0] < 55


def test_stairs_from_float_and_int_values():
    body = load("ors_pair3_normal.json")
    waytype = body["routes"][0]["extras"]["waytype"]
    for item in waytype["summary"]:
        item["value"] = int(item["value"])  # 8 instead of 8.0
    waytype["values"] = [[a, b, int(v)] for a, b, v in waytype["values"]]
    as_int = routing.parse_ors_response(200, body)
    as_float = routing.parse_ors_response(200, load("ors_pair3_normal.json"))

    assert as_float.stairs_m == as_int.stairs_m == 12.6
    assert as_float.stairs_segments == as_int.stairs_segments
    assert len(as_float.stairs_segments) >= 1


def test_segments_map_indexes_to_coordinates():
    body = load("ors_pair3_normal.json")
    body["routes"][0]["extras"]["waytype"] = {
        "summary": [{"value": 8.0, "distance": 5.0}],
        "values": [[0, 2, 7.0], [2, 4, 8.0], [4, 6, 7.0]],
    }
    route = routing.parse_ors_response(200, body)
    assert route.stairs_segments == [route.geometry[2:5]]


def test_route_without_stairs():
    route = routing.parse_ors_response(200, load("ors_brzezno_normal.json"))
    assert route.stairs_m == 0
    assert route.stairs_segments == []


def test_error_2009_with_404_is_no_route():
    with pytest.raises(routing.NoRoute):
        routing.parse_ors_response(404, ERROR_2009)


def test_error_2010_is_no_routable_point():
    with pytest.raises(routing.NoRoutablePoint):
        routing.parse_ors_response(404, ERROR_2010)


@pytest.mark.parametrize(
    ("status", "body"),
    [(429, {"error": "Rate limit"}), (500, {}), (503, {"error": {"code": 2099}}), (200, {})],
)
def test_other_answers_are_upstream_failures(status, body):
    with pytest.raises(routing.UpstreamUnavailable):
        routing.parse_ors_response(status, body)


# --- Requests --------------------------------------------------------------------------


def test_request_uses_lon_lat_order_post_and_key(ors, settings):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    routing.compare_routes(fetcher(), avoid_stairs=True)

    normal, avoid = ors.json_bodies()
    assert normal["coordinates"] == [[18.5655, 54.4097], [18.5745, 54.4115]]
    assert normal["extra_info"] == ["waytype"]
    assert "options" not in normal
    assert "elevation" not in normal
    assert avoid["options"] == {"avoid_features": ["steps"]}
    request = ors.requests[0]
    assert request.method == "POST"
    assert str(request.url) == f"{settings.ORS_BASE_URL}/v2/directions/foot-walking/json"
    assert request.headers["Authorization"] == "test-key"


def test_cache_second_call_does_not_hit_http(ors):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    first = routing.compare_routes(fetcher(), avoid_stairs=True)
    second = routing.compare_routes(fetcher(), avoid_stairs=True)

    assert len(ors.requests) == 2
    assert first == second


def test_failures_are_not_cached(ors):
    ors.add(status=503, body={}).add(body=load("ors_pair3_normal.json"))

    with pytest.raises(routing.UpstreamUnavailable):
        routing.fetch_ors_route(PAIR_3_START, PAIR_3_END, False)
    route = routing.fetch_ors_route(PAIR_3_START, PAIR_3_END, False)

    assert route.distance_m == 826.6


def test_timeout_is_upstream_failure(ors):
    ors.add(error=httpx.ReadTimeout("slow"))
    with pytest.raises(routing.UpstreamUnavailable):
        routing.fetch_ors_route(PAIR_3_START, PAIR_3_END, False)


def test_invalid_json_is_upstream_failure(ors):
    ors.responses.append(httpx.Response(502, text="<html>Bad gateway</html>"))
    with pytest.raises(routing.UpstreamUnavailable):
        routing.fetch_ors_route(PAIR_3_START, PAIR_3_END, False)


# --- Comparison ------------------------------------------------------------------------


def test_detour_math(ors):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))

    result = routing.compare_routes(fetcher(), avoid_stairs=True)

    assert result.step_free_available is True
    assert result.baseline.stairs_m == 12.6
    assert result.route.stairs_m == 0
    assert result.detour_m == pytest.approx(832.8 - 826.6)


def test_2009_on_avoid_steps_returns_normal_route(ors):
    ors.add(body=load("ors_pair2_normal.json")).add(status=404, body=ERROR_2009)

    result = routing.compare_routes(fetcher(), avoid_stairs=True)

    assert result.step_free_available is False
    assert result.route is result.baseline
    assert result.detour_m is None
    assert result.route.stairs_m == 39.9


def test_2009_on_normal_request_raises(ors):
    ors.add(status=404, body=ERROR_2009)
    with pytest.raises(routing.NoRoute):
        routing.compare_routes(fetcher(), avoid_stairs=True)


def test_2010_raises(ors):
    ors.add(status=404, body=ERROR_2010)
    with pytest.raises(routing.NoRoutablePoint):
        routing.compare_routes(fetcher(), avoid_stairs=True)


def test_avoid_steps_failure_keeps_normal_route(ors):
    ors.add(body=load("ors_pair3_normal.json")).add(status=429, body={"error": "Rate limit"})

    result = routing.compare_routes(fetcher(), avoid_stairs=True)

    assert result.step_free_available is None
    assert result.route.distance_m == 826.6
    assert result.baseline.stairs_m == 12.6


def test_no_stairs_skips_second_request(ors):
    ors.add(body=load("ors_brzezno_normal.json"))

    result = routing.compare_routes(fetcher(), avoid_stairs=True)

    assert len(ors.requests) == 1
    assert (result.step_free_available, result.detour_m) == (True, 0)


def test_avoid_stairs_false_sends_one_request(ors):
    ors.add(body=load("ors_pair3_normal.json"))

    result = routing.compare_routes(fetcher(), avoid_stairs=False)

    assert len(ors.requests) == 1
    assert result.step_free_available is None
    assert result.route is result.baseline
    assert result.baseline.stairs_segments


def test_mock_comparison_is_straight_line_without_stairs():
    result = routing.mock_comparison(PAIR_3_START, PAIR_3_END)
    assert result.route.geometry[0] == list(PAIR_3_START)
    assert result.route.stairs_m is None
    assert result.step_free_available is None

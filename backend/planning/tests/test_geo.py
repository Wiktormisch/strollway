import pytest

from planning import geo
from planning.tests.conftest import PAIR_3_END, PAIR_3_START, load


def test_haversine_known_distance():
    # One degree of latitude is about 111.2 km.
    assert geo.haversine_m((54.0, 18.0), (55.0, 18.0)) == pytest.approx(111_195, rel=1e-3)
    assert geo.haversine_m((54.0, 18.0), (54.0, 18.0)) == 0


def test_decode_polyline_reference_example():
    # The example from Google's polyline format documentation.
    points = geo.decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    assert points == [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]


def test_decode_polyline_real_ors_sample():
    raw = load("ors_pair3_normal.json")["routes"][0]
    points = geo.decode_polyline(raw["geometry"])

    assert len(points) > 10
    # Points are [lat, lng] and close to the requested start and end.
    assert geo.haversine_m(points[0], PAIR_3_START) < 30
    assert geo.haversine_m(points[-1], PAIR_3_END) < 30
    # The length along the line matches the ORS distance.
    total = geo.cumulative_distances(points)[-1]
    assert total == pytest.approx(raw["summary"]["distance"], rel=0.02)
    # way_points index the decoded geometry.
    assert raw["way_points"][-1] == len(points) - 1


def test_cumulative_distances():
    line = [[54.0, 18.0], [54.001, 18.0], [54.002, 18.0]]
    totals = geo.cumulative_distances(line)
    assert totals[0] == 0
    assert totals[1] == pytest.approx(111.2, rel=1e-2)
    assert totals[2] == pytest.approx(2 * totals[1])


def test_nearest_vertex():
    line = [[54.0, 18.0], [54.001, 18.0], [54.002, 18.0]]
    index, dist = geo.nearest_vertex(line, (54.0011, 18.0))
    assert index == 1
    assert dist == pytest.approx(11.1, rel=0.05)


def test_simplify_keeps_ends_limit_and_required_points():
    line = [[54.0 + i / 10_000, 18.0] for i in range(500)]
    result = geo.simplify(line, max_points=50, keep={123})

    assert len(result) <= 52
    assert result[0] == line[0]
    assert result[-1] == line[-1]
    assert line[123] in result


def test_simplify_short_line_unchanged():
    line = [[54.0, 18.0], [54.1, 18.1]]
    assert geo.simplify(line) == line


def test_straight_line():
    line = geo.straight_line((54.0, 18.0), (54.4, 18.4), points=5)
    assert line == [[54.0, 18.0], [54.1, 18.1], [54.2, 18.2], [54.3, 18.3], [54.4, 18.4]]


def test_distance_to_polyline_uses_the_segment_not_only_vertices():
    # A 1 km line west-east; the point is 50 m north of its middle, ~500 m from each vertex.
    line = [(54.35, 18.60), (54.35, 18.6153)]
    middle_north = (54.35045, 18.60765)

    assert 45 < geo.distance_to_polyline_m(line, middle_north) < 55
    assert geo.nearest_vertex(line, middle_north)[1] > 400


def test_distance_to_polyline_past_the_end_and_single_point():
    line = [(54.35, 18.60), (54.35, 18.61)]
    east_of_end = (54.35, 18.6115)  # ~100 m east of the last vertex

    assert 90 < geo.distance_to_polyline_m(line, east_of_end) < 110
    assert geo.distance_to_polyline_m([(54.35, 18.60)], (54.35, 18.60)) == 0

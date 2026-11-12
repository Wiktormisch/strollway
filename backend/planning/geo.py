"""Pure geometry helpers. All points are (lat, lng) in degrees, distances in metres.

No geo libraries on purpose: the math we need is small and easy to test.
"""

import math

EARTH_RADIUS_M = 6_371_000


def haversine_m(a, b):
    """Great-circle distance between two (lat, lng) points, in metres."""
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def decode_polyline(encoded, precision=5):
    """Decode a Google encoded polyline (the format of ORS /json) to [[lat, lng], ...].

    Each value is a delta from the previous one, stored as 5-bit chunks with an
    offset of 63 so that every chunk is a printable character.
    """
    factor = 10**precision
    points = []
    index = lat = lng = 0
    while index < len(encoded):
        deltas = []
        for _ in range(2):
            result = shift = 0
            while True:
                chunk = ord(encoded[index]) - 63
                index += 1
                result |= (chunk & 0x1F) << shift
                shift += 5
                if chunk < 0x20:
                    break
            # The lowest bit is the sign: negative values are stored inverted.
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lng += deltas[1]
        points.append([lat / factor, lng / factor])
    return points


def cumulative_distances(polyline):
    """Distance from the start to each vertex, in metres. The first value is 0."""
    totals = [0.0]
    for prev, point in zip(polyline, polyline[1:], strict=False):
        totals.append(totals[-1] + haversine_m(prev, point))
    return totals


def nearest_vertex(polyline, point):
    """Return (index, distance_m) of the polyline vertex closest to the point.

    A vertex approximation is good enough: ORS walking geometry has a vertex
    every few metres in a city.
    """
    best_index, best_dist = 0, math.inf
    for i, vertex in enumerate(polyline):
        dist = haversine_m(vertex, point)
        if dist < best_dist:
            best_index, best_dist = i, dist
    return best_index, best_dist


def simplify(polyline, max_points=50, keep=()):
    """Keep about max_points vertices: every n-th one, both ends and the `keep` indexes.

    `keep` holds indexes that must stay (for example the ends of stair segments),
    so corners that matter are not cut away.
    """
    if len(polyline) <= max_points:
        return [list(p) for p in polyline]
    step = math.ceil(len(polyline) / max_points)
    indexes = set(range(0, len(polyline), step)) | {0, len(polyline) - 1}
    indexes |= {i for i in keep if 0 <= i < len(polyline)}
    return [list(polyline[i]) for i in sorted(indexes)]


def straight_line(a, b, points=5):
    """Evenly spaced [lat, lng] points from a to b (the mock route)."""
    return [
        [
            round(a[0] + (b[0] - a[0]) * i / (points - 1), 6),
            round(a[1] + (b[1] - a[1]) * i / (points - 1), 6),
        ]
        for i in range(points)
    ]


def offset_m(origin, point):
    """Position of `point` relative to `origin` as (east_m, north_m).

    A flat-earth approximation: good to well under 1% for the 1-2 km of a walk.
    """
    north = math.radians(point[0] - origin[0]) * EARTH_RADIUS_M
    east = math.radians(point[1] - origin[1]) * EARTH_RADIUS_M * math.cos(math.radians(origin[0]))
    return east, north

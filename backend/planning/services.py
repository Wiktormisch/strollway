"""POST /api/route-plans/: route comparison + places, with all fallbacks.

Fallback order for routing: live ORS -> recorded fixture (demo pairs only) -> straight line.
Places: fixture (demo pairs with recorded places) -> POI_PROVIDER (db table, live Overpass
or mock). A point outside the imported area gives pois_status "outside_area".
NoRoute and NoRoutablePoint are real answers and reach the view (422).
"""

from planning import fixtures, places, pois, routing

SOURCE_ORS = "ors"
SOURCE_FIXTURE = "fixture"
SOURCE_MOCK = "mock"

# Family pace in km/h. A stroller limits the pace to 4 km/h.
PACE_KMH = {"relaxed": 3.5, "normal": 4.5}
STROLLER_KMH = 4.0


def speed_m_per_min(profile=None):
    """Walking speed in metres per minute for a family profile (None = stroller pace)."""
    if profile is None:
        kmh = STROLLER_KMH
    else:
        kmh = PACE_KMH.get(profile.pace, STROLLER_KMH)
        if profile.wheels == "stroller":
            kmh = min(kmh, STROLLER_KMH)
    return kmh * 1000 / 60


def build_route_plan(start, end, avoid_stairs=True, profile=None):
    """The full answer of the endpoint, as a dict in the shape of docs/PLAN.md D.4."""
    speed = speed_m_per_min(profile)
    pair = fixtures.find_demo_pair(start, end)
    fixture = fixtures.load_fixture(pair)

    comparison, source = _route(start, end, avoid_stairs, fixture)
    poi_result = _pois(comparison, start, end, speed, fixture)
    return _serialize(comparison, source, poi_result, speed)


def _route(start, end, avoid_stairs, fixture):
    if routing.is_enabled():
        try:

            def live(avoid):
                return routing.fetch_ors_route([start, end], avoid)

            return routing.compare_routes(live, avoid_stairs), SOURCE_ORS
        except routing.UpstreamUnavailable:
            pass  # fall through to the fixture or the mock
    if fixture is not None:
        return routing.compare_routes(fixture_fetch(fixture), avoid_stairs), SOURCE_FIXTURE
    return routing.mock_comparison(start, end), SOURCE_MOCK


def fixture_fetch(fixture):
    def fetch(avoid):
        recorded = fixture["ors"]["avoid" if avoid else "normal"]
        if recorded is None:
            raise routing.UpstreamUnavailable("Not recorded")
        return routing.parse_ors_response(recorded["status"], recorded["body"])

    return fetch


def _pois(comparison, start, end, speed, fixture):
    """Recorded places for a demo pair, else the configured provider. Never invented.

    A demo pair with recorded places never calls Overpass: the public servers are often
    down (docs/AUDIT.md, part 2), and the demo must answer at once. The places are parsed
    against the route we return, so this works for a live ORS route of the pair too.
    For a mock (straight) line the live places are still real OSM data near the line.
    """
    geometry = comparison.route.geometry
    recorded = fixture.get("overpass") if fixture else None
    if recorded is not None:
        return pois.parse_overpass(recorded, geometry, start, end, speed)
    provider = pois.provider()
    if provider == "db":
        return places.find_pois(geometry, start, end, speed, keep=_keep_indexes(comparison))
    if provider == "overpass":
        return pois.find_pois(geometry, start, end, speed, keep=_keep_indexes(comparison))
    return pois.PoiResult([], [], pois.STATUS_OK)


def _keep_indexes(comparison):
    """Vertex indexes the simplified line must keep: start and end of stair segments."""
    route = comparison.route
    keep = set()
    for segment in route.stairs_segments:
        for point in (segment[0], segment[-1]):
            if point in route.geometry:
                keep.add(route.geometry.index(point))
    return keep


def _serialize(comparison, source, poi_result, speed):
    detour = comparison.detour_m
    return {
        "source": source,
        "step_free_available": comparison.step_free_available,
        "route": route_dict(comparison.route, speed),
        "baseline": route_dict(comparison.baseline, speed),
        "detour_m": None if detour is None else round(detour),
        "extra_min": None if detour is None else round(detour / speed),
        "pois_status": poi_result.status,
        "pois": poi_result.pois,
        "transit_stops": poi_result.transit_stops,
    }


def route_dict(route, speed):
    return {
        "geometry": [[round(lat, 6), round(lng, 6)] for lat, lng in route.geometry],
        "distance_m": round(route.distance_m),
        "duration_min": max(1, round(route.distance_m / speed)),
        "stairs_m": route.stairs_m,
        "stairs_segments": [
            [[round(lat, 6), round(lng, 6)] for lat, lng in segment]
            for segment in route.stairs_segments
        ],
    }

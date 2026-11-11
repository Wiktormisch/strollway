"""Places along a route and transit stops near its ends, from OpenStreetMap (Overpass).

Rules from docs/DECISIONS.md, section 3:
- one combined query per route, [timeout:20], node and way elements, `out center tags`;
- on 429, 504, 502, a timeout or any other failure: no waiting and no retry,
  the caller gets status "unavailable";
- places are never invented.
"""

import hashlib
import logging
from dataclasses import dataclass

import httpx
from django.conf import settings
from django.core.cache import cache

from planning import geo

logger = logging.getLogger(__name__)

TIMEOUT_S = 25  # a bit more than the [timeout:20] inside the query
CACHE_TIMEOUT_S = 24 * 60 * 60
PLACE_RADIUS_M = 150
TRANSIT_RADIUS_M = 400
DUPLICATE_RADIUS_M = 30
MAX_BENCHES = 10
MAX_TRANSIT_PER_END = 3
SIMPLIFIED_POINTS = 50
# The public server answers 406 to requests without a User-Agent (checked 2026-11-11).
USER_AGENT = "StrollWay/0.1 (portfolio project)"

STATUS_OK = "ok"
STATUS_UNAVAILABLE = "unavailable"

# (OSM key, OSM value) -> our category. The categories match walks.Stop.Category.
CATEGORY_BY_TAG = {
    ("leisure", "playground"): "playground",
    ("amenity", "toilets"): "toilets",
    ("amenity", "cafe"): "cafe",
    ("amenity", "restaurant"): "restaurant",
    ("amenity", "fast_food"): "restaurant",
    ("amenity", "bench"): "bench",
    ("amenity", "drinking_water"): "water",
    ("leisure", "park"): "park",
    ("tourism", "zoo"): "zoo",
    ("tourism", "museum"): "museum",
    ("natural", "beach"): "beach",
}
TRANSIT_KIND_BY_TAG = {("highway", "bus_stop"): "bus", ("railway", "tram_stop"): "tram"}


class OverpassUnavailable(Exception):
    pass


@dataclass
class PoiResult:
    pois: list
    transit_stops: list
    status: str


def make_client():
    """The HTTP client. Tests replace this function with one that uses a MockTransport."""
    return httpx.Client(timeout=TIMEOUT_S)


def is_enabled():
    return settings.POI_PROVIDER != "mock"


# --- Query ----------------------------------------------------------------------------


def _coords(points):
    return ",".join(f"{lat:.6f},{lng:.6f}" for lat, lng in points)


def _tag_filters(table):
    """Group the table by OSM key: {"amenity": "^(cafe|toilets)$", ...}."""
    by_key = {}
    for key, value in table:
        by_key.setdefault(key, []).append(value)
    return {key: "^(" + "|".join(sorted(values)) + ")$" for key, values in by_key.items()}


def build_query(line, start, end):
    """One query: places around the simplified line, transit stops around start and end.

    `around` with several points works along the line between them, not only at the points.
    """
    parts = []
    for key, regex in _tag_filters(CATEGORY_BY_TAG).items():
        for element in ("node", "way"):
            parts.append(f'{element}["{key}"~"{regex}"](around:{PLACE_RADIUS_M},{_coords(line)});')
    for key, regex in _tag_filters(TRANSIT_KIND_BY_TAG).items():
        for point in (start, end):
            parts.append(f'node["{key}"~"{regex}"](around:{TRANSIT_RADIUS_M},{_coords([point])});')
    return "[out:json][timeout:20];\n(\n" + "\n".join(parts) + "\n);\nout center tags;"


# --- Requests -------------------------------------------------------------------------


def request_overpass(query):
    """Call Overpass once. Return the raw body or raise OverpassUnavailable. Never sleeps."""
    try:
        with make_client() as client:
            response = client.post(
                settings.OVERPASS_URL, data={"data": query}, headers={"User-Agent": USER_AGENT}
            )
        if response.status_code != 200:
            raise OverpassUnavailable(f"Overpass answered {response.status_code}")
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OverpassUnavailable(str(exc)) from exc
    # A query that hits its own timeout still gives 200, with a "remark" and partial data.
    if "runtime error" in str(body.get("remark", "")).lower():
        raise OverpassUnavailable(body["remark"])
    if not isinstance(body.get("elements"), list):
        raise OverpassUnavailable("No elements in the Overpass answer")
    return body


def fetch_overpass(query):
    """Raw Overpass body with a 24 h cache. Only successful answers are cached."""
    key = "overpass:" + hashlib.sha256(query.encode()).hexdigest()
    body = cache.get(key)
    if body is None:
        body = request_overpass(query)
        cache.set(key, body, CACHE_TIMEOUT_S)
    return body


def query_for_route(geometry, start, end, keep=()):
    line = geo.simplify(geometry, SIMPLIFIED_POINTS, keep=keep)
    return build_query(line, start, end)


def find_pois(geometry, start, end, speed_m_per_min, keep=()):
    """Places and transit stops for a route. Never raises for upstream failures."""
    try:
        body = fetch_overpass(query_for_route(geometry, start, end, keep))
    except OverpassUnavailable as exc:
        logger.warning("Overpass unavailable: %s", exc)
        return PoiResult([], [], STATUS_UNAVAILABLE)
    return parse_overpass(body, geometry, start, end, speed_m_per_min)


# --- Parsing --------------------------------------------------------------------------


def parse_overpass(body, geometry, start, end, speed_m_per_min):
    """Turn a raw Overpass body into a PoiResult (used for live data and fixtures)."""
    distances = geo.cumulative_distances(geometry)
    places, transit = [], []
    for element in body.get("elements", []):
        point = _element_point(element)
        if point is None:
            continue
        tags = element.get("tags", {})
        category = _match(tags, CATEGORY_BY_TAG)
        if category:
            places.append(
                _place(element, tags, category, point, geometry, distances, speed_m_per_min)
            )
            continue
        kind = _match(tags, TRANSIT_KIND_BY_TAG)
        if kind:
            transit.append(_transit_stop(tags, kind, point, start, end))

    places.sort(key=lambda p: p["off_route_m"])
    places = _drop_near_duplicates(places)
    places = _cap_benches(places)
    places.sort(key=lambda p: (p["at_min"], p["off_route_m"]))
    return PoiResult(places, _pick_transit(transit), STATUS_OK)


def _element_point(element):
    """(lat, lng) of a node, or of the center of a way. None if missing."""
    source = element if element.get("type") == "node" else element.get("center")
    if not source or "lat" not in source or "lon" not in source:
        return None
    return (float(source["lat"]), float(source["lon"]))


def _match(tags, table):
    for (key, value), result in table.items():
        if tags.get(key) == value:
            return result
    return None


def _place(element, tags, category, point, geometry, distances, speed_m_per_min):
    index, off_route = geo.nearest_vertex(geometry, point)
    return {
        "poi_id": f"{element['type']}/{element['id']}",
        "name": tags.get("name") or None,
        "category": category,
        "lat": round(point[0], 6),
        "lng": round(point[1], 6),
        "at_min": round(distances[index] / speed_m_per_min),
        "off_route_m": round(off_route),
        "opening_hours": tags.get("opening_hours") or None,
        "open_now": None,  # stage 6 adds the opening hours parser
    }


def _drop_near_duplicates(places):
    """One place per group: same category and name within ~30 m.

    This merges a playground mapped as a point and as an outline, and groups
    benches that stand close together. `places` must be sorted by off_route_m,
    so the place closest to the route is kept.
    """
    kept = []
    for place in places:
        point = (place["lat"], place["lng"])
        is_duplicate = any(
            other["category"] == place["category"]
            and other["name"] == place["name"]
            and geo.haversine_m(point, (other["lat"], other["lng"])) <= DUPLICATE_RADIUS_M
            for other in kept
        )
        if not is_duplicate:
            kept.append(place)
    return kept


def _cap_benches(places):
    """Keep at most MAX_BENCHES benches, the closest to the route (input sorted by off_route_m)."""
    benches = 0
    result = []
    for place in places:
        if place["category"] == "bench":
            benches += 1
            if benches > MAX_BENCHES:
                continue
        result.append(place)
    return result


def _transit_stop(tags, kind, point, start, end):
    to_start = geo.haversine_m(point, start)
    to_end = geo.haversine_m(point, end)
    near, distance = ("start", to_start) if to_start <= to_end else ("end", to_end)
    return {
        "name": tags.get("name") or None,
        "kind": kind,
        "near": near,
        "distance_m": round(distance),
    }


def _pick_transit(stops):
    """Closest first; one entry per (name, kind, end), at most 3 per end.

    A bus stop often has one platform per direction with the same name.
    """
    stops = [s for s in stops if s["distance_m"] <= TRANSIT_RADIUS_M]
    stops.sort(key=lambda s: s["distance_m"])
    seen, result, per_end = set(), [], {"start": 0, "end": 0}
    for stop in stops:
        key = (stop["name"], stop["kind"], stop["near"])
        if key in seen or per_end[stop["near"]] >= MAX_TRANSIT_PER_END:
            continue
        seen.add(key)
        per_end[stop["near"]] += 1
        result.append(stop)
    return result

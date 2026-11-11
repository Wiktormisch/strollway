"""OpenRouteService client and the step-free route comparison.

Our API uses [lat, lng] everywhere. ORS wants [lon, lat]. The swap happens only
in this module (`_ors_coordinates` and `parse_ors_response`).
"""

import logging
from dataclasses import dataclass, field

import httpx
from django.conf import settings
from django.core.cache import cache

from planning import geo

logger = logging.getLogger(__name__)

TIMEOUT_S = 10
STEPS_WAYTYPE = 8
ORS_NO_ROUTE = 2009
ORS_NO_ROUTABLE_POINT = 2010
CACHE_TIMEOUT_S = 24 * 60 * 60


class RoutingError(Exception):
    """Base class. `code` is the value our API returns in a 422 body."""

    code = "routing_error"


class NoRoute(RoutingError):
    code = "no_route"


class NoRoutablePoint(RoutingError):
    code = "no_routable_point"


class UpstreamUnavailable(Exception):
    """ORS did not give a usable answer (no key, timeout, 429, 5xx, bad JSON)."""


@dataclass
class Route:
    geometry: list  # [[lat, lng], ...]
    distance_m: float
    stairs_m: float | None  # None = unknown (mock route)
    stairs_segments: list = field(default_factory=list)  # list of [[lat, lng], ...]


@dataclass
class RouteComparison:
    route: Route  # the route to walk
    baseline: Route  # the shortest route
    step_free_available: bool | None  # None = not searched or unknown
    detour_m: float | None


def make_client():
    """The HTTP client. Tests replace this function with one that uses a MockTransport."""
    return httpx.Client(timeout=TIMEOUT_S)


def is_enabled():
    """True when real ORS calls are allowed: provider is not "mock" and a key is set."""
    return settings.ROUTING_PROVIDER != "mock" and bool(settings.ORS_API_KEY)


# --- Parsing --------------------------------------------------------------------------


def parse_ors_response(status, body):
    """Turn a raw ORS answer into a Route, or raise one of the errors above.

    Used for live answers and for recorded fixtures, so both go through the same code.
    """
    if status == 200:
        try:
            return _parse_route(body["routes"][0])
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise UpstreamUnavailable(f"Unexpected ORS body: {exc}") from exc

    code = error_code(body)
    # 2009 is detected by both the status and the code; the message text may change.
    if status == 404 and code == ORS_NO_ROUTE:
        raise NoRoute()
    if code == ORS_NO_ROUTABLE_POINT:
        raise NoRoutablePoint()
    raise UpstreamUnavailable(f"ORS answered {status} (code {code})")


def error_code(body):
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict):
        return error.get("code")
    return None


def _parse_route(raw):
    geometry = geo.decode_polyline(raw["geometry"])
    waytype = raw.get("extras", {}).get("waytype", {})
    # Values arrive as floats (8.0), so cast them to int before comparing.
    stairs_m = sum(
        float(item["distance"])
        for item in waytype.get("summary", [])
        if int(item["value"]) == STEPS_WAYTYPE
    )
    segments = [
        geometry[int(start) : int(end) + 1]
        for start, end, value in waytype.get("values", [])
        if int(value) == STEPS_WAYTYPE
    ]
    return Route(
        geometry=geometry,
        distance_m=float(raw["summary"]["distance"]),
        stairs_m=round(stairs_m, 1),
        stairs_segments=segments,
    )


# --- Live requests --------------------------------------------------------------------


def _ors_coordinates(start, end):
    """[lat, lng] in our API -> [lon, lat] for ORS. The wrong order gives error 2010."""
    return [[start[1], start[0]], [end[1], end[0]]]


def build_ors_body(start, end, avoid_steps):
    body = {"coordinates": _ors_coordinates(start, end), "extra_info": ["waytype"]}
    if avoid_steps:
        body["options"] = {"avoid_features": ["steps"]}
    return body


def _cache_key(start, end, avoid_steps):
    rounded = [round(value, 5) for value in (*start, *end)]
    return "ors:" + ":".join(map(str, rounded)) + f":avoid={int(avoid_steps)}"


def request_ors(start, end, avoid_steps):
    """Call ORS once and return the raw (status, body). Raises UpstreamUnavailable."""
    url = f"{settings.ORS_BASE_URL}/v2/directions/foot-walking/json"
    headers = {"Authorization": settings.ORS_API_KEY, "Accept": "application/json"}
    try:
        with make_client() as client:
            response = client.post(
                url, json=build_ors_body(start, end, avoid_steps), headers=headers
            )
        return response.status_code, response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise UpstreamUnavailable(str(exc)) from exc


def fetch_ors_route(start, end, avoid_steps):
    """A Route from ORS, with a 24 h cache.

    Only stable answers are cached: a route (200) and the known errors 2009 and 2010.
    Temporary failures (429, 5xx, timeouts) are not cached.
    """
    key = _cache_key(start, end, avoid_steps)
    raw = cache.get(key)
    if raw is None:
        raw = request_ors(start, end, avoid_steps)
        status, body = raw
        if status == 200 or error_code(body) in (ORS_NO_ROUTE, ORS_NO_ROUTABLE_POINT):
            cache.set(key, raw, CACHE_TIMEOUT_S)
    return parse_ors_response(*raw)


# --- Comparison -----------------------------------------------------------------------


def compare_routes(fetch, avoid_stairs):
    """Build the comparison from a `fetch(avoid_steps) -> Route` function.

    `fetch` is the live ORS call or a recorded fixture. Errors of the normal request
    (NoRoute, NoRoutablePoint, UpstreamUnavailable) go to the caller.
    """
    baseline = fetch(False)
    if not avoid_stairs:
        return RouteComparison(baseline, baseline, None, None)
    if baseline.stairs_m == 0:
        # No stairs on the shortest route: no need for a second request.
        return RouteComparison(baseline, baseline, True, 0)
    try:
        route = fetch(True)
    except NoRoute:
        # Not an error: there is just no step-free route between these points.
        return RouteComparison(baseline, baseline, False, None)
    except UpstreamUnavailable:
        logger.warning("ORS avoid-steps request failed; returning the normal route only")
        return RouteComparison(baseline, baseline, None, None)
    detour = max(route.distance_m - baseline.distance_m, 0)
    return RouteComparison(route, baseline, True, detour)


def mock_comparison(start, end):
    """A straight line with no stair data. Used when ORS cannot be used."""
    line = geo.straight_line(start, end)
    route = Route(geometry=line, distance_m=geo.haversine_m(start, end), stairs_m=None)
    return RouteComparison(route, route, None, None)

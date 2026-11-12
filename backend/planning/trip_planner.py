"""POST /api/trip-ideas/: candidates -> planner (LLM chain or rules) -> route -> time limit.

Spec: docs/PLAN.md D.6. Code does all the math; the planner only picks and orders stops.
Fallbacks: live Overpass/ORS -> the recorded demo trip -> a straight-line mock route.
"""

import logging
import time
from datetime import date

from django.conf import settings
from django.core.cache import cache

from planning import fixtures, geo, pois, routing, services, trip_rules, weather
from planning.llm import factory, prompt, validation
from planning.llm.base import LLMError

logger = logging.getLogger(__name__)

ENGINE_RULES = "rules"
# No new backend is tried after this many seconds; the rules answer at once.
LLM_CHAIN_BUDGET_S = 60
DAILY_COUNTER_TIMEOUT_S = 25 * 60 * 60
LIMIT_TOLERANCE = trip_rules.LIMIT_TOLERANCE  # 10% over the limit is still fine
MAX_REROUTES = 2

DROPPED_TIP = {
    "pl": "{name}: pominięte, żeby zmieścić się w czasie.",
    "en": "{name}: skipped to fit the time limit.",
}


class TripError(Exception):
    """Base class. `code` is the value our API returns in a 422 body."""

    code = "trip_error"


class NoPlacesNearby(TripError):
    code = "no_places_nearby"


class PlacesUnavailable(TripError):
    code = "places_unavailable"


def active_engine():
    """The engine a trip tries first (for GET /api/health/). Builds no client."""
    names = factory.backend_names()
    return names[0] if names else ENGINE_RULES


def build_trip_idea(start, max_minutes, round_trip=True, language="pl", wishes="", profile=None):
    """The full answer of the endpoint, as a dict (docs/PLAN.md D.4 + D.6)."""
    speed = services.speed_m_per_min(profile)
    fixture = fixtures.load_trip_fixture(start)
    found = _candidates(start, pois.trip_radius_m(speed, max_minutes), fixture)
    if found.status != pois.STATUS_OK:
        raise PlacesUnavailable()
    if not found.pois:
        raise NoPlacesNearby()  # the LLM is never called without candidates
    candidates = found.pois

    context = {
        "start": start,
        "max_minutes": max_minutes,
        "round_trip": round_trip,
        "language": language,
        "wishes": (wishes or "")[:200],
        "children_ages": list(profile.children_ages) if profile else [],
        "speed": speed,
        "weather": weather.current_weather(start),
        "profile": profile,
    }
    answer, engine = _plan_answer(candidates, context)
    if not answer["stops"]:
        raise NoPlacesNearby()  # every candidate is closed now

    by_id = {c["poi_id"]: c for c in candidates}
    stops = [{**by_id[s["poi_id"]], **s} for s in answer["stops"]]
    stops, dropped = _pre_trim(stops, context)
    comparison, source, stops, dropped_late = _fit_route(stops, context, fixture)
    dropped += dropped_late

    return _serialize(comparison, source, stops, dropped, answer, engine, found, context)


# --- Steps ----------------------------------------------------------------------------


def _candidates(start, radius_m, fixture):
    """Live places first; the recorded demo places when live data cannot be used."""
    result = pois.PoiResult([], [], pois.STATUS_UNAVAILABLE)
    if pois.is_enabled():
        result = pois.find_candidates(start, radius_m)
    recorded = fixture.get("overpass") if fixture else None
    if result.status != pois.STATUS_OK and recorded is not None:
        result = pois.parse_candidates(recorded, start, radius_m)
    return result


def _plan_answer(candidates, context):
    """(answer, engine): the first valid LLM answer in the chain, else the rules."""
    chain = factory.build_chain()
    if chain:
        payload = prompt.build_payload(candidates, context)
        user = prompt.user_message(payload)
        started = time.monotonic()
        for client in chain:
            if time.monotonic() - started > LLM_CHAIN_BUDGET_S:
                logger.warning("LLM chain out of time; using the rules")
                break
            if not _take_daily_llm_call():
                logger.warning("Daily LLM limit reached; using the rules")
                break
            answer = _ask(client, user, candidates)
            if answer is not None:
                return answer, client.name
    return _rules_answer(candidates, context), ENGINE_RULES


def _ask(client, user, candidates):
    """A validated answer from one backend, or None. Logs never hold the prompt or wishes."""
    try:
        raw = client.complete_json(prompt.SYSTEM_PROMPT, user, prompt.OUTPUT_SCHEMA)
    except LLMError as exc:
        logger.warning("LLM backend %s failed: %s", client.name, exc)
        return None
    except Exception as exc:  # a bug in one backend must not cost the user the trip
        logger.warning("LLM backend %s crashed: %s", client.name, type(exc).__name__)
        return None
    answer, invalid_fields = validation.validate_answer(raw, candidates)
    if answer is None:
        logger.warning("LLM backend %s gave an invalid answer: %s", client.name, invalid_fields)
    return answer


def _take_daily_llm_call():
    """Count one LLM call for today; False when LLM_DAILY_LIMIT is used up.

    The counter lives in the cache (key per day, kept 25 h). The file cache is not atomic,
    so two parallel requests may both pass at the edge; fine for a demo budget guard.
    """
    key = f"llm_calls:{date.today().isoformat()}"
    cache.add(key, 0, DAILY_COUNTER_TIMEOUT_S)
    try:
        count = cache.incr(key)
    except ValueError:  # the key expired between add and incr
        cache.set(key, 1, DAILY_COUNTER_TIMEOUT_S)
        count = 1
    return count <= settings.LLM_DAILY_LIMIT


def _rules_answer(candidates, context):
    return trip_rules.plan(
        candidates,
        context["wishes"],
        context["children_ages"],
        context["language"],
        context["max_minutes"],
        context["speed"],
        context["round_trip"],
    )


def _limit(context):
    return context["max_minutes"] * LIMIT_TOLERANCE


def _stops_minutes(stops):
    return sum(s["planned_minutes"] for s in stops)


def _pre_trim(stops, context):
    """Drop last stops while the straight-line estimate is clearly too long.

    This is cheap (no network) and makes the re-route loop below rare.
    """
    stops, dropped = list(stops), []
    while len(stops) > 1:
        walking = trip_rules.estimate_minutes(
            context["start"], [_point(s) for s in stops], context["speed"], context["round_trip"]
        )
        if walking + _stops_minutes(stops) <= _limit(context):
            break
        dropped.append(stops.pop())
    return stops, dropped


def _fit_route(stops, context, fixture):
    """Route the stops; drop the last stop and re-route at most MAX_REROUTES times."""
    stops, dropped = list(stops), []
    for attempt in range(MAX_REROUTES + 1):
        comparison, source = _route(_points(stops, context), fixture)
        total = comparison.route.distance_m / context["speed"] + _stops_minutes(stops)
        if total <= _limit(context) or len(stops) == 1 or attempt == MAX_REROUTES:
            break
        dropped.append(stops.pop())
    return comparison, source, stops, dropped


def _point(stop):
    return (stop["lat"], stop["lng"])


def _points(stops, context):
    points = [context["start"], *(_point(s) for s in stops)]
    if context["round_trip"]:
        points.append(context["start"])
    return points


def _route(points, fixture):
    """A step-free route through all points: live ORS -> recording -> straight lines.

    Unlike route-plans, "no route" (2009) and "no routable point" (2010) do not end the
    request: the stops come from map data (a park or a beach is its centre point, often
    far from a path), not from the user, so the trip falls back to straight lines.
    """
    recorded = (fixture or {}).get("ors", {})
    try:
        if routing.is_enabled():
            try:
                return routing.compare_routes(
                    lambda avoid: routing.fetch_ors_route(points, avoid), True
                ), services.SOURCE_ORS
            except routing.UpstreamUnavailable:
                pass
        if routing.cache_key(points, False) in recorded:
            return routing.compare_routes(_fixture_fetch(points, recorded), True), (
                services.SOURCE_FIXTURE
            )
    except routing.RoutingError as exc:
        logger.warning("No walking route through the trip stops (%s); straight lines", exc.code)
    route = routing.mock_route(points, trip_rules.DETOUR_FACTOR)
    return routing.RouteComparison(route, route, None, None), services.SOURCE_MOCK


def _fixture_fetch(points, recorded):
    def fetch(avoid):
        raw = recorded.get(routing.cache_key(points, avoid))
        if raw is None:
            raise routing.UpstreamUnavailable("Not recorded")
        return routing.parse_ors_response(raw["status"], raw["body"])

    return fetch


# --- Response -------------------------------------------------------------------------


def _serialize(comparison, source, stops, dropped, answer, engine, found, context):
    speed = context["speed"]
    route = comparison.route
    walking_min = round(route.distance_m / speed)
    stops_min = _stops_minutes(stops)
    total = route.distance_m / speed + stops_min
    detour = comparison.detour_m
    tips = list(answer["tips"])
    for stop in dropped:
        name = stop["name"] or trip_rules.LABELS[context["language"]][stop["category"]]
        tips.append(DROPPED_TIP[context["language"]].format(name=name))
    return {
        "engine": engine,
        "source": source,
        "step_free_available": comparison.step_free_available,
        "route": services.route_dict(route, speed),
        "baseline": services.route_dict(comparison.baseline, speed),
        "detour_m": None if detour is None else round(detour),
        "extra_min": None if detour is None else round(detour / speed),
        "summary": answer["summary"],
        "tips": tips,
        "unmet_wishes": list(answer["unmet_wishes"]),
        "stops": _stops_out(stops, route, speed),
        "dropped_stops": [{"poi_id": s["poi_id"], "name": s["name"]} for s in dropped],
        "walking_min": walking_min,
        "stops_min": stops_min,
        "total_min": round(total),
        "max_minutes": context["max_minutes"],
        "over_limit": total > _limit(context),
        "weather": context["weather"],
        "transit_stops": found.transit_stops,
    }


def _stops_out(stops, route, speed):
    """Stops with `arrive_min`: walking along the route + time at the earlier stops."""
    distances = geo.cumulative_distances(route.geometry)
    way_points = route.way_points
    # Mock routes scale the distance (x 1.3); scale the vertex distances the same way.
    scale = route.distance_m / distances[-1] if distances[-1] else 1
    result, waited = [], 0
    for index, stop in enumerate(stops):
        vertex = way_points[index + 1] if index + 1 < len(way_points) else len(distances) - 1
        result.append(
            {
                "poi_id": stop["poi_id"],
                "name": stop["name"],
                "category": stop["category"],
                "lat": stop["lat"],
                "lng": stop["lng"],
                "distance_m": stop["distance_m"],
                "opening_hours": stop["opening_hours"],
                "open_now": stop["open_now"],
                "arrive_min": round(distances[vertex] * scale / speed) + waited,
                "planned_minutes": stop["planned_minutes"],
                "reason": stop["reason"],
            }
        )
        waited += stop["planned_minutes"]
    return result

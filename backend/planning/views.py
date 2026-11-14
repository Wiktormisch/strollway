from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planning import routing, services, trip_planner
from planning.serializers import (
    RoutePlanErrorSerializer,
    RoutePlanRequestSerializer,
    RoutePlanResponseSerializer,
    TripIdeaErrorSerializer,
    TripIdeaRequestSerializer,
    TripIdeaResponseSerializer,
)
from walks.scoping import CLIENT_ID_PARAMETER, get_client_id


@extend_schema(
    responses=inline_serializer(
        "Health",
        fields={
            "status": serializers.CharField(),
            "routing": serializers.ChoiceField(choices=["ors", "mock"]),
            "llm": serializers.CharField(help_text='The first LLM backend, or "rules".'),
        },
    ),
)
@api_view(["GET"])
def health(request: Request) -> Response:
    """Tell the frontend that the API is up and which engines are active."""
    return Response(
        {
            "status": "ok",
            "routing": "ors" if routing.is_enabled() else "mock",
            "llm": trip_planner.active_engine(),
        }
    )


ERROR_DETAILS = {
    "no_route": "No walking route was found between these points.",
    "no_routable_point": "A point is too far from any path (more than 350 m).",
    "no_places_nearby": "No places for a trip were found near the start point.",
    "places_unavailable": "The map data service did not answer. Try again in a moment.",
    "outside_area": "Place data covers the Tricity (Gdansk, Sopot, Gdynia) only.",
}

REQUEST_EXAMPLE = OpenApiExample(
    "Demo pair 1 (big detour)",
    request_only=True,
    value={
        "start": {"lat": 54.347791, "lng": 18.618119},
        "end": {"lat": 54.34874, "lng": 18.618458},
        "avoid_stairs": True,
    },
)
RESPONSE_EXAMPLE = OpenApiExample(
    "Step-free route with a detour",
    response_only=True,
    value={
        "source": "ors",
        "step_free_available": True,
        "route": {
            "geometry": [[54.347791, 18.618119], [54.34874, 18.618458]],
            "distance_m": 420,
            "duration_min": 6,
            "kcal": 23,
            "stairs_m": 0,
            "stairs_segments": [],
        },
        "baseline": {
            "geometry": [[54.347791, 18.618119], [54.34874, 18.618458]],
            "distance_m": 132,
            "duration_min": 2,
            "kcal": 7,
            "stairs_m": 16.0,
            "stairs_segments": [[[54.348, 18.6182], [54.3481, 18.6183]]],
        },
        "detour_m": 288,
        "extra_min": 4,
        "pois_status": "ok",
        "pois": [
            {
                "poi_id": "node/123",
                "name": None,
                "category": "bench",
                "lat": 54.348,
                "lng": 18.618,
                "at_min": 3,
                "off_route_m": 12,
                "opening_hours": None,
                "open_now": None,
            }
        ],
        "transit_stops": [{"name": "Hucisko", "kind": "tram", "near": "start", "distance_m": 180}],
    },
)


class RoutePlanView(APIView):
    """A calculation, not a resource: it saves nothing, so it answers 200, not 201."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "route_plans"

    @extend_schema(
        summary="Plan a step-free route from A to B",
        description=(
            "Compares the shortest walking route with a step-free one and lists places "
            "along the route. Coordinates are [lat, lng]. Upstream failures never give "
            "500: the answer falls back to a recorded demo route (`source: fixture`) or "
            "a straight line (`source: mock`). Limited to 60 requests per hour per IP."
        ),
        parameters=[CLIENT_ID_PARAMETER],
        request=RoutePlanRequestSerializer,
        responses={
            200: RoutePlanResponseSerializer,
            400: inline_serializer("ValidationError", fields={"detail": serializers.DictField()}),
            422: RoutePlanErrorSerializer,
            429: inline_serializer("Throttled", fields={"detail": serializers.CharField()}),
        },
        examples=[REQUEST_EXAMPLE, RESPONSE_EXAMPLE],
    )
    def post(self, request: Request) -> Response:
        client_id = get_client_id(request)
        serializer = RoutePlanRequestSerializer(data=request.data, context={"client_id": client_id})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            plan = services.build_route_plan(
                data["start_point"],
                data["end_point"],
                data["avoid_stairs"],
                data["profile"],
                pace_kmh=data["pace_kmh"],
            )
        except routing.RoutingError as exc:
            return Response(
                {"code": exc.code, "detail": ERROR_DETAILS[exc.code]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(plan)


TRIP_REQUEST_EXAMPLE = OpenApiExample(
    "Demo trip start (Gdansk Chelm)",
    request_only=True,
    value={
        "start": {"lat": 54.3385, "lng": 18.62},
        "max_minutes": 90,
        "round_trip": True,
        "language": "en",
        "wishes": "playground, then ice cream, finally pizza",
    },
)
TRIP_RESPONSE_EXAMPLE = OpenApiExample(
    "A rule-based trip",
    response_only=True,
    value={
        "engine": "rules",
        "source": "mock",
        "step_free_available": None,
        "route": {
            "geometry": [[54.3385, 18.62], [54.3391, 18.6195], [54.3385, 18.62]],
            "distance_m": 180,
            "duration_min": 3,
            "kcal": 10,
            "stairs_m": None,
            "stairs_segments": [],
        },
        "baseline": {
            "geometry": [[54.3385, 18.62], [54.3391, 18.6195], [54.3385, 18.62]],
            "distance_m": 180,
            "duration_min": 3,
            "kcal": 10,
            "stairs_m": None,
            "stairs_segments": [],
        },
        "detour_m": None,
        "extra_min": None,
        "summary": "A plan from simple rules: playground.",
        "tips": [],
        "unmet_wishes": ["pizza: does not fit in the time limit"],
        "stops": [
            {
                "poi_id": "node/1",
                "name": None,
                "category": "playground",
                "lat": 54.3391,
                "lng": 18.6195,
                "distance_m": 70,
                "opening_hours": None,
                "open_now": None,
                "arrive_min": 1,
                "planned_minutes": 30,
                "reason": "The closest place of this kind, about 70 m from the start.",
            }
        ],
        "dropped_stops": [],
        "walking_min": 3,
        "stops_min": 30,
        "total_min": 33,
        "max_minutes": 45,
        "over_limit": False,
        "weather": None,
        "transit_stops": [
            {"name": "Sikorskiego", "kind": "bus", "near": "start", "distance_m": 40}
        ],
    },
)


class TripIdeaView(APIView):
    """A calculation, not a resource: it saves nothing, so it answers 200, not 201."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "trip_ideas"

    @extend_schema(
        summary="Plan a short family trip from a start point",
        description=(
            "Finds places around the start (OpenStreetMap), lets an LLM or simple rules "
            "pick and order 1-4 stops, then routes start -> stops (-> start) without stairs "
            "and checks the time limit. `engine` tells who planned it. Only `wishes` (max "
            "200 characters) is sent to the LLM as free text; never coordinates. Limited "
            "to 20 requests per hour per IP."
        ),
        parameters=[CLIENT_ID_PARAMETER],
        request=TripIdeaRequestSerializer,
        responses={
            200: TripIdeaResponseSerializer,
            400: inline_serializer(
                "TripValidationError", fields={"detail": serializers.DictField()}
            ),
            422: TripIdeaErrorSerializer,
            429: inline_serializer("TripThrottled", fields={"detail": serializers.CharField()}),
        },
        examples=[TRIP_REQUEST_EXAMPLE, TRIP_RESPONSE_EXAMPLE],
    )
    def post(self, request: Request) -> Response:
        client_id = get_client_id(request)
        serializer = TripIdeaRequestSerializer(data=request.data, context={"client_id": client_id})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            idea = trip_planner.build_trip_idea(
                data["start_point"],
                data["max_minutes"],
                round_trip=data["round_trip"],
                language=data["language"],
                wishes=data["wishes"],
                profile=data["profile"],
                pace_kmh=data["pace_kmh"],
            )
        except (routing.RoutingError, trip_planner.TripError) as exc:
            return Response(
                {"code": exc.code, "detail": ERROR_DETAILS[exc.code]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(idea)

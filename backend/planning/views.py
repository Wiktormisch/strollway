from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planning import routing, services
from planning.serializers import (
    RoutePlanErrorSerializer,
    RoutePlanRequestSerializer,
    RoutePlanResponseSerializer,
)
from walks.scoping import CLIENT_ID_PARAMETER, get_client_id


@extend_schema(
    responses=inline_serializer("Health", fields={"status": serializers.CharField()}),
)
@api_view(["GET"])
def health(request: Request) -> Response:
    """Tell the frontend that the API is up."""
    return Response({"status": "ok"})


ERROR_DETAILS = {
    "no_route": "No walking route was found between these points.",
    "no_routable_point": "A point is too far from any path (more than 350 m).",
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
            "stairs_m": 0,
            "stairs_segments": [],
        },
        "baseline": {
            "geometry": [[54.347791, 18.618119], [54.34874, 18.618458]],
            "distance_m": 132,
            "duration_min": 2,
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
                data["start_point"], data["end_point"], data["avoid_stairs"], data["profile"]
            )
        except routing.RoutingError as exc:
            return Response(
                {"code": exc.code, "detail": ERROR_DETAILS[exc.code]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(plan)

"""Thin HTTP layer for the walks API. Validation is in serializers, logic in modules."""

from django.db.models import Count
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from walks.demo_data import create_demo_data
from walks.models import FamilyProfile, Stop, Walk
from walks.scoping import CLIENT_ID_PARAMETER, ClientIdMixin, ClientScopedMixin
from walks.serializers import (
    FamilyProfileSerializer,
    StopSerializer,
    WalkListSerializer,
    WalkSerializer,
)

ALL_ACTIONS = ["list", "create", "retrieve", "update", "partial_update", "destroy"]


def with_client_header(*extra_list_parameters):
    """Add the X-Client-Id header (and optional list filters) to every action in the schema."""
    schemas = {action: extend_schema(parameters=[CLIENT_ID_PARAMETER]) for action in ALL_ACTIONS}
    schemas["list"] = extend_schema(parameters=[CLIENT_ID_PARAMETER, *extra_list_parameters])
    return extend_schema_view(**schemas)


@with_client_header()
class FamilyProfileViewSet(ClientScopedMixin, viewsets.ModelViewSet):
    queryset = FamilyProfile.objects.all()
    serializer_class = FamilyProfileSerializer


@with_client_header(
    OpenApiParameter("status", enum=Walk.Status.values, description="Filter by status.")
)
class WalkViewSet(ClientScopedMixin, viewsets.ModelViewSet):
    queryset = Walk.objects.all()

    def get_serializer_class(self):
        return WalkListSerializer if self.action == "list" else WalkSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset.prefetch_related("stops")
        status_filter = self.request.query_params.get("status")
        if status_filter is not None:
            if status_filter not in Walk.Status.values:
                raise ValidationError({"status": f"Must be one of: {', '.join(Walk.Status)}."})
            queryset = queryset.filter(status=status_filter)
        return queryset.annotate(stops_count=Count("stops"))


@with_client_header(OpenApiParameter("walk", int, description="Filter by walk id."))
class StopViewSet(ClientScopedMixin, viewsets.ModelViewSet):
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    client_lookup = "walk__client_id"

    def get_queryset(self):
        queryset = super().get_queryset()
        walk_filter = self.request.query_params.get("walk")
        if self.action == "list" and walk_filter is not None:
            if not walk_filter.isdigit():
                raise ValidationError({"walk": "Must be a walk id."})
            queryset = queryset.filter(walk_id=int(walk_filter))
        return queryset


class DemoDataView(ClientIdMixin, APIView):
    @extend_schema(
        parameters=[CLIENT_ID_PARAMETER],
        request=None,
        responses={
            201: OpenApiResponse(description="Demo data was created."),
            200: OpenApiResponse(description="Demo data already existed; nothing changed."),
        },
    )
    def post(self, request):
        created = create_demo_data(request.client_id)
        return Response(
            {"created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

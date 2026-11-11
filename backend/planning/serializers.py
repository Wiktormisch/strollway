"""Request validation and the response shape (for OpenAPI) of POST /api/route-plans/."""

from rest_framework import serializers

from planning import geo
from walks.models import FamilyProfile
from walks.serializers import latitude_field, longitude_field

# A stroller walk, not a road trip. Also protects the ORS daily limit.
MAX_STRAIGHT_DISTANCE_M = 20_000


class PointSerializer(serializers.Serializer):
    lat = latitude_field()
    lng = longitude_field()


class RoutePlanRequestSerializer(serializers.Serializer):
    start = PointSerializer()
    end = PointSerializer()
    avoid_stairs = serializers.BooleanField(default=True)
    profile_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_profile_id(self, value):
        """The profile must belong to this client. Its object is kept in `profile`."""
        if value is None:
            return None
        client_id = self.context["client_id"]
        if not FamilyProfile.objects.filter(pk=value, client_id=client_id).exists():
            # A foreign profile looks the same as a missing one.
            raise serializers.ValidationError("Profile not found.")
        return value

    def validate(self, attrs):
        start = (attrs["start"]["lat"], attrs["start"]["lng"])
        end = (attrs["end"]["lat"], attrs["end"]["lng"])
        if geo.haversine_m(start, end) > MAX_STRAIGHT_DISTANCE_M:
            raise serializers.ValidationError(
                {"end": f"Must be within {MAX_STRAIGHT_DISTANCE_M // 1000} km of the start."}
            )
        attrs["start_point"], attrs["end_point"] = start, end
        profile_id = attrs.get("profile_id")
        attrs["profile"] = FamilyProfile.objects.get(pk=profile_id) if profile_id else None
        return attrs


# --- Response (documentation only; the service builds plain dicts) --------------------


def lat_lng():
    """A fresh [lat, lng] field. DRF fields cannot be shared between parents."""
    return serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)


class RouteSerializer(serializers.Serializer):
    geometry = serializers.ListField(child=lat_lng(), help_text="[[lat, lng], ...]")
    distance_m = serializers.IntegerField()
    duration_min = serializers.IntegerField(help_text="At the family pace, computed in code.")
    stairs_m = serializers.FloatField(allow_null=True, help_text="null = unknown (mock route).")
    stairs_segments = serializers.ListField(
        child=serializers.ListField(child=lat_lng()), help_text="Line parts with stairs, to draw."
    )


class PoiSerializer(serializers.Serializer):
    poi_id = serializers.CharField(help_text='OSM id, e.g. "node/123".')
    name = serializers.CharField(allow_null=True)
    category = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    at_min = serializers.IntegerField(help_text="Minutes from the start to the nearest point.")
    off_route_m = serializers.IntegerField()
    opening_hours = serializers.CharField(allow_null=True, help_text="Raw OSM text.")
    open_now = serializers.BooleanField(allow_null=True, help_text="null = unknown.")


class TransitStopSerializer(serializers.Serializer):
    name = serializers.CharField(allow_null=True)
    kind = serializers.ChoiceField(choices=["bus", "tram"])
    near = serializers.ChoiceField(choices=["start", "end"])
    distance_m = serializers.IntegerField()


class RoutePlanResponseSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=["ors", "fixture", "mock"])
    step_free_available = serializers.BooleanField(
        allow_null=True, help_text="false = no step-free route; null = not searched or unknown."
    )
    route = RouteSerializer(help_text="The route to walk.")
    baseline = RouteSerializer(help_text="The shortest route, for comparison.")
    detour_m = serializers.IntegerField(allow_null=True)
    extra_min = serializers.IntegerField(allow_null=True)
    pois_status = serializers.ChoiceField(choices=["ok", "unavailable"])
    pois = PoiSerializer(many=True)
    transit_stops = TransitStopSerializer(many=True)


class RoutePlanErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=["no_route", "no_routable_point"])
    detail = serializers.CharField()

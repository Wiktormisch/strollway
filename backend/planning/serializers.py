"""Request validation and the response shape (for OpenAPI) of POST /api/route-plans/."""

from rest_framework import serializers

from planning import geo
from walks.models import (
    PACE_MAX_KMH,
    PACE_MIN_KMH,
    PACE_STEP_KMH,
    TRIP_MAX_MINUTES,
    TRIP_MIN_MINUTES,
    FamilyProfile,
    is_pace_step,
)
from walks.serializers import latitude_field, longitude_field

# A stroller walk, not a road trip. Also protects the ORS daily limit.
MAX_STRAIGHT_DISTANCE_M = 20_000


class PointSerializer(serializers.Serializer):
    lat = latitude_field()
    lng = longitude_field()


def pace_field():
    """Optional pace from the planner. When sent, it wins over the profile pace."""
    return serializers.FloatField(
        min_value=PACE_MIN_KMH,
        max_value=PACE_MAX_KMH,
        required=False,
        allow_null=True,
        default=None,
        help_text="Walking pace in km/h, in steps of 0.5. Empty = the profile pace.",
    )


class ProfileMixin:
    """`profile_id` must belong to this client; `profile` holds the object (or None)."""

    def validate_pace_kmh(self, value):
        if value is not None and not is_pace_step(value):
            raise serializers.ValidationError(f"Use steps of {PACE_STEP_KMH} km/h.")
        return value

    def validate_profile_id(self, value):
        """The profile must belong to this client. Its object is kept in `profile`."""
        if value is None:
            return None
        client_id = self.context["client_id"]
        if not FamilyProfile.objects.filter(pk=value, client_id=client_id).exists():
            # A foreign profile looks the same as a missing one.
            raise serializers.ValidationError("Profile not found.")
        return value

    @staticmethod
    def profile_for(attrs):
        profile_id = attrs.get("profile_id")
        return FamilyProfile.objects.get(pk=profile_id) if profile_id else None


class RoutePlanRequestSerializer(ProfileMixin, serializers.Serializer):
    start = PointSerializer()
    end = PointSerializer()
    avoid_stairs = serializers.BooleanField(default=True)
    profile_id = serializers.IntegerField(required=False, allow_null=True)
    pace_kmh = pace_field()

    def validate(self, attrs):
        start = (attrs["start"]["lat"], attrs["start"]["lng"])
        end = (attrs["end"]["lat"], attrs["end"]["lng"])
        if geo.haversine_m(start, end) > MAX_STRAIGHT_DISTANCE_M:
            raise serializers.ValidationError(
                {"end": f"Must be within {MAX_STRAIGHT_DISTANCE_M // 1000} km of the start."}
            )
        attrs["start_point"], attrs["end_point"] = start, end
        attrs["profile"] = self.profile_for(attrs)
        return attrs


# --- Response (documentation only; the service builds plain dicts) --------------------


def lat_lng():
    """A fresh [lat, lng] field. DRF fields cannot be shared between parents."""
    return serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)


class RouteSerializer(serializers.Serializer):
    geometry = serializers.ListField(child=lat_lng(), help_text="[[lat, lng], ...]")
    distance_m = serializers.IntegerField()
    duration_min = serializers.IntegerField(help_text="At the family pace, computed in code.")
    kcal = serializers.IntegerField(help_text="Rough estimate for a 70 kg adult (+5% stroller).")
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
    pois_status = serializers.ChoiceField(
        choices=["ok", "unavailable", "outside_area"],
        help_text="outside_area = no place data for this area (the data covers the Tricity).",
    )
    pois = PoiSerializer(many=True)
    transit_stops = TransitStopSerializer(many=True)


class RoutePlanErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=["no_route", "no_routable_point"])
    detail = serializers.CharField()


# --- Trip ideas -----------------------------------------------------------------------

MAX_WISHES_LENGTH = 200


class TripIdeaRequestSerializer(ProfileMixin, serializers.Serializer):
    """Only these fields are read. A client cannot send its own candidate list."""

    start = PointSerializer()
    profile_id = serializers.IntegerField(required=False, allow_null=True)
    pace_kmh = pace_field()
    max_minutes = serializers.IntegerField(min_value=TRIP_MIN_MINUTES, max_value=TRIP_MAX_MINUTES)
    round_trip = serializers.BooleanField(default=True)
    language = serializers.ChoiceField(choices=["pl", "en"], default="pl")
    wishes = serializers.CharField(max_length=MAX_WISHES_LENGTH, allow_blank=True, default="")

    def validate(self, attrs):
        attrs["start_point"] = (attrs["start"]["lat"], attrs["start"]["lng"])
        attrs["profile"] = self.profile_for(attrs)
        return attrs


class WeatherSerializer(serializers.Serializer):
    temp_c = serializers.FloatField(allow_null=True)
    precip_probability = serializers.IntegerField(allow_null=True)
    wind_kmh = serializers.FloatField(allow_null=True)


class TripStopSerializer(serializers.Serializer):
    poi_id = serializers.CharField()
    name = serializers.CharField(allow_null=True)
    category = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    distance_m = serializers.IntegerField(help_text="Straight line from the start.")
    opening_hours = serializers.CharField(allow_null=True)
    open_now = serializers.BooleanField(allow_null=True)
    arrive_min = serializers.IntegerField(help_text="Minutes from the start of the trip.")
    planned_minutes = serializers.IntegerField()
    reason = serializers.CharField()


class DroppedStopSerializer(serializers.Serializer):
    poi_id = serializers.CharField()
    name = serializers.CharField(allow_null=True)


class TripIdeaResponseSerializer(serializers.Serializer):
    engine = serializers.ChoiceField(choices=["rules", "claude_cli", "anthropic", "nvidia"])
    source = serializers.ChoiceField(choices=["ors", "fixture", "mock"])
    step_free_available = serializers.BooleanField(allow_null=True)
    route = RouteSerializer()
    baseline = RouteSerializer()
    detour_m = serializers.IntegerField(allow_null=True)
    extra_min = serializers.IntegerField(allow_null=True)
    summary = serializers.CharField()
    tips = serializers.ListField(child=serializers.CharField())
    unmet_wishes = serializers.ListField(child=serializers.CharField())
    stops = TripStopSerializer(many=True)
    dropped_stops = DroppedStopSerializer(many=True, help_text="Removed to fit the time limit.")
    walking_min = serializers.IntegerField()
    stops_min = serializers.IntegerField()
    total_min = serializers.IntegerField()
    max_minutes = serializers.IntegerField()
    over_limit = serializers.BooleanField(help_text="true = more than 10% over max_minutes.")
    weather = WeatherSerializer(allow_null=True)
    transit_stops = TransitStopSerializer(many=True)


class TripIdeaErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(
        choices=[
            "no_places_nearby",
            "places_unavailable",
            "outside_area",
            "no_route",
            "no_routable_point",
        ]
    )
    detail = serializers.CharField()

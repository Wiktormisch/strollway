"""Serializers for the walks API. All validation lives here, not in the views."""

from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from planning import calories, services
from walks.models import PACE_STEP_KMH, FamilyProfile, Stop, Walk, is_pace_step

MAX_CHILDREN = 6
MAX_CHILD_AGE = 17
MAX_NOTES_LENGTH = 1000
MAX_AI_SUMMARY_LENGTH = 2000
MAX_GEOMETRY_POINTS = 5000
MAX_NESTED_STOPS = 20


def latitude_field(**kwargs):
    return serializers.FloatField(min_value=-90, max_value=90, **kwargs)


def longitude_field(**kwargs):
    return serializers.FloatField(min_value=-180, max_value=180, **kwargs)


def is_int(value):
    # bool is a subclass of int in Python, so True would pass a plain isinstance check.
    return isinstance(value, int) and not isinstance(value, bool)


def is_number(value):
    return isinstance(value, int | float) and not isinstance(value, bool)


# JSON fields have no shape in the OpenAPI schema ("any value"). These two subclasses only
# describe the shape for the schema and the generated frontend types; validation stays in the
# validate_* methods below.
@extend_schema_field({"type": "array", "items": {"type": "integer"}})
class IntListJSONField(serializers.JSONField):
    pass


@extend_schema_field(
    {
        "type": "array",
        "items": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
        "description": "[[lat, lng], ...]",
    }
)
class LatLngListJSONField(serializers.JSONField):
    pass


class FamilyProfileSerializer(serializers.ModelSerializer):
    # required=False like the model field with default=list.
    children_ages = IntListJSONField(required=False)

    class Meta:
        model = FamilyProfile
        fields = [
            "id",
            "name",
            "children_ages",
            "wheels",
            "pace_kmh",
            "trip_minutes",
            "round_trip",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "kcal", "created_at", "updated_at"]

    def validate_children_ages(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of ages.")
        # No children is fine: a profile can be only a pace and a way of moving (audit idea 5).
        if len(value) > MAX_CHILDREN:
            raise serializers.ValidationError(f"Give at most {MAX_CHILDREN} ages.")
        for age in value:
            if not is_int(age) or not 0 <= age <= MAX_CHILD_AGE:
                raise serializers.ValidationError(
                    f"Each age must be a whole number from 0 to {MAX_CHILD_AGE}."
                )
        return value

    def validate_pace_kmh(self, value):
        if not is_pace_step(value):
            raise serializers.ValidationError(f"Use steps of {PACE_STEP_KMH} km/h.")
        return value


class StopFieldsMixin(serializers.Serializer):
    """Fields shared by the nested stop and the standalone stop."""

    lat = latitude_field()
    lng = longitude_field()
    planned_minutes = serializers.IntegerField(min_value=1, max_value=120, required=False)


STOP_FIELDS = [
    "id",
    "order",
    "name",
    "category",
    "lat",
    "lng",
    "osm_id",
    "planned_minutes",
    "reason",
    "source",
]


class NestedStopSerializer(StopFieldsMixin, serializers.ModelSerializer):
    """A stop inside a walk payload. The walk is set by the parent serializer."""

    class Meta:
        model = Stop
        fields = STOP_FIELDS
        read_only_fields = ["id"]


class StopSerializer(StopFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ["walk", *STOP_FIELDS]
        read_only_fields = ["id"]

    def validate_walk(self, walk):
        # A foreign walk looks like a missing one: the same message, no hint that it exists.
        if walk.client_id != self.context["client_id"]:
            raise serializers.ValidationError("Walk not found.")
        # A stop cannot move to another walk; it is set only on create.
        if self.instance is not None and walk.pk != self.instance.walk_id:
            raise serializers.ValidationError("A stop cannot be moved to another walk.")
        return walk

    def validate(self, attrs):
        # The same rules as the nested create in WalkSerializer.validate_stops.
        walk = attrs.get("walk", getattr(self.instance, "walk", None))
        siblings = walk.stops.all()
        if self.instance is not None:
            siblings = siblings.exclude(pk=self.instance.pk)
        elif siblings.count() >= MAX_NESTED_STOPS:
            raise serializers.ValidationError({"walk": f"At most {MAX_NESTED_STOPS} stops."})
        if "order" in attrs and siblings.filter(order=attrs["order"]).exists():
            raise serializers.ValidationError({"order": "Each stop needs a different order."})
        return attrs


class KcalMixin(serializers.Serializer):
    """`kcal`: computed when read, not stored (audit idea 1, DECISIONS.md section 13).

    It uses the pace and the way of moving of the walk's profile, like the planner did.
    """

    kcal = serializers.SerializerMethodField()

    def get_kcal(self, walk) -> int:
        profile = walk.profile
        pace_kmh = services.pace_kmh_for(profile)
        return calories.estimate_kcal(walk.distance_m, pace_kmh, services.has_stroller(profile))


class WalkListSerializer(KcalMixin, serializers.ModelSerializer):
    """A light version for the list: no geometry, no stops, only their count."""

    stops_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Walk
        fields = [
            "id",
            "profile",
            "name",
            "start_label",
            "end_label",
            "avoid_stairs",
            "distance_m",
            "duration_min",
            "kcal",
            "stairs_m",
            "stairs_avoided_m",
            "detour_m",
            "status",
            "rating",
            "stops_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WalkSerializer(KcalMixin, serializers.ModelSerializer):
    """Detail and write serializer. Accepts an optional "stops" list on create only."""

    geometry = LatLngListJSONField(required=False)
    start_lat = latitude_field()
    start_lng = longitude_field()
    end_lat = latitude_field()
    end_lng = longitude_field()
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    notes = serializers.CharField(
        max_length=MAX_NOTES_LENGTH, required=False, allow_blank=True, trim_whitespace=False
    )
    ai_summary = serializers.CharField(
        max_length=MAX_AI_SUMMARY_LENGTH, required=False, allow_blank=True
    )
    stops = NestedStopSerializer(many=True, required=False)

    class Meta:
        model = Walk
        fields = [
            "id",
            "profile",
            "name",
            "start_lat",
            "start_lng",
            "end_lat",
            "end_lng",
            "start_label",
            "end_label",
            "avoid_stairs",
            "distance_m",
            "duration_min",
            "kcal",
            "stairs_m",
            "stairs_avoided_m",
            "detour_m",
            "geometry",
            "status",
            "rating",
            "notes",
            "ai_summary",
            "stops",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "kcal", "created_at", "updated_at"]

    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:
            # On update stops are read-only: ignored, and not validated either.
            fields["stops"].read_only = True
        return fields

    def validate_profile(self, profile):
        if profile is not None and profile.client_id != self.context["client_id"]:
            raise serializers.ValidationError("Profile not found.")
        return profile

    def validate_geometry(self, value):
        if not isinstance(value, list) or not 2 <= len(value) <= MAX_GEOMETRY_POINTS:
            raise serializers.ValidationError(
                f"Must be a list of 2 to {MAX_GEOMETRY_POINTS} [lat, lng] points."
            )
        for point in value:
            if (
                not isinstance(point, list)
                or len(point) != 2
                or not all(is_number(c) for c in point)
                or not -90 <= point[0] <= 90
                or not -180 <= point[1] <= 180
            ):
                raise serializers.ValidationError("Each point must be [lat, lng] in valid ranges.")
        return value

    def validate_stops(self, value):
        if len(value) > MAX_NESTED_STOPS:
            raise serializers.ValidationError(f"At most {MAX_NESTED_STOPS} stops.")
        orders = [stop["order"] for stop in value]
        if len(orders) != len(set(orders)):
            raise serializers.ValidationError("Each stop needs a different order.")
        return value

    def validate(self, attrs):
        if self.instance is None:
            self.check_walks_limit()
        # On PATCH the request may not include status, so use the saved value.
        status = attrs.get("status", getattr(self.instance, "status", Walk.Status.PLANNED))
        if status == Walk.Status.PLANNED:
            if attrs.get("rating") is not None:
                raise serializers.ValidationError(
                    {"rating": "A rating is allowed only when the status is done."}
                )
            # Going back to "planned" clears an old rating.
            attrs["rating"] = None
        return attrs

    def check_walks_limit(self):
        # Not exact under parallel requests (it may pass by one or two); good enough here.
        limit = settings.MAX_WALKS_PER_CLIENT
        if Walk.objects.filter(client_id=self.context["client_id"]).count() >= limit:
            raise serializers.ValidationError(
                f"At most {limit} walks. Delete an old walk to save a new one."
            )

    @transaction.atomic
    def create(self, validated_data):
        stops_data = validated_data.pop("stops", [])
        walk = Walk.objects.create(**validated_data)
        Stop.objects.bulk_create(Stop(walk=walk, **stop) for stop in stops_data)
        return walk

    def update(self, instance, validated_data):
        # Stops are changed through /api/stops/, never through the walk.
        validated_data.pop("stops", None)
        return super().update(instance, validated_data)

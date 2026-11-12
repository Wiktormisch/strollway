"""Validation of an LLM answer (docs/PLAN.md D.6, "Validating the answer").

A DRF serializer, no extra package. The candidate list comes in the context, so only
known, open, unique places pass. Anything invalid -> the caller falls back.
"""

from rest_framework import serializers

MIN_STOPS, MAX_STOPS = 1, 4


class StrictIntegerField(serializers.IntegerField):
    """DRF accepts "20" and True as integers; an LLM answer must use a real number."""

    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, int):
            raise serializers.ValidationError("Must be a whole number.")
        return super().to_internal_value(data)


class StopAnswerSerializer(serializers.Serializer):
    poi_id = serializers.CharField(max_length=40)
    planned_minutes = StrictIntegerField(min_value=5, max_value=60)
    reason = serializers.CharField(max_length=160, allow_blank=True)


class TripAnswerSerializer(serializers.Serializer):
    """Context: {"candidates": [...]} - the list the backend collected."""

    summary = serializers.CharField(max_length=300, allow_blank=True)
    stops = StopAnswerSerializer(many=True, min_length=MIN_STOPS, max_length=MAX_STOPS)
    unmet_wishes = serializers.ListField(child=serializers.CharField(max_length=80), max_length=10)
    tips = serializers.ListField(child=serializers.CharField(max_length=120), max_length=3)

    def validate_stops(self, stops):
        by_id = {c["poi_id"]: c for c in self.context["candidates"]}
        seen = set()
        for stop in stops:
            place = by_id.get(stop["poi_id"])
            if place is None:
                raise serializers.ValidationError("Unknown poi_id.")
            if stop["poi_id"] in seen:
                raise serializers.ValidationError("Repeated poi_id.")
            if place.get("open_now") is False:
                raise serializers.ValidationError("A chosen place is closed.")
            seen.add(stop["poi_id"])
        return stops


def validate_answer(answer, candidates):
    """The cleaned answer, or None with the names of the invalid fields (safe to log)."""
    serializer = TripAnswerSerializer(data=answer, context={"candidates": candidates})
    if serializer.is_valid():
        return serializer.validated_data, None
    return None, sorted(serializer.errors)

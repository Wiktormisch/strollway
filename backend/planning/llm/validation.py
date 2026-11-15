"""Validation of an LLM answer (docs/PLAN.md D.6, "Validating the answer").

A DRF serializer, no extra package. The candidate list comes in the context, so only
known, open, unique places pass. Anything invalid -> the caller falls back.

Texts that are only too long, and lists with too many items, are not errors: they are cut
in code (docs/AUDIT.md L3), so one long sentence does not throw away a paid answer.
"""

from rest_framework import serializers

MIN_STOPS, MAX_STOPS = 1, 4
ELLIPSIS = "…"


def trim_text(text, limit):
    """Cut text to at most `limit` characters, at a word when one is close, with an ellipsis."""
    if len(text) <= limit:
        return text
    keep = limit - len(ELLIPSIS)
    # Look one character past the cut: a space there means the last word is complete.
    space = text[: keep + 1].rfind(" ")
    if space >= keep // 2:  # a word end in the second half: cut there, not inside a word
        cut = text[:space]
    else:
        cut = text[:keep]
    return cut.rstrip(" ,.;:-") + ELLIPSIS


def _mark_trimmed(field):
    """Note the field name in the serializer context (names only, safe to log)."""
    name = field.field_name or getattr(field.parent, "field_name", "")
    field.context.setdefault("trimmed", set()).add(name)


class TrimmedCharField(serializers.CharField):
    """A CharField that cuts a too-long text instead of rejecting it.

    DRF runs to_internal_value before the max_length validator, so the cut text always passes.
    """

    def to_internal_value(self, data):
        text = super().to_internal_value(data)
        if self.max_length is not None and len(text) > self.max_length:
            _mark_trimmed(self)
            text = trim_text(text, self.max_length)
        return text


class TrimmedListField(serializers.ListField):
    """A ListField that keeps the first `max_length` items instead of rejecting the list."""

    def to_internal_value(self, data):
        if isinstance(data, list) and self.max_length is not None and len(data) > self.max_length:
            _mark_trimmed(self)
            data = data[: self.max_length]
        return super().to_internal_value(data)


class StrictIntegerField(serializers.IntegerField):
    """DRF accepts "20" and True as integers; an LLM answer must use a real number."""

    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, int):
            raise serializers.ValidationError("Must be a whole number.")
        return super().to_internal_value(data)


class StopAnswerSerializer(serializers.Serializer):
    poi_id = serializers.CharField(max_length=40)
    planned_minutes = StrictIntegerField(min_value=5, max_value=60)
    reason = TrimmedCharField(max_length=160, allow_blank=True)


class TripAnswerSerializer(serializers.Serializer):
    """Context: {"candidates": [...]} - the list the backend collected."""

    summary = TrimmedCharField(max_length=300, allow_blank=True)
    stops = StopAnswerSerializer(many=True, min_length=MIN_STOPS, max_length=MAX_STOPS)
    unmet_wishes = TrimmedListField(child=TrimmedCharField(max_length=80), max_length=10)
    tips = TrimmedListField(child=TrimmedCharField(max_length=120), max_length=3)

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
    """(cleaned answer or None, names of invalid fields, names of cut fields).

    Only field names are returned, never the texts, so all three are safe to log.
    """
    context = {"candidates": candidates}
    serializer = TripAnswerSerializer(data=answer, context=context)
    valid = serializer.is_valid()  # the fields note what they cut in `context` while validating
    trimmed = sorted(context.get("trimmed", ()))
    if valid:
        return serializer.validated_data, None, trimmed
    return None, sorted(serializer.errors), trimmed

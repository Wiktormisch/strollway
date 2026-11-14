"""Data model for saved walks. See docs/PLAN.md, section D.3.

There is no user model. Every row (except Stop) has a client_id taken from the
X-Client-Id header, and all queries are filtered by it (see walks/scoping.py).
"""

from django.db import models


class FamilyProfile(models.Model):
    class Wheels(models.TextChoices):
        NONE = "none", "None"
        STROLLER = "stroller", "Stroller"
        KID_BIKE = "kid_bike", "Kid bike"

    class Pace(models.TextChoices):
        RELAXED = "relaxed", "Relaxed"
        NORMAL = "normal", "Normal"

    client_id = models.CharField(max_length=36, db_index=True)
    name = models.CharField(max_length=60)
    # A list of ints 0-17, 1-6 items. No names on purpose (no personal data).
    children_ages = models.JSONField(default=list)
    wheels = models.CharField(max_length=10, choices=Wheels.choices, default=Wheels.STROLLER)
    pace = models.CharField(max_length=10, choices=Pace.choices, default=Pace.RELAXED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class Walk(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        DONE = "done", "Done"

    client_id = models.CharField(max_length=36, db_index=True)
    profile = models.ForeignKey(
        FamilyProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name="walks"
    )
    name = models.CharField(max_length=80)
    start_lat = models.FloatField()
    start_lng = models.FloatField()
    end_lat = models.FloatField()
    end_lng = models.FloatField()
    start_label = models.CharField(max_length=120, blank=True)
    end_label = models.CharField(max_length=120, blank=True)
    avoid_stairs = models.BooleanField(default=True)
    distance_m = models.PositiveIntegerField()
    # Walking time at the family's pace, without stops.
    duration_min = models.PositiveIntegerField()
    # Metres of stairs on the saved route (0 = step-free).
    stairs_m = models.PositiveIntegerField(default=0)
    # Metres of stairs on the shortest route that this route avoids.
    stairs_avoided_m = models.PositiveIntegerField(default=0)
    # Difference against the shortest route, in metres.
    detour_m = models.IntegerField(default=0)
    # A list of [lat, lng] pairs.
    geometry = models.JSONField(default=list)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PLANNED)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    # The length limits live in the serializer: TextField does not enforce max_length.
    notes = models.TextField(blank=True)
    ai_summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class Stop(models.Model):
    class Category(models.TextChoices):
        PLAYGROUND = "playground", "Playground"
        INDOOR_PLAY = "indoor_play", "Indoor play"
        SKATEPARK = "skatepark", "Skatepark"
        TOILETS = "toilets", "Toilets"
        CAFE = "cafe", "Cafe"
        RESTAURANT = "restaurant", "Restaurant"
        BENCH = "bench", "Bench"
        WATER = "water", "Water"
        PARK = "park", "Park"
        ZOO = "zoo", "Zoo"
        MUSEUM = "museum", "Museum"
        BEACH = "beach", "Beach"
        SHOP = "shop", "Shop"
        OTHER = "other", "Other"

    class Source(models.TextChoices):
        AI = "ai", "AI"
        RULES = "rules", "Rules"
        USER = "user", "User"

    # No client_id here: access is checked through walk.client_id.
    walk = models.ForeignKey(Walk, on_delete=models.CASCADE, related_name="stops")
    order = models.PositiveSmallIntegerField()
    # Empty = a place without a name in OSM (e.g. a bench).
    name = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=12, choices=Category.choices)
    lat = models.FloatField()
    lng = models.FloatField()
    osm_id = models.CharField(max_length=40, blank=True)
    planned_minutes = models.PositiveSmallIntegerField(default=10)
    reason = models.CharField(max_length=200, blank=True)
    source = models.CharField(max_length=8, choices=Source.choices, default=Source.USER)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name or self.get_category_display()

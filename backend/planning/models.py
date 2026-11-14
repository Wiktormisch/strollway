"""Places imported from an OpenStreetMap export (docs/DECISIONS.md section 11)."""

from django.db import models


class Place(models.Model):
    """One OSM element with a tag we use. Raw tags are kept, so the parsers in pois.py
    decide the category the same way for live Overpass data and for imported data."""

    osm_type = models.CharField(max_length=8)  # node | way | relation
    osm_id = models.BigIntegerField()
    lat = models.FloatField()
    lng = models.FloatField()
    tags = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["osm_type", "osm_id"], name="unique_osm_element")
        ]
        indexes = [models.Index(fields=["lat", "lng"], name="place_lat_lng")]

    def __str__(self):
        return f"{self.osm_type}/{self.osm_id}"


class PlaceImport(models.Model):
    """The last import (one row): its area decides what is "outside the data area"."""

    imported_at = models.DateTimeField(auto_now_add=True)
    source_file = models.CharField(max_length=255)
    place_count = models.PositiveIntegerField()
    min_lat = models.FloatField()
    max_lat = models.FloatField()
    min_lng = models.FloatField()
    max_lng = models.FloatField()

    def __str__(self):
        return f"{self.place_count} places from {self.source_file}"

    def contains(self, point):
        lat, lng = point
        return self.min_lat <= lat <= self.max_lat and self.min_lng <= lng <= self.max_lng

from django.contrib import admin

from planning.models import Place, PlaceImport


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("osm_type", "osm_id", "lat", "lng")
    search_fields = ("osm_id",)


@admin.register(PlaceImport)
class PlaceImportAdmin(admin.ModelAdmin):
    list_display = ("source_file", "place_count", "imported_at")

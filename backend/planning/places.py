"""The `db` place provider: places from our own table, imported from an OSM export.

Decision: docs/DECISIONS.md section 11 (audit task 10, option A1). The rows keep raw OSM
tags, and this module turns them back into an Overpass-like body, so the same parsers in
pois.py apply the same rules (categories, duplicates, bench cap, round-robin).

- import: `parse_export` + `replace_places` (used by `manage.py import_places <file>`);
- reading: a bounding box query, then distances are checked in code.
"""

import gzip
import json
import logging
import math

from django.db import transaction

from planning import geo, pois
from planning.models import Place, PlaceImport

logger = logging.getLogger(__name__)

# Tags we keep besides the matched key. Everything else in the export is dropped.
KEPT_TAGS = {"name", "opening_hours", "cuisine", "wheelchair", "changing_table"}
TAG_TABLES = (pois.CATEGORY_BY_TAG, pois.TRIP_CATEGORY_BY_TAG, pois.TRANSIT_KIND_BY_TAG)
METRES_PER_DEGREE_LAT = 111_195
BULK_BATCH_SIZE = 2000


class ImportFileError(Exception):
    pass


# --- Import ---------------------------------------------------------------------------


def read_export(path):
    """The JSON body of an Overpass export. `.gz` files are read with gzip."""
    opener = gzip.open if str(path).endswith(".gz") else open
    try:
        with opener(path, "rt", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, ValueError) as exc:
        raise ImportFileError(f"Cannot read {path}: {exc}") from exc


def parse_export(body):
    """Unsaved Place objects for elements with a tag we use. Raises ImportFileError.

    The whole file is checked before anything is saved, so a bad file never empties
    the table.
    """
    elements = body.get("elements") if isinstance(body, dict) else None
    if not isinstance(elements, list):
        raise ImportFileError("The file has no 'elements' list. Export raw OSM data as JSON.")
    places = {}
    for element in elements:
        place = _place_from_element(element)
        if place is not None:
            places[(place.osm_type, place.osm_id)] = place
    return list(places.values())


def _place_from_element(element):
    if not isinstance(element, dict):
        return None
    tags = element.get("tags") or {}
    matched = _matched_keys(tags)
    point = pois._element_point(element)
    if not matched or point is None or "id" not in element:
        return None
    kept = {key: value for key, value in tags.items() if key in KEPT_TAGS or key in matched}
    return Place(
        osm_type=element.get("type", "node"),
        osm_id=int(element["id"]),
        lat=point[0],
        lng=point[1],
        tags=kept,
    )


def _matched_keys(tags):
    return {key for table in TAG_TABLES for key, value in table if tags.get(key) == value}


@transaction.atomic
def replace_places(places, source_file):
    """Replace all places and the import record in one transaction."""
    if not places:
        raise ImportFileError("No element in the file has a tag we use. Nothing was changed.")
    Place.objects.all().delete()
    Place.objects.bulk_create(places, batch_size=BULK_BATCH_SIZE)
    PlaceImport.objects.all().delete()
    return PlaceImport.objects.create(
        source_file=source_file,
        place_count=len(places),
        min_lat=min(p.lat for p in places),
        max_lat=max(p.lat for p in places),
        min_lng=min(p.lng for p in places),
        max_lng=max(p.lng for p in places),
    )


def count_by_category(places):
    """{category: count} for the import summary, with trip-only and transit tags too."""
    counts = {}
    for place in places:
        label = (
            pois._match(place.tags, pois.CATEGORY_BY_TAG)
            or pois._match(place.tags, pois.TRIP_CATEGORY_BY_TAG)
            or pois._match(place.tags, pois.TRANSIT_KIND_BY_TAG)
        )
        counts[label] = counts.get(label, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: -item[1]))


# --- Reading --------------------------------------------------------------------------


def find_pois(geometry, start, end, speed_m_per_min, keep=()):
    """Places along a route and transit near its ends, like pois.find_pois."""
    status = _coverage_status([start, end])
    if status is not None:
        return pois.PoiResult([], [], status)
    margin = max(pois.PLACE_RADIUS_M, pois.TRANSIT_RADIUS_M)
    rows = _rows_in_box([*geometry, start, end], margin)
    # The same simplified line as the Overpass query, so both providers agree.
    line = geo.simplify(geometry, pois.SIMPLIFIED_POINTS, keep=keep)
    elements = [
        _element(row)
        for row in rows
        if pois._match(row.tags, pois.TRANSIT_KIND_BY_TAG)
        or geo.distance_to_polyline_m(line, (row.lat, row.lng)) <= pois.PLACE_RADIUS_M
    ]
    return pois.parse_overpass({"elements": elements}, geometry, start, end, speed_m_per_min)


def find_candidates(start, radius_m):
    """Trip candidates and transit stops around the start, like pois.find_candidates."""
    status = _coverage_status([start])
    if status is not None:
        return pois.PoiResult([], [], status)
    rows = _rows_in_box([start], max(radius_m, pois.TRANSIT_RADIUS_M))
    # parse_candidates drops places beyond radius_m and transit beyond TRANSIT_RADIUS_M.
    return pois.parse_candidates({"elements": [_element(row) for row in rows]}, start, radius_m)


def _coverage_status(points):
    """None when all points are inside the imported area, else the status to return."""
    record = PlaceImport.objects.first()
    if record is None:
        logger.warning("The place table is empty. Run: python manage.py import_places <file>")
        return pois.STATUS_UNAVAILABLE
    if not all(record.contains(point) for point in points):
        return pois.STATUS_OUTSIDE_AREA
    return None


def _rows_in_box(points, margin_m):
    """Places in the bounding box of `points`, grown by `margin_m` on every side."""
    lats = [p[0] for p in points]
    lngs = [p[1] for p in points]
    d_lat = margin_m / METRES_PER_DEGREE_LAT
    d_lng = margin_m / (METRES_PER_DEGREE_LAT * math.cos(math.radians(max(map(abs, lats)))))
    return Place.objects.filter(
        lat__gte=min(lats) - d_lat,
        lat__lte=max(lats) + d_lat,
        lng__gte=min(lngs) - d_lng,
        lng__lte=max(lngs) + d_lng,
    )


def _element(row):
    """A row in the Overpass shape that pois._element_point and the parsers read."""
    element = {"type": row.osm_type, "id": row.osm_id, "tags": row.tags}
    if row.osm_type == "node":
        element.update(lat=row.lat, lon=row.lng)
    else:
        element["center"] = {"lat": row.lat, "lon": row.lng}
    return element

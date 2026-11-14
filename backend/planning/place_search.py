"""Search our own place table by name (audit idea 15, DECISIONS.md section 13).

No outside geocoder: the search only knows the imported places (the Tricity). It is done
in Python, not with SQL LIKE, because SQLite LIKE does not fold Polish letters: here
"lakowa" finds "Łąkowa". The table has about 5 000 named places, so a scan is fast enough.
"""

import unicodedata

from planning import pois
from planning.models import Place

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 100
MAX_RESULTS = 8

CATEGORY_TABLES = (
    pois.CATEGORY_BY_TAG,
    pois.TRIP_CATEGORY_BY_TAG,
    {("highway", "bus_stop"): "bus_stop", ("railway", "tram_stop"): "tram_stop"},
)


def normalize(text):
    """Lower case, no Polish letters, no accents: "Łąkowa" -> "lakowa"."""
    text = text.casefold().replace("ł", "l")
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).strip()


def search_places(query, limit=MAX_RESULTS):
    """Places whose name contains the query. Names that start with it come first."""
    needle = normalize(query)
    if len(needle) < MIN_QUERY_LENGTH:
        return []
    found = []
    for row in Place.objects.filter(tags__has_key="name").only(
        "osm_type", "osm_id", "lat", "lng", "tags"
    ):
        name = row.tags["name"]
        position = normalize(name).find(needle)
        if position >= 0:
            found.append((position != 0, len(name), name, row))
    found.sort(key=lambda item: item[:3])
    return _unique(found, limit)


def _unique(found, limit):
    """One result per name and category: a park is often mapped more than once."""
    results, seen = [], set()
    for _, _, name, row in found:
        category = category_for(row.tags)
        if (name, category) in seen:
            continue
        seen.add((name, category))
        results.append(
            {
                "poi_id": f"{row.osm_type}/{row.osm_id}",
                "name": name,
                "category": category,
                "lat": row.lat,
                "lng": row.lng,
            }
        )
        if len(results) == limit:
            break
    return results


def category_for(tags):
    """The first category whose tag matches, else "other"."""
    for table in CATEGORY_TABLES:
        for (key, value), category in table.items():
            if tags.get(key) == value:
                return category
    return "other"

"""Small builders for fake trip candidates and Overpass elements (fake data only)."""

from planning import geo

START = (54.3385, 18.6200)  # the demo trip start


def candidate(poi_id, category, east_m, north_m, name=None, cuisine=None, open_now=None):
    """A trip candidate placed `east_m` / `north_m` from START."""
    lat = START[0] + north_m / 111_195
    lng = START[1] + east_m / (111_195 * 0.5822)  # cos(54.34 deg)
    return {
        "poi_id": poi_id,
        "name": name,
        "category": category,
        "cuisine": cuisine,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "distance_m": round(geo.haversine_m(START, (lat, lng))),
        "east_m": east_m,
        "north_m": north_m,
        "opening_hours": None,
        "open_now": open_now,
    }


def node(osm_id, lat, lng, **tags):
    return {"type": "node", "id": osm_id, "lat": lat, "lon": lng, "tags": tags}


def way(osm_id, lat, lng, **tags):
    return {"type": "way", "id": osm_id, "center": {"lat": lat, "lon": lng}, "tags": tags}

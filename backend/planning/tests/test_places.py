"""The `db` place provider and the `import_places` command (fake OSM data only)."""

import gzip
import json

import pytest
from django.core.management import CommandError, call_command

from planning import places, pois
from planning.models import Place, PlaceImport
from planning.tests.factories import START, node, way

pytestmark = pytest.mark.django_db

# A straight 1 km line west-east, north of START. Fake data.
LINE = [(54.3400, 18.6000), (54.3400, 18.6153)]
LINE_START, LINE_END = LINE
SPEED = 4000 / 60


def relation(osm_id, lat, lng, **tags):
    return {"type": "relation", "id": osm_id, "center": {"lat": lat, "lon": lng}, "tags": tags}


def load(*elements):
    """Import fake elements, plus two far corners so the imported area is wide."""
    corners = [
        node(900001, 54.27, 18.43, amenity="bench"),
        node(900002, 54.62, 18.80, amenity="bench"),
    ]
    rows = places.parse_export({"elements": [*elements, *corners]})
    return places.replace_places(rows, "test.json")


# --- Import ---------------------------------------------------------------------------


def test_parse_export_keeps_only_our_tags_and_elements():
    rows = places.parse_export(
        {
            "elements": [
                node(1, 54.34, 18.60, leisure="playground", name="Plac", source="survey"),
                way(2, 54.35, 18.61, leisure="indoor_play", opening_hours="Mo-Su 10:00-20:00"),
                relation(3, 54.36, 18.62, leisure="park", name="Park"),
                node(4, 54.34, 18.60, amenity="fuel"),  # not our tag
                {"type": "way", "id": 5, "tags": {"leisure": "park"}},  # no center
                node(6, 54.34, 18.60, highway="bus_stop", name="Przystanek"),
            ]
        }
    )

    by_id = {(row.osm_type, row.osm_id): row for row in rows}
    assert set(by_id) == {("node", 1), ("way", 2), ("relation", 3), ("node", 6)}
    assert by_id[("node", 1)].tags == {"leisure": "playground", "name": "Plac"}
    assert by_id[("way", 2)].lat == 54.35
    assert by_id[("way", 2)].tags["opening_hours"] == "Mo-Su 10:00-20:00"


def test_parse_export_drops_duplicate_elements():
    element = node(1, 54.34, 18.60, amenity="bench")
    assert len(places.parse_export({"elements": [element, element]})) == 1


@pytest.mark.parametrize("body", [{}, {"elements": "x"}, [], {"remark": "error"}])
def test_parse_export_rejects_a_file_without_elements(body):
    with pytest.raises(places.ImportFileError):
        places.parse_export(body)


def test_replace_places_replaces_rows_and_records_the_area():
    load(node(1, 54.34, 18.60, amenity="cafe"))
    record = load(node(2, 54.35, 18.61, amenity="cafe"))

    assert set(Place.objects.values_list("osm_id", flat=True)) == {2, 900001, 900002}
    assert PlaceImport.objects.count() == 1
    assert (record.min_lat, record.max_lat) == (54.27, 54.62)
    assert record.contains((54.40, 18.60)) and not record.contains(OTHER_POINT)


def test_import_without_our_tags_changes_nothing():
    load(node(1, 54.34, 18.60, amenity="cafe"))

    with pytest.raises(places.ImportFileError):
        places.replace_places(places.parse_export({"elements": []}), "empty.json")

    assert Place.objects.filter(osm_id=1).exists()


def test_a_skatepark_is_kept_and_counted_by_its_sport_tag():
    """DECISIONS.md section 12: `leisure=pitch` + `sport=skateboard` is a skatepark."""
    element = node(1, 54.34, 18.60, leisure="pitch", sport="skateboard", name="Fake skatepark")

    [place] = places.parse_export({"elements": [element]})

    assert place.tags["sport"] == "skateboard"
    assert places.count_by_category([place]) == {"skatepark": 1}


def test_import_command_reads_json_and_gzip(tmp_path):
    body = {"elements": [node(1, 54.34, 18.60, leisure="indoor_play")]}
    plain = tmp_path / "places.json"
    plain.write_text(json.dumps(body), encoding="utf-8")
    packed = tmp_path / "places.json.gz"
    with gzip.open(packed, "wt", encoding="utf-8") as file:
        json.dump(body, file)

    call_command("import_places", str(plain))
    call_command("import_places", str(packed))

    assert Place.objects.count() == 1
    assert PlaceImport.objects.get().source_file == "places.json.gz"


def test_import_command_with_a_bad_file_keeps_the_old_data(tmp_path):
    load(node(1, 54.34, 18.60, amenity="cafe"))
    bad = tmp_path / "bad.json"
    bad.write_text("not json", encoding="utf-8")

    with pytest.raises(CommandError):
        call_command("import_places", str(bad))
    with pytest.raises(CommandError):
        call_command("import_places", str(tmp_path / "missing.json"))

    assert Place.objects.filter(osm_id=1).exists()


def test_count_by_category_includes_transit_and_trip_only_tags():
    rows = places.parse_export(
        {
            "elements": [
                node(1, 54.34, 18.60, amenity="bench"),
                node(2, 54.34, 18.60, shop="bakery"),
                node(3, 54.34, 18.60, railway="tram_stop"),
            ]
        }
    )
    assert places.count_by_category(rows) == {"bench": 1, "shop": 1, "tram": 1}


# --- Reading: route places ------------------------------------------------------------

OTHER_POINT = (52.2297, 21.0122)  # Warsaw, outside the fake import


def test_route_places_use_the_segment_distance_and_skip_far_ones():
    load(
        # ~50 m north of the line middle: ~500 m from both vertices, still on the way.
        node(1, 54.34045, 18.60765, leisure="playground", name="Middle"),
        node(2, 54.34300, 18.60765, leisure="playground", name="Far"),  # ~330 m away
        node(3, 54.34020, 18.60100, amenity="cafe", name="Cafe"),
    )

    result = places.find_pois(LINE, LINE_START, LINE_END, SPEED)

    assert result.status == pois.STATUS_OK
    assert [p["name"] for p in result.pois] == ["Cafe", "Middle"]


def test_route_transit_near_the_ends_and_indoor_play_category():
    load(
        node(1, 54.3420, 18.6000, highway="bus_stop", name="Start stop"),  # ~220 m from start
        way(2, 54.3401, 18.6100, leisure="indoor_play", name="Sala"),
    )

    result = places.find_pois(LINE, LINE_START, LINE_END, SPEED)

    assert [(s["name"], s["near"]) for s in result.transit_stops] == [("Start stop", "start")]
    assert [(p["poi_id"], p["category"]) for p in result.pois] == [("way/2", "indoor_play")]


def test_empty_table_is_unavailable_not_outside_area():
    result = places.find_pois(LINE, LINE_START, LINE_END, SPEED)
    assert result.status == pois.STATUS_UNAVAILABLE


def test_route_end_outside_the_import_is_outside_area():
    load()
    result = places.find_pois([LINE_START, OTHER_POINT], LINE_START, OTHER_POINT, SPEED)
    assert result == pois.PoiResult([], [], pois.STATUS_OUTSIDE_AREA)


# --- Reading: trip candidates ---------------------------------------------------------


def test_trip_candidates_within_the_radius():
    load(
        node(1, START[0] + 0.0036, START[1], leisure="indoor_play", name="Near"),  # ~400 m
        node(2, START[0] + 0.0108, START[1], leisure="playground", name="Far"),  # ~1200 m
        node(3, START[0] + 0.0010, START[1], railway="tram_stop", name="Tram"),
    )

    result = places.find_candidates(START, 800)

    assert result.status == pois.STATUS_OK
    assert [(p["name"], p["category"]) for p in result.pois] == [("Near", "indoor_play")]
    assert [s["name"] for s in result.transit_stops] == ["Tram"]


def test_trip_start_outside_the_import_is_outside_area():
    load()
    assert places.find_candidates(OTHER_POINT, 800).status == pois.STATUS_OUTSIDE_AREA


# --- Provider switch ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("setting", "expected"),
    [("db", "db"), ("overpass", "overpass"), ("auto", "overpass"), ("mock", "mock")],
)
def test_provider_names(settings, setting, expected):
    settings.POI_PROVIDER = setting
    assert pois.provider() == expected

from datetime import datetime

import pytest

from planning import opening_hours, pois
from planning.tests.factories import START, node

# 2026-11-11 is a Wednesday, 2026-11-14 a Saturday, 2026-11-15 a Sunday.
WED_10 = datetime(2026, 11, 11, 10, 0)
WED_19 = datetime(2026, 11, 11, 19, 0)
SAT_12 = datetime(2026, 11, 14, 12, 0)
SUN_23 = datetime(2026, 11, 15, 23, 30)


@pytest.mark.parametrize(
    ("text", "now", "expected"),
    [
        ("24/7", SUN_23, True),
        ("Mo-Fr 08:00-18:00", WED_10, True),
        ("Mo-Fr 08:00-18:00", WED_19, False),
        ("Mo-Fr 08:00-18:00", SAT_12, False),
        ("Mo-Fr 08:00-18:00; Sa 10:00-14:00", SAT_12, True),
        ("Mo-Su 12:00-19:00", WED_10, False),
        ("10:00-20:00", SAT_12, True),
        ("Mo-Sa 09:00-21:00; We off", WED_10, False),
        ("Mo,We,Fr 09:00-11:00", WED_10, True),
        ("Mo-Fr 08:00-12:00,13:00-17:00", WED_10, True),
        ("Sa-Mo 10:00-24:00", SUN_23, True),
        ("Mo-Fr 18:00-18:00", WED_10, None),
    ],
)
def test_supported_patterns(text, now, expected):
    assert opening_hours.is_open(text, now) is expected


def test_closing_time_itself_is_closed():
    assert opening_hours.is_open("Mo-Su 08:00-10:00", WED_10) is False


@pytest.mark.parametrize(
    "text",
    [
        None,
        "",
        "Mo-Fr 08:00-18:00; PH off",
        "Jan-Mar Mo-Fr 10:00-16:00",
        "Fr-Sa 18:00-02:00",
        "sunrise-sunset",
        "Mo-Fr 8:00-18:00",
        "by appointment",
        "Mo-Fr 08:00-25:00",
    ],
)
def test_unknown_patterns_give_none(text):
    assert opening_hours.is_open(text, WED_10) is None


def test_places_get_open_now_from_their_tags(monkeypatch):
    monkeypatch.setattr(opening_hours, "_now", lambda: WED_19)
    body = {
        "elements": [
            node(1, 54.3386, 18.62, amenity="cafe", name="A", opening_hours="Mo-Su 12:00-19:00"),
            node(2, 54.3387, 18.62, amenity="cafe", name="B", opening_hours="24/7"),
            node(3, 54.3388, 18.62, amenity="cafe", name="C"),
        ]
    }

    result = pois.parse_candidates(body, START, 1000)
    by_id = {c["poi_id"]: c["open_now"] for c in result.pois}
    assert by_id == {"node/1": False, "node/2": True, "node/3": None}

    route = pois.parse_overpass(body, [list(START), [54.339, 18.62]], START, START, 66.7)
    assert {p["poi_id"]: p["open_now"] for p in route.pois} == by_id

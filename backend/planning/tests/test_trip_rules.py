import pytest

from planning import trip_rules
from planning.tests.factories import candidate

SPEED = 4000 / 60  # stroller pace, m/min

CANDIDATES = [
    candidate("node/1", "playground", 50, 50),
    candidate("node/2", "cafe", -100, 150, name="Kawka"),
    candidate("node/3", "cafe", 200, 0, name="Lodziarnia", cuisine="ice_cream"),
    candidate("node/4", "restaurant", 300, -100, name="Roma", cuisine="pizza"),
    candidate("node/5", "restaurant", 80, 0, name="Bar", cuisine="regional"),
    candidate("node/6", "toilets", 30, 0),
]


def plan(wishes="", ages=(), language="en", minutes=120, round_trip=True, candidates=CANDIDATES):
    return trip_rules.plan(candidates, wishes, list(ages), language, minutes, SPEED, round_trip)


def stop_ids(answer):
    return [s["poi_id"] for s in answer["stops"]]


@pytest.mark.parametrize(
    "wishes",
    ["playground, then ice cream, finally pizza", "plac zabaw, potem lody, na koniec pizza"],
)
def test_keywords_in_both_languages_keep_the_order_of_the_text(wishes):
    assert stop_ids(plan(wishes)) == ["node/1", "node/3", "node/4"]


def test_order_comes_from_the_text_not_from_the_keyword_table():
    assert stop_ids(plan("pizza first, then a playground")) == ["node/4", "node/1"]


def test_coffee_picks_the_closest_cafe():
    assert stop_ids(plan("kawa")) == ["node/2"]  # 180 m, the ice cream cafe is 200 m


def test_pizza_needs_a_pizza_place():
    answer = plan("pizza", candidates=[c for c in CANDIDATES if c["poi_id"] != "node/4"])

    assert answer["unmet_wishes"] == ["pizza: none nearby"]
    assert stop_ids(answer) == ["node/2"]  # still a trip: the default list (a cafe)


def test_fallback_is_never_only_toilets_or_water():
    only = [
        candidate("node/6", "toilets", 10, 0),
        candidate("node/7", "water", 20, 0),
        candidate("node/8", "shop", 300, 0),
    ]
    assert stop_ids(plan("pizza", candidates=only)) == ["node/8"]


def test_toilets_can_still_be_asked_for():
    assert stop_ids(plan("toaleta")) == ["node/6"]


@pytest.mark.parametrize(
    "wishes",
    ["kawałek dalej", "parking spot", "a seat in the season"],
)
def test_no_false_keyword_matches(wishes):
    # "kawałek" is not coffee, "season" is not the sea. ("parking" is a known park match.)
    found = trip_rules.parse_wishes(wishes)
    assert all(w.category not in ("cafe", "beach") for w in found)


def test_empty_wishes_use_the_ages():
    assert stop_ids(plan("", ages=[4])) == ["node/1", "node/2"]
    assert stop_ids(plan("", ages=[12])) == ["node/2"]
    assert stop_ids(plan("", ages=[])) == ["node/2"]


def test_closed_places_are_skipped():
    closed = [{**c, "open_now": False} if c["poi_id"] == "node/2" else c for c in CANDIDATES]
    assert stop_ids(plan("kawa", candidates=closed)) == ["node/3"]


def test_stops_over_the_time_limit_go_to_unmet_wishes():
    answer = plan("playground, coffee, pizza", minutes=40)

    assert stop_ids(answer) == ["node/1"]
    assert answer["unmet_wishes"] == [
        "cafe: does not fit in the time limit",
        "pizza: does not fit in the time limit",
    ]


def test_unknown_wishes_use_the_default_list():
    answer = plan("something completely different", ages=[4])
    assert stop_ids(answer) == ["node/1", "node/2"]
    assert answer["unmet_wishes"] == []


def test_at_most_four_stops():
    answer = plan("plac zabaw, lody, pizza, obiad, toaleta, kawa")
    assert len(answer["stops"]) == trip_rules.MAX_STOPS


def test_texts_are_in_the_requested_language():
    polish = plan("pizza", language="pl")
    english = plan("pizza", language="en")

    assert polish["summary"].startswith("Plan z prostych reguł")
    assert english["summary"] == "A plan from simple rules: Roma."
    assert "od startu" in polish["stops"][0]["reason"]
    assert polish["tips"] == [trip_rules.TEXTS["pl"]["hours_unknown"]]


def test_answer_has_the_llm_shape_and_valid_minutes():
    answer = plan("playground, coffee")

    assert set(answer) == {"summary", "stops", "unmet_wishes", "tips"}
    for stop in answer["stops"]:
        assert set(stop) == {"poi_id", "planned_minutes", "reason"}
        assert 5 <= stop["planned_minutes"] <= 60


def test_one_way_trip_needs_less_time_than_a_loop():
    start = (54.3385, 18.62)
    point = (54.3475, 18.62)  # about 1 km north
    loop = trip_rules.estimate_minutes(start, [point], SPEED, True)
    one_way = trip_rules.estimate_minutes(start, [point], SPEED, False)
    assert loop == pytest.approx(2 * one_way)
    assert one_way == pytest.approx(1000 * 1.3 / SPEED, rel=0.01)


def test_rules_allow_the_same_ten_percent_as_the_planner():
    # The loop is about 431 m x 1.3 = 8.4 min + 50 min at the stops = 58.4 min:
    # over 54, but inside 54 x 1.1 = 59.4.
    assert stop_ids(plan("playground, coffee", minutes=54)) == ["node/1", "node/2"]
    assert stop_ids(plan("playground, coffee", minutes=53)) == ["node/1"]
    assert trip_rules.LIMIT_TOLERANCE == 1.1

"""The LLM part of trip_planner: chain, validation, fallback, daily limit, privacy."""

import json
import logging

import pytest

from planning import pois, trip_planner
from planning.llm import factory
from planning.llm.base import LLMError
from planning.tests.factories import START, candidate

CANDIDATES = [
    candidate("node/1", "playground", 40, 0, name="Hop"),
    candidate("node/2", "cafe", 0, 60, name="Kawka"),
    candidate("node/3", "restaurant", -50, 0, name="Roma", cuisine="pizza", open_now=False),
]
WISHES = "playground then coffee, secret wish text"


def good_answer(*poi_ids):
    return {
        "summary": "A short loop.",
        "stops": [{"poi_id": p, "planned_minutes": 15, "reason": "Close."} for p in poi_ids],
        "unmet_wishes": [],
        "tips": ["Take a jacket."],
    }


class FakeLLM:
    def __init__(self, name, answer=None, error=None, on_call=None):
        self.name = name
        self.on_call = on_call
        self.answer = answer
        self.error = error
        self.calls = []

    def complete_json(self, system, user, schema, timeout_s=None):
        self.calls.append({"system": system, "user": user, "schema": schema, "timeout": timeout_s})
        if self.on_call:
            self.on_call()
        if self.error:
            raise self.error
        return self.answer


@pytest.fixture
def setup(settings, monkeypatch):
    settings.POI_PROVIDER = "overpass"
    settings.ROUTING_PROVIDER = "mock"
    settings.LLM_DAILY_LIMIT = 300
    found = pois.PoiResult(list(CANDIDATES), [], pois.STATUS_OK)
    monkeypatch.setattr(pois, "find_candidates", lambda start, radius: found)

    def use(*clients):
        monkeypatch.setattr(factory, "build_chain", lambda: list(clients))
        return clients

    return use


def build(**kwargs):
    params = {"max_minutes": 90, "language": "en", "wishes": WISHES}
    params.update(kwargs)
    return trip_planner.build_trip_idea(START, **params)


def test_a_valid_llm_answer_is_used(setup):
    (llm,) = setup(FakeLLM("claude_cli", good_answer("node/2", "node/1")))

    idea = build()

    assert idea["engine"] == "claude_cli"
    assert [s["poi_id"] for s in idea["stops"]] == ["node/2", "node/1"]
    assert idea["stops"][0]["name"] == "Kawka"  # names come from our candidates
    assert idea["summary"] == "A short loop."
    assert len(llm.calls) == 1


@pytest.mark.parametrize(
    "answer",
    [
        {"summary": "no stops"},  # bad shape
        good_answer("node/999"),  # unknown poi_id
        good_answer("node/1", "node/1"),  # repeated poi_id
        good_answer("node/3"),  # closed place
        good_answer(),  # zero stops
        good_answer("node/1", "node/2", "node/1", "node/2", "node/1"),  # five stops
        {**good_answer("node/1"), "summary": "x" * 301},
        {
            **good_answer("node/1"),
            "stops": [{"poi_id": "node/1", "planned_minutes": "20", "reason": "r"}],
        },
        {
            **good_answer("node/1"),
            "stops": [{"poi_id": "node/1", "planned_minutes": 90, "reason": "r"}],
        },
    ],
)
def test_invalid_answers_end_in_the_rules(setup, answer):
    setup(FakeLLM("anthropic", answer))
    assert build()["engine"] == "rules"


@pytest.mark.parametrize("error", [LLMError("timeout"), RuntimeError("bug")])
def test_errors_and_timeouts_end_in_the_rules(setup, error):
    setup(FakeLLM("claude_cli", error=error))
    assert build()["engine"] == "rules"


def test_the_next_backend_is_tried(setup):
    first, second = setup(
        FakeLLM("anthropic", error=LLMError("no credit")),
        FakeLLM("nvidia", good_answer("node/1")),
    )

    idea = build()

    assert idea["engine"] == "nvidia"
    assert len(first.calls) == 1 and len(second.calls) == 1


def test_mock_backend_gives_rules_and_builds_no_client(settings, setup, monkeypatch):
    # `setup` replaces nothing here: the real factory runs with LLM_BACKEND=mock.
    settings.LLM_BACKEND = "mock"
    settings.LLM_FALLBACKS = ["nvidia"]

    def must_not_build(name):
        raise AssertionError(f"built {name}")

    monkeypatch.setattr(factory, "_build", must_not_build)

    assert build()["engine"] == "rules"


def test_zero_candidates_never_call_the_llm(setup, monkeypatch):
    (llm,) = setup(FakeLLM("claude_cli", good_answer("node/1")))
    monkeypatch.setattr(pois, "find_candidates", lambda s, r: pois.PoiResult([], [], "ok"))

    with pytest.raises(trip_planner.NoPlacesNearby):
        build()
    assert llm.calls == []


def test_daily_limit_switches_to_rules(setup, settings):
    settings.LLM_DAILY_LIMIT = 2
    (llm,) = setup(FakeLLM("claude_cli", good_answer("node/1")))

    engines = [build()["engine"] for _ in range(3)]

    assert engines == ["claude_cli", "claude_cli", "rules"]
    assert len(llm.calls) == 2


def test_every_attempt_counts_toward_the_daily_limit(setup, settings):
    settings.LLM_DAILY_LIMIT = 1
    first, second = setup(
        FakeLLM("anthropic", error=LLMError("down")), FakeLLM("nvidia", good_answer("node/1"))
    )

    assert build()["engine"] == "rules"
    assert second.calls == []


def _keys(value):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keys(item)


def test_the_llm_payload_has_no_coordinates(setup):
    (llm,) = setup(FakeLLM("claude_cli", good_answer("node/1")))

    build()

    payload = json.loads(llm.calls[0]["user"])
    keys = set(_keys(payload))
    assert not keys & {"lat", "lng", "lon", "latitude", "longitude", "start", "geometry"}
    assert set(payload["candidates"][0]) == {
        "poi_id", "name", "category", "cuisine", "distance_m", "east_m", "north_m", "open_now",
    }  # fmt: skip
    assert str(START[0]) not in llm.calls[0]["user"]
    assert payload["wishes"] == WISHES


def test_logs_never_hold_the_wishes_or_the_prompt(setup, caplog):
    setup(FakeLLM("anthropic", good_answer("node/999")), FakeLLM("nvidia", error=LLMError("x")))

    with caplog.at_level(logging.WARNING):
        build()

    assert "invalid answer" in caplog.text
    assert "secret wish text" not in caplog.text
    assert "You plan a short family outing" not in caplog.text


def test_health_reports_the_first_backend_without_building_it(settings):
    settings.LLM_BACKEND = "anthropic"  # no key set: building would fail
    settings.LLM_FALLBACKS = ["nvidia"]
    assert trip_planner.active_engine() == "anthropic"

    settings.LLM_BACKEND = "mock"
    assert trip_planner.active_engine() == "rules"


def test_prompt_keeps_numbers_and_accessibility_claims_in_code():
    from planning.llm import prompt

    text = prompt.SYSTEM_PROMPT
    assert "Do not write distances, walking times or temperatures" in text
    assert "Do not claim that a route is step-free" in text


# --- time budget (one deadline for the whole LLM chain) -----------------------------------


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def clock(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(trip_planner.time, "monotonic", fake)
    return fake


def test_each_backend_gets_only_the_time_that_is_left(setup, clock):
    def slow():
        clock.now += 30

    first, second = setup(
        FakeLLM("anthropic", error=LLMError("timeout"), on_call=slow),
        FakeLLM("nvidia", good_answer("node/1")),
    )

    idea = build()

    assert idea["engine"] == "nvidia"
    assert first.calls[0]["timeout"] == trip_planner.LLM_CHAIN_BUDGET_S
    assert second.calls[0]["timeout"] == trip_planner.LLM_CHAIN_BUDGET_S - 30


def test_no_backend_starts_when_the_budget_is_used_up(setup, clock):
    def slow():
        clock.now += trip_planner.LLM_CHAIN_BUDGET_S - trip_planner.MIN_LLM_CALL_S + 1

    first, second = setup(
        FakeLLM("anthropic", error=LLMError("timeout"), on_call=slow),
        FakeLLM("nvidia", good_answer("node/1")),
    )

    idea = build()

    assert idea["engine"] == "rules"
    assert len(first.calls) == 1
    assert second.calls == []


def test_the_budget_counts_from_the_request_start(setup, clock, monkeypatch):
    real_weather = trip_planner.weather.current_weather

    def slow_weather(start):
        clock.now += 20  # time spent before the LLM chain counts too
        return real_weather(start)

    monkeypatch.setattr(trip_planner.weather, "current_weather", slow_weather)
    (llm,) = setup(FakeLLM("anthropic", good_answer("node/1")))

    build()

    assert llm.calls[0]["timeout"] == trip_planner.LLM_CHAIN_BUDGET_S - 20

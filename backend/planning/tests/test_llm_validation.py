"""LLM answer validation: real errors reject the answer, too-long texts are only cut (AUDIT L3)."""

import pytest

from planning.llm.validation import ELLIPSIS, trim_text, validate_answer
from planning.tests.factories import candidate

CANDIDATES = [candidate("node/1", "playground", 40, 0, name="Hop")]


def answer(**fields):
    base = {
        "summary": "A short loop.",
        "stops": [{"poi_id": "node/1", "planned_minutes": 15, "reason": "Close."}],
        "unmet_wishes": [],
        "tips": [],
    }
    return {**base, **fields}


def test_a_text_within_the_limit_is_kept():
    assert trim_text("x" * 80, 80) == "x" * 80


def test_a_long_text_is_cut_at_a_word_with_an_ellipsis():
    assert trim_text("aaa bbb ccc ddd", 10) == "aaa bbb" + ELLIPSIS
    assert trim_text("żółw idzie dziś do zoo", 15) == "żółw idzie" + ELLIPSIS


def test_a_word_that_ends_right_at_the_cut_is_kept():
    # "aaa bbb" + ellipsis is exactly 8 characters: no need to drop "bbb".
    assert trim_text("aaa bbb ccc", 8) == "aaa bbb" + ELLIPSIS


def test_one_long_word_is_cut_inside_the_word():
    assert trim_text("a" * 200, 80) == "a" * 79 + ELLIPSIS


def test_trailing_punctuation_is_removed_before_the_ellipsis():
    assert trim_text("one two, " + "x" * 10, 12) == "one two" + ELLIPSIS


def test_regression_a_long_unmet_wish_no_longer_rejects_the_answer():
    long_wish = (
        "Kawa: kawiarnie w okolicy są teraz zamknięte, więc nie dodałem żadnej do planu dnia."
    )
    assert len(long_wish) > 80

    cleaned, invalid, trimmed = validate_answer(answer(unmet_wishes=[long_wish]), CANDIDATES)

    assert invalid is None
    assert len(cleaned["unmet_wishes"][0]) <= 80
    assert cleaned["unmet_wishes"][0].endswith(ELLIPSIS)
    assert trimmed == ["unmet_wishes"]


def test_every_free_text_is_cut_and_reported_by_name():
    stop = {"poi_id": "node/1", "planned_minutes": 15, "reason": "r " * 100}
    raw = answer(summary="s " * 200, stops=[stop], tips=["t " * 100])

    cleaned, invalid, trimmed = validate_answer(raw, CANDIDATES)

    assert invalid is None
    assert len(cleaned["summary"]) <= 300
    assert len(cleaned["stops"][0]["reason"]) <= 160
    assert len(cleaned["tips"][0]) <= 120
    assert trimmed == ["reason", "summary", "tips"]


def test_too_many_list_items_keep_the_first_ones():
    raw = answer(tips=["a", "b", "c", "d"], unmet_wishes=[f"w{i}" for i in range(12)])

    cleaned, invalid, trimmed = validate_answer(raw, CANDIDATES)

    assert invalid is None
    assert cleaned["tips"] == ["a", "b", "c"]
    assert cleaned["unmet_wishes"] == [f"w{i}" for i in range(10)]
    assert trimmed == ["tips", "unmet_wishes"]


def test_a_clean_answer_reports_nothing_cut():
    cleaned, invalid, trimmed = validate_answer(answer(tips=["Take a jacket."]), CANDIDATES)
    assert cleaned is not None
    assert (invalid, trimmed) == (None, [])


@pytest.mark.parametrize(
    "fields",
    [
        {"stops": [{"poi_id": "node/9", "planned_minutes": 15, "reason": "r"}]},  # unknown place
        {"stops": [{"poi_id": "node/1", "planned_minutes": 90, "reason": "r"}]},  # minutes
        {"stops": []},  # zero stops
        {"tips": "not a list"},
        {"unmet_wishes": [{"x": 1}]},  # wrong item type
    ],
)
def test_real_errors_still_reject_the_answer(fields):
    cleaned, invalid, _ = validate_answer(answer(**fields), CANDIDATES)
    assert cleaned is None
    assert invalid

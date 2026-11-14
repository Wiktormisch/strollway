"""The calorie estimate (audit idea 1)."""

import pytest

from planning.calories import estimate_kcal, met_for_pace


@pytest.mark.parametrize(
    ("pace", "expected"),
    [
        (2.0, 2.3),  # below the table: first value
        (2.5, 2.3),
        (3.6, 2.9),  # halfway between 3.2 and 4.0
        (4.0, 3.0),
        (6.0, 4.3),  # above the table: last value
    ],
)
def test_met_for_pace(pace, expected):
    assert met_for_pace(pace) == pytest.approx(expected)


def test_estimate_kcal_one_hour_at_4_kmh():
    # 3.0 MET x 70 kg x 1 h = 210 kcal, +5% for the stroller = 220.5
    assert estimate_kcal(4000, 4.0) == 220
    assert estimate_kcal(4000, 4.0, stroller=False) == 210


@pytest.mark.parametrize(("distance", "pace"), [(0, 4.0), (-10, 4.0), (1000, 0)])
def test_estimate_kcal_is_zero_for_empty_input(distance, pace):
    assert estimate_kcal(distance, pace) == 0

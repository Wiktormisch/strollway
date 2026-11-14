"""The pace used for walking times (audit idea 3)."""

from types import SimpleNamespace

import pytest

from planning.services import pace_kmh_for


def profile(wheels="none", pace_kmh=3.5):
    return SimpleNamespace(wheels=wheels, pace_kmh=pace_kmh)


@pytest.mark.parametrize(
    ("given_profile", "pace", "expected"),
    [
        (None, None, 4.0),  # no profile: stroller pace
        (None, 5.0, 5.0),  # planner pace without a profile
        (profile(pace_kmh=3.0), None, 3.0),
        (profile(pace_kmh=3.0), 5.5, 5.5),  # planner pace wins
        (profile("stroller", 4.5), None, 4.0),  # stroller safety net
        (profile("stroller", 3.5), 5.0, 4.0),
        (profile("kid_bike", 5.5), None, 5.5),
    ],
)
def test_pace_kmh_for(given_profile, pace, expected):
    assert pace_kmh_for(given_profile, pace) == expected

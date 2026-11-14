import json
from datetime import datetime

import pytest

from planning import best_time, weather

# Wednesday 2026-11-11, 10:00 local time; the fake forecast starts on that day.
NOW = datetime(2026, 11, 11, 10, 0)
FORECAST = weather.parse_hourly(json.loads(weather.MOCK_FORECAST_PATH.read_text("utf-8")))

GOOD_HOUR = {
    "temp_c": 20.0,
    "precip_probability": 0,
    "precip_mm": 0.0,
    "wind_kmh": 5.0,
    "sunshine_s": 3600,
    "weather_code": 0,
}


def hour(**changes):
    return {**GOOD_HOUR, **changes}


def test_perfect_hour_scores_100():
    assert best_time.score_hour(GOOD_HOUR) == 100


@pytest.mark.parametrize(
    "changes",
    [
        {"weather_code": 95},
        {"weather_code": 99},
        {"precip_mm": 2.0},
        {"wind_kmh": 40.0},
    ],
)
def test_storm_heavy_rain_and_strong_wind_rule_the_hour_out(changes):
    assert best_time.score_hour(hour(**changes)) is None


def test_light_rain_and_breeze_do_not_rule_the_hour_out():
    assert best_time.score_hour(hour(precip_mm=1.9, wind_kmh=39.0)) is not None


def test_weights_follow_the_agreed_order():
    # Losing all of one factor costs: sun 40, wind 25, temperature 25, rain 10 points.
    assert best_time.score_hour(hour(sunshine_s=0)) == 60
    assert best_time.score_hour(hour(wind_kmh=39.99)) == 75
    assert best_time.score_hour(hour(temp_c=0.0)) == 75
    assert best_time.score_hour(hour(temp_c=32.0)) == 75
    assert best_time.score_hour(hour(precip_probability=100)) == 90


def test_mild_temperature_range_gets_full_points():
    assert best_time.score_hour(hour(temp_c=15.0)) == 100
    assert best_time.score_hour(hour(temp_c=24.0)) == 100


def test_missing_values_count_as_average():
    assert best_time.score_hour({"time": "x"}) == 50


@pytest.mark.parametrize(("score", "name"), [(75, "great"), (74, "good"), (55, "good"), (35, "ok")])
def test_labels(score, name):
    assert best_time.label(score) == name


def test_best_windows_from_the_fixture():
    windows = best_time.best_windows(FORECAST, now=NOW)

    summary = [(w["day_offset"], w["start"], w["end"], w["label"]) for w in windows]
    # Day 2 is calm and sunny after the wind drops; today the sun shines 11-15;
    # tomorrow (rain and a storm) has no window at all.
    assert summary == [
        (2, "12:00", "16:00", "great"),
        (0, "11:00", "15:00", "great"),
        (0, "15:00", "16:00", "good"),
    ]
    first = windows[0]
    assert first["date"] == "2026-11-13"
    assert first["hours"] == 4
    assert first["temp_c"] == 9.0
    assert first["precip_probability"] == 5
    assert first["wind_kmh"] == 8.0
    assert first["sunshine_pct"] == 100


def test_past_hours_and_night_hours_are_skipped():
    windows = best_time.best_windows(FORECAST, now=datetime(2026, 11, 13, 14, 40))

    assert [(w["start"], w["end"]) for w in windows] == [("15:00", "16:00"), ("16:00", "20:00")]


def test_current_hour_counts_in_its_first_half():
    forecast = {"utc_offset_s": 0, "hours": [{**GOOD_HOUR, "time": "2026-11-11T10:00"}]}

    assert best_time.best_windows(forecast, now=datetime(2026, 11, 11, 10, 29))
    assert not best_time.best_windows(forecast, now=datetime(2026, 11, 11, 10, 30))


def test_hours_outside_8_to_20_never_count():
    hours = [{**GOOD_HOUR, "time": f"2026-11-11T{h:02d}:00"} for h in (7, 20)]

    assert (
        best_time.best_windows({"utc_offset_s": 0, "hours": hours}, now=NOW.replace(hour=0)) == []
    )


def test_at_most_three_windows():
    hours = [
        {**GOOD_HOUR, "time": f"2026-11-1{day}T{h:02d}:00", "sunshine_s": 0 if h % 2 else 3600}
        for day in (1, 2, 3)
        for h in range(8, 20)
    ]

    windows = best_time.best_windows({"utc_offset_s": 0, "hours": hours}, now=NOW.replace(hour=0))

    assert len(windows) == 3
    assert all(w["label"] == "great" for w in windows)


def test_local_now_uses_the_offset_of_the_point():
    utc = best_time.local_now(0)
    assert round((best_time.local_now(3600) - utc).total_seconds()) == 3600

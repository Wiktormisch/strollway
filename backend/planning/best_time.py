"""Best time for a walk in the next 3 days (audit idea 2). Pure code, no LLM.

Every daytime hour gets a score from 0 to 100. The weights follow the developer's order
(docs/DECISIONS.md, section 13): sunshine counts most, then calm wind and a mild
temperature (equal), and a low chance of rain counts least. A thunderstorm, heavy rain
or a strong wind rule an hour out. Hours next to each other with the same label
(great / good / ok) form a window, so a great midday is not hidden in a long average.
"""

from datetime import UTC, date, datetime, timedelta

# A walk starts at 8:00 at the earliest and ends by 20:00, so hours 8..19 count.
FIRST_HOUR = 8
LAST_HOUR = 19

HEAVY_RAIN_MM = 2.0  # per hour
STRONG_WIND_KMH = 40
THUNDERSTORM_CODES = range(95, 100)  # WMO weather codes

WEIGHTS = {"sun": 0.40, "wind": 0.25, "temp": 0.25, "rain": 0.10}
CALM_WIND_KMH = 10  # full points at or below this
IDEAL_TEMP_C = (15, 24)  # full points inside this range
TEMP_ZERO_BELOW_C = 0  # no points at or below this ...
TEMP_ZERO_ABOVE_C = 32  # ... or at or above this

MIN_SCORE = 35  # weaker hours never form a window
LABELS = [(75, "great"), (55, "good"), (MIN_SCORE, "ok")]
MAX_WINDOWS = 3


def score_hour(hour):
    """A score from 0 to 100, or None when the weather rules the hour out."""
    code = hour.get("weather_code")
    if code is not None and code in THUNDERSTORM_CODES:
        return None
    if (hour.get("precip_mm") or 0) >= HEAVY_RAIN_MM:
        return None
    if (hour.get("wind_kmh") or 0) >= STRONG_WIND_KMH:
        return None
    parts = {
        "sun": _sun_part(hour.get("sunshine_s")),
        "wind": _wind_part(hour.get("wind_kmh")),
        "temp": _temp_part(hour.get("temp_c")),
        "rain": _rain_part(hour.get("precip_probability")),
    }
    return round(100 * sum(WEIGHTS[name] * value for name, value in parts.items()))


def best_windows(forecast, now=None):
    """Up to 3 windows, the best first. `now` is local time at the point (naive)."""
    now = now or local_now(forecast["utc_offset_s"])
    scored = []
    for hour in forecast["hours"]:
        start = datetime.fromisoformat(hour["time"])
        if not _counts(start, now):
            continue
        score = score_hour(hour)
        if score is not None and score >= MIN_SCORE:
            scored.append((start, score, hour))
    windows = [_window(group, now.date()) for group in _consecutive(scored)]
    # Best score first; on a tie the longer window, then the earlier one.
    windows.sort(key=lambda w: (-w["score"], -w["hours"], w["date"], w["start"]))
    return windows[:MAX_WINDOWS]


def local_now(utc_offset_s):
    return (datetime.now(UTC) + timedelta(seconds=utc_offset_s)).replace(tzinfo=None)


def label(score):
    return next(name for limit, name in LABELS if score >= limit)


def _counts(start, now):
    # The current hour still counts in its first half: at 10:20 "from 10:00" is fine.
    in_daytime = FIRST_HOUR <= start.hour <= LAST_HOUR
    return in_daytime and start + timedelta(minutes=30) > now


def _consecutive(scored):
    """Splits the scored hours where an hour is missing or the label changes."""
    group = []
    for item in scored:
        if group:
            last_start, last_score, _ = group[-1]
            gap = item[0] - last_start != timedelta(hours=1)
            if gap or label(item[1]) != label(last_score):
                yield group
                group = []
        group.append(item)
    if group:
        yield group


def _window(group, today: date):
    start, end = group[0][0], group[-1][0] + timedelta(hours=1)
    hours = [hour for _, _, hour in group]
    score = round(sum(score for _, score, _ in group) / len(group))
    return {
        "date": start.date().isoformat(),
        "day_offset": (start.date() - today).days,
        "start": start.strftime("%H:%M"),
        "end": end.strftime("%H:%M"),
        "hours": len(group),
        "score": score,
        "label": label(score),
        "temp_c": _average([h["temp_c"] for h in hours]),
        "precip_probability": _maximum([h["precip_probability"] for h in hours]),
        "wind_kmh": _maximum([h["wind_kmh"] for h in hours]),
        "sunshine_pct": _sunshine_pct([h["sunshine_s"] for h in hours]),
    }


def _sun_part(sunshine_s):
    return 0.5 if sunshine_s is None else _clamp(sunshine_s / 3600)


def _wind_part(wind_kmh):
    if wind_kmh is None:
        return 0.5
    return _clamp(1 - (wind_kmh - CALM_WIND_KMH) / (STRONG_WIND_KMH - CALM_WIND_KMH))


def _temp_part(temp_c):
    if temp_c is None:
        return 0.5
    low, high = IDEAL_TEMP_C
    if temp_c < low:
        return _clamp((temp_c - TEMP_ZERO_BELOW_C) / (low - TEMP_ZERO_BELOW_C))
    if temp_c > high:
        return _clamp((TEMP_ZERO_ABOVE_C - temp_c) / (TEMP_ZERO_ABOVE_C - high))
    return 1.0


def _rain_part(probability):
    return 0.5 if probability is None else _clamp(1 - probability / 100)


def _clamp(value):
    return max(0.0, min(1.0, value))


def _known(values):
    return [v for v in values if v is not None]


def _average(values):
    known = _known(values)
    return round(sum(known) / len(known), 1) if known else None


def _maximum(values):
    known = _known(values)
    return max(known) if known else None


def _sunshine_pct(values):
    known = _known(values)
    return round(100 * sum(known) / (3600 * len(known))) if known else None

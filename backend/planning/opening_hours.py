"""A small parser for the most common OSM `opening_hours` patterns (docs/DECISIONS.md).

Supported: "24/7"; rules like "Mo-Fr 08:00-18:00", "Sa,Su 10:00-14:00", "Mo off",
"10:00-20:00" (every day), several time ranges ("08:00-12:00,13:00-17:00"), and several
rules separated by ";" (a later rule replaces earlier ones for its days, as in OSM).
Anything else (public holidays, months, times past midnight, comments) is unknown: None.
"""

import re
from datetime import time

from django.utils import timezone

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
DAY_PART = r"(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?"
DAYS_RE = re.compile(rf"^{DAY_PART}(?:,{DAY_PART})*$")
RANGE_RE = re.compile(r"^(\d{2}):(\d{2})-(\d{2}):(\d{2})$")


class Unsupported(Exception):
    pass


def is_open(text, now=None):
    """True / False for a supported pattern, None when unknown. `now` is local time."""
    if not text:
        return None
    now = now or _now()
    try:
        week = parse(text)
    except Unsupported:
        return None
    current = now.time().replace(second=0, microsecond=0)
    return any(start <= current < end for start, end in week[now.weekday()])


def _now():
    """Local time (TIME_ZONE). Tests replace this function with a fixed clock."""
    return timezone.localtime()


def parse(text):
    """{weekday 0-6: [(start, end), ...]} (an empty list = closed that day)."""
    text = text.strip()
    if text == "24/7":
        return {day: [(time(0, 0), time.max)] for day in range(7)}
    week = {day: [] for day in range(7)}
    for rule in filter(None, (part.strip() for part in text.split(";"))):
        days, ranges = _split_rule(rule)
        for day in days:
            week[day] = ranges
    return week


def _split_rule(rule):
    parts = rule.split()
    if len(parts) == 1:  # "10:00-20:00": every day
        return range(7), _ranges(parts[0])
    if len(parts) != 2 or not DAYS_RE.match(parts[0]):
        raise Unsupported(rule)
    days = _days(parts[0])
    if parts[1] == "off":
        return days, []
    return days, _ranges(parts[1])


def _days(spec):
    result = []
    for part in spec.split(","):
        first, _, last = part.partition("-")
        start, end = DAYS.index(first), DAYS.index(last or first)
        if end < start:  # "Sa-Mo" wraps over the week end
            result += [*range(start, 7), *range(0, end + 1)]
        else:
            result += list(range(start, end + 1))
    return result


def _ranges(spec):
    ranges = []
    for part in spec.split(","):
        match = RANGE_RE.match(part)
        if not match:
            raise Unsupported(spec)
        h1, m1, h2, m2 = map(int, match.groups())
        if h1 > 23 or m1 > 59 or m2 > 59 or h2 > 24 or (h2 == 24 and m2):
            raise Unsupported(spec)
        start = time(h1, m1)
        end = time.max if h2 == 24 else time(h2, m2)
        if end <= start:  # past midnight: not supported
            raise Unsupported(spec)
        ranges.append((start, end))
    return ranges

"""A small parser for the most common OSM `opening_hours` patterns (docs/DECISIONS.md).

Supported: "24/7"; rules like "Mo-Fr 08:00-18:00", "Sa,Su 10:00-14:00", "Mo off",
"10:00-20:00" (every day), several time ranges ("08:00-12:00,13:00-17:00"), and several
rules separated by ";" (a later rule replaces earlier ones for its days, as in OSM), and
rules separated by "," ("Mo-Sa 10:00-22:00, Su 11:00-20:00"; treated like ";").
"PH" (public holiday) inside a day list ("Su,PH off") is ignored, and a rule only for "PH"
is skipped: we have no holiday calendar, so on a public holiday the answer can be wrong.
Anything else (months, times past midnight, comments) is unknown: None.
"""

import re
from datetime import time

from django.utils import timezone

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
DAY_PART = r"(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?"
DAYS_RE = re.compile(rf"^{DAY_PART}(?:,{DAY_PART})*$")
# A "," between two rules: after a time or "off", before a day name ("..-24:00, Su 11:00..").
# "Sa,Su" and "08:00-12:00,13:00-17:00" do not match, so they stay one rule.
RULE_COMMA_RE = re.compile(r"(?<=\d|f),\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)")
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
    for rule in filter(None, (part.strip() for part in _rules(text))):
        days, ranges = _split_rule(rule)
        for day in days:
            week[day] = ranges
    return week


def _rules(text):
    for part in text.split(";"):
        yield from RULE_COMMA_RE.split(part)


def _split_rule(rule):
    parts = rule.split()
    if len(parts) == 1:  # "10:00-20:00": every day
        return range(7), _ranges(parts[0])
    if len(parts) != 2:
        raise Unsupported(rule)
    day_spec = _without_public_holidays(parts[0])
    if day_spec == "":  # a rule only for "PH": skipped, see the module docstring
        return [], []
    if not DAYS_RE.match(day_spec):
        raise Unsupported(rule)
    days = _days(day_spec)
    if parts[1] == "off":
        return days, []
    return days, _ranges(parts[1])


def _without_public_holidays(spec):
    """'Su,PH' -> 'Su', 'PH' -> ''. Other tokens are checked later by DAYS_RE."""
    return ",".join(part for part in spec.split(",") if part != "PH")


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

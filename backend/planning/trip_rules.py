"""The rule-based trip planner: mock mode and the last fallback for every LLM backend.

It returns the same shape as a valid LLM answer (docs/PLAN.md D.6), so the rest of the
flow does not care who planned the trip:
    {"summary": str, "stops": [{"poi_id", "planned_minutes", "reason"}],
     "unmet_wishes": [str], "tips": [str]}
"""

import re
from dataclasses import dataclass

from planning import geo

# Categories with opening hours worth checking, and helpers that are not a goal alone.
HAS_HOURS = {"cafe", "restaurant", "museum", "zoo", "shop", "indoor_play"}
AMENITIES = {"toilets", "water"}

# A plan may be this much over max_minutes (the same rule as in trip_planner).
LIMIT_TOLERANCE = 1.1

# Streets are not straight lines. Used for the time estimate before routing.
DETOUR_FACTOR = 1.3
MAX_STOPS = 4

# Minutes at a stop by category (inside the 5-60 range that LLM answers must keep too).
STOP_MINUTES = {
    "playground": 30,
    "indoor_play": 60,
    "cafe": 20,
    "restaurant": 30,
    "toilets": 5,
    "water": 5,
    "park": 30,
    "zoo": 60,
    "museum": 60,
    "beach": 45,
    "shop": 15,
}

LABELS = {
    "pl": {
        "playground": "plac zabaw",
        "indoor_play": "sala zabaw",
        "cafe": "kawiarnia",
        "ice_cream": "lody",
        "restaurant": "restauracja",
        "pizza": "pizza",
        "toilets": "toaleta",
        "water": "woda pitna",
        "park": "park",
        "zoo": "zoo",
        "museum": "muzeum",
        "beach": "plaża",
        "shop": "sklep",
    },
    "en": {
        "playground": "playground",
        "indoor_play": "indoor play",
        "cafe": "cafe",
        "ice_cream": "ice cream",
        "restaurant": "restaurant",
        "pizza": "pizza",
        "toilets": "toilets",
        "water": "drinking water",
        "park": "park",
        "zoo": "zoo",
        "museum": "museum",
        "beach": "beach",
        "shop": "shop",
    },
}

TEXTS = {
    "pl": {
        "summary": "Plan z prostych reguł: {names}.",
        "reason": "Najbliższe miejsce tego typu, około {distance} m od startu.",
        "missing": "{label}: brak w pobliżu",
        "too_long": "{label}: nie mieści się w czasie",
        "hours_unknown": "Godziny otwarcia części miejsc nie są znane. Sprawdź je przed wyjściem.",
    },
    "en": {
        "summary": "A plan from simple rules: {names}.",
        "reason": "The closest place of this kind, about {distance} m from the start.",
        "missing": "{label}: none nearby",
        "too_long": "{label}: does not fit in the time limit",
        "hours_unknown": "Opening hours of some places are unknown. Check them before you go.",
    },
}


@dataclass(frozen=True)
class Want:
    """One wish: a category, optionally a cuisine. `strict` = the cuisine is required."""

    key: str  # label key, also used for unmet wishes
    category: str
    cuisine: str | None = None
    strict: bool = False


# Keywords (PL and EN) -> what they ask for. See _pattern for how they match.
KEYWORDS = [
    (
        ("plac zabaw", "placu zabaw", "playground", "huśtawk", "zjeżdżal", "swing"),
        Want("playground", "playground"),
    ),
    (
        ("sala zabaw", "sali zabaw", "salę zabaw", "salą zabaw", "indoor play", "soft play"),
        Want("indoor_play", "indoor_play"),
    ),
    (
        ("lody", "lodów", "lodziar", "ice cream", "ice-cream", "gelato"),
        Want("ice_cream", "cafe", "ice_cream"),
    ),
    # "kawa", "kawy", "kawę", "kawiarnia", but not "kawałek" ("a bit").
    (("kawa$", "kawy$", "kawę$", "kawk", "kawiar", "coffee", "cafe", "café"), Want("cafe", "cafe")),
    (("pizz",), Want("pizza", "restaurant", "pizza", strict=True)),
    (
        (
            "obiad",
            "jedzeni",
            "zjeść",
            "restaurac",
            "lunch",
            "dinner",
            "food",
            "hungry",
            "eat$",
            "głod",
            "burger",
        ),
        Want("restaurant", "restaurant"),
    ),
    (("toalet", "wc", "toilet", "łazienk"), Want("toilets", "toilets")),
    (("woda", "wody", "water", "pić", "drink"), Want("water", "water")),
    (("park",), Want("park", "park")),
    (("zoo",), Want("zoo", "zoo")),
    (("muzeum", "museum"), Want("museum", "museum")),
    (("plaż", "beach", "morze", "sea$", "seaside"), Want("beach", "beach")),
    (("zakup", "sklep", "shop", "grocer", "piekarn", "bakery"), Want("shop", "shop")),
]


def parse_wishes(wishes):
    """Wishes in the order they appear in the text. Unknown words are ignored."""
    text = (wishes or "").lower()
    found = []
    for prefixes, want in KEYWORDS:
        positions = [m.start() for prefix in prefixes for m in re.finditer(_pattern(prefix), text)]
        if positions:
            found.append((min(positions), want))
    found.sort(key=lambda item: item[0])
    result = []
    for _, want in found:
        if want not in result:
            result.append(want)
    return result


def _pattern(keyword):
    """A keyword matches at a word start; a final "$" means the whole word only."""
    if keyword.endswith("$"):
        return r"\b" + re.escape(keyword[:-1]) + r"\b"
    return r"\b" + re.escape(keyword)


def default_wants(children_ages):
    """No wishes: a playground and a cafe for children of 2-8, otherwise a cafe."""
    if any(2 <= age <= 8 for age in children_ages):
        return [Want("playground", "playground"), Want("cafe", "cafe")]
    return [Want("cafe", "cafe")]


def estimate_minutes(start, points, speed_m_per_min, round_trip):
    """Walking minutes along straight lines x DETOUR_FACTOR (before the real route)."""
    path = [start, *points, start] if round_trip else [start, *points]
    metres = sum(geo.haversine_m(a, b) for a, b in zip(path, path[1:], strict=False))
    return metres * DETOUR_FACTOR / speed_m_per_min


def plan(candidates, wishes, children_ages, language, max_minutes, speed_m_per_min, round_trip):
    """Build a trip from rules. `candidates` come from pois.find_candidates."""
    texts, labels = TEXTS[language], LABELS[language]
    start = (0.0, 0.0)  # positions are relative; see _point
    wants = parse_wishes(wishes) or default_wants(children_ages)

    chosen, unmet = [], []
    for want in wants:
        if len(chosen) >= MAX_STOPS:
            break
        place = _closest(candidates, want, chosen)
        if place is None:
            unmet.append(texts["missing"].format(label=labels[want.key]))
            continue
        trial = [*chosen, place]
        minutes = _total_minutes(start, trial, speed_m_per_min, round_trip)
        if minutes > max_minutes * LIMIT_TOLERANCE:
            unmet.append(texts["too_long"].format(label=labels[want.key]))
            continue
        chosen.append(place)

    if not chosen:
        # Nothing from the wishes fits: offer the default list, then any real destination,
        # so the trip is not empty. Toilets and water are never a trip on their own.
        place = next(
            (p for w in default_wants(children_ages) if (p := _closest(candidates, w, []))),
            None,
        ) or _closest(candidates, None, [])
        if place is not None:
            chosen.append(place)

    return _answer(chosen, unmet, texts, labels)


def _closest(candidates, want, chosen):
    """The closest place that is not closed and not chosen yet (candidates sorted by distance)."""
    used = {place["poi_id"] for place in chosen}
    options = [c for c in candidates if c["poi_id"] not in used and c.get("open_now") is not False]
    if want is None:
        options = [c for c in options if c["category"] not in AMENITIES]
    else:
        options = [c for c in options if c["category"] == want.category]
    if want and want.cuisine:
        exact = [c for c in options if want.cuisine in (c.get("cuisine") or "").lower()]
        if exact or want.strict:
            options = exact
    return min(options, key=lambda c: c["distance_m"], default=None)


def _point(place):
    # Relative metres are enough for distances here; the start is (0, 0).
    return (place["north_m"], place["east_m"])


def _total_minutes(start, places, speed_m_per_min, round_trip):
    path = [start, *(_point(p) for p in places)]
    if round_trip:
        path.append(start)
    metres = sum(
        ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
        for a, b in zip(path, path[1:], strict=False)
    )
    walking = metres * DETOUR_FACTOR / speed_m_per_min
    return walking + sum(STOP_MINUTES[p["category"]] for p in places)


def _answer(chosen, unmet, texts, labels):
    names = " → ".join(p["name"] or labels[p["category"]] for p in chosen)
    tips = []
    if any(p.get("open_now") is None and p["category"] in HAS_HOURS for p in chosen):
        tips.append(texts["hours_unknown"])
    return {
        "summary": texts["summary"].format(names=names) if chosen else "",
        "stops": [
            {
                "poi_id": p["poi_id"],
                "planned_minutes": STOP_MINUTES[p["category"]],
                "reason": texts["reason"].format(distance=p["distance_m"]),
            }
            for p in chosen
        ],
        "unmet_wishes": unmet,
        "tips": tips,
    }

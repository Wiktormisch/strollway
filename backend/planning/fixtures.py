"""Recorded answers for the three demo pairs (docs/DECISIONS.md, section 2).

A fixture file holds the raw ORS and Overpass answers, written by the
`record_fixtures` command. They go through the same parsers as live answers.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from planning import geo

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
MATCH_RADIUS_M = 100


@dataclass(frozen=True)
class DemoPair:
    number: int
    name: str
    start: tuple  # (lat, lng)
    end: tuple

    @property
    def path(self):
        return FIXTURES_DIR / f"pair_{self.number}.json"


DEMO_PAIRS = [
    DemoPair(1, "Big detour (Kartuska)", (54.347791, 18.618119), (54.34874, 18.618458)),
    DemoPair(2, "No step-free route (Hevelianum)", (54.3561, 18.6437), (54.3580, 18.6405)),
    DemoPair(3, "Tiny detour (Oliwa SKM -> Pacholek)", (54.4097, 18.5655), (54.4115, 18.5745)),
]


def find_demo_pair(start, end):
    """The demo pair whose start and end are both within ~100 m of the request, or None."""
    for pair in DEMO_PAIRS:
        if (
            geo.haversine_m(start, pair.start) <= MATCH_RADIUS_M
            and geo.haversine_m(end, pair.end) <= MATCH_RADIUS_M
        ):
            return pair
    return None


def load_fixture(pair):
    """The recorded data of a pair, or None when the file does not exist yet."""
    if pair is None or not pair.path.exists():
        return None
    return json.loads(pair.path.read_text(encoding="utf-8"))


def save_fixture(pair, data):
    FIXTURES_DIR.mkdir(exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=1)
    # newline="\n": LF on Windows too (the repo uses LF, see .gitattributes).
    pair.path.write_text(text + "\n", encoding="utf-8", newline="\n")


def trim_ors_body(body):
    """Keep only the fields we parse, so fixture files stay small."""
    if not isinstance(body, dict) or "routes" not in body:
        return {"error": body.get("error")} if isinstance(body, dict) else body
    raw = body["routes"][0]
    keep = ("summary", "geometry", "extras", "way_points")
    return {"routes": [{key: raw[key] for key in keep if key in raw}]}

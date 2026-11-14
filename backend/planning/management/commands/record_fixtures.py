"""Record real ORS and Overpass answers for the demo pairs and the demo trip start.

Run it by hand with ORS_API_KEY set in backend/.env. It writes planning/fixtures/pair_N.json
(default) or planning/fixtures/trip_demo.json (with --trip).

When Overpass is down, export the places from Overpass Turbo and pass the file:
`--pair 1 --overpass-file pair_1.json` replaces only the places of a saved pair (no ORS key
needed), `--trip --overpass-file trip.json` records the trip with these places.
"""

import json
import time
from datetime import timedelta
from itertools import product
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from planning import fixtures, pois, routing, services, trip_rules

# Wishes the demo uses (there is no cafe near the demo start; see DECISIONS.md).
DEMO_TRIP_WISHES = ["playground, ice cream, pizza", "plac zabaw, lody, pizza", ""]
DEMO_TRIP_MINUTES = [45, 60, 90, 120]
DEMO_TRIP_AGES = [[], [4]]


def _read_overpass_file(path):
    """A raw Overpass answer saved by hand. Checked like a live answer."""
    try:
        body = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Cannot read {path}: {exc}") from exc
    if not isinstance(body, dict) or not isinstance(body.get("elements"), list):
        raise CommandError(f"{path} has no 'elements' list (export raw data, not GeoJSON).")
    if "runtime error" in str(body.get("remark", "")).lower():
        raise CommandError(f"{path} is a failed query: {body['remark']}")
    return body


def _week_hours():
    """Every full hour of one week (local time). Opening hours change which places the
    rules pick, so the demo needs routes for each of these moments."""
    monday = timezone.localtime().replace(minute=30, second=0, microsecond=0)
    monday -= timedelta(days=monday.weekday())
    return [monday.replace(hour=h) + timedelta(days=d) for d in range(7) for h in range(24)]


def _demo_trip_point_lists(overpass, start):
    """Every point list the demo plans can route (each plan prefix, both trip kinds)."""
    speed = services.speed_m_per_min(None)
    seen = []
    for minutes, now in product(DEMO_TRIP_MINUTES, _week_hours()):
        radius = pois.trip_radius_m(speed, minutes)
        candidates = pois.parse_candidates(overpass, start, radius, now).pois
        for wishes in DEMO_TRIP_WISHES:
            for ages in DEMO_TRIP_AGES:
                for round_trip in (True, False):
                    answer = trip_rules.plan(
                        candidates, wishes, ages, "en", minutes, speed, round_trip
                    )
                    by_id = {c["poi_id"]: c for c in candidates}
                    stops = [by_id[s["poi_id"]] for s in answer["stops"]]
                    for size in range(1, len(stops) + 1):
                        points = [start, *((s["lat"], s["lng"]) for s in stops[:size])]
                        if round_trip:
                            points.append(start)
                        if points not in seen:
                            seen.append(points)
    return seen


class Command(BaseCommand):
    help = "Call the real ORS and Overpass APIs for the demo pairs and save the answers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pair", type=int, action="append", choices=[1, 2, 3], help="Only these pairs."
        )
        parser.add_argument(
            "--trip", action="store_true", help="Record the demo trip start instead of the pairs."
        )
        parser.add_argument(
            "--overpass-file",
            help=(
                "Read the places from this JSON file (raw data exported from Overpass Turbo) "
                "instead of calling Overpass. With --trip: the query of build_around_query. "
                "With one --pair: the query of query_for_route; only the places of the saved "
                "fixture are replaced, ORS is not called."
            ),
        )

    def _replace_pair_places(self, number, overpass_file):
        """Put places from a file into an existing pair fixture. Its ORS routes stay as they are."""
        pair = next(p for p in fixtures.DEMO_PAIRS if p.number == number)
        data = fixtures.load_fixture(pair)
        if data is None:
            raise CommandError(f"{pair.path.name} does not exist. Record the pair first.")
        body = _read_overpass_file(overpass_file)
        data["overpass"] = {"elements": body["elements"]}
        fixtures.save_fixture(pair, data)
        self.stdout.write(f"Pair {pair.number}: {pair.name}")
        self.stdout.write(f"  Overpass: {len(body['elements'])} elements from {overpass_file}")
        self.stdout.write(self.style.SUCCESS(f"  Saved {pair.path.name}"))

    def _record_trip(self, overpass_file=None):
        """Overpass around the demo start, then ORS routes for the rule-based demo plans.

        Every prefix of each plan is recorded, because the time limit loop may drop
        the last stops. Routes are keyed like the live cache (routing.cache_key).
        """
        start = fixtures.DEMO_TRIP_START
        self.stdout.write(f"Demo trip start {start}")
        if overpass_file:
            body = _read_overpass_file(overpass_file)
        else:
            try:
                query = pois.build_around_query(start, pois.TRIP_MAX_RADIUS_M)
                body = pois.request_overpass(query)
            except pois.OverpassUnavailable as exc:
                raise CommandError(
                    f"Overpass unavailable ({exc}). Run again later, or use --overpass-file."
                ) from exc
        overpass = {"elements": body["elements"]}
        self.stdout.write(f"  Overpass: {len(overpass['elements'])} elements")

        ors = {}
        for points in _demo_trip_point_lists(overpass, start):
            for avoid in (False, True):
                key = routing.cache_key(points, avoid)
                if key in ors:
                    continue
                try:
                    status, raw = routing.request_ors(points, avoid)
                except routing.UpstreamUnavailable as exc:
                    raise CommandError(f"ORS failed: {exc}") from exc
                # Only stable answers belong in a fixture (like the live cache).
                if status != 200 and routing.error_code(raw) not in (
                    routing.ORS_NO_ROUTE,
                    routing.ORS_NO_ROUTABLE_POINT,
                ):
                    raise CommandError(f"ORS answered {status}: {raw}")
                ors[key] = {"status": status, "body": fixtures.trim_ors_body(raw)}
                # ORS allows 40 requests per minute; this is a manual command, not a request.
                time.sleep(1.6)
        self.stdout.write(f"  ORS: {len(ors)} routes")
        data = {"start": list(start), "overpass": overpass, "ors": ors}
        fixtures.write_json(fixtures.trip_path(), data)
        self.stdout.write(self.style.SUCCESS(f"  Saved {fixtures.trip_path().name}"))

    def handle(self, *args, **options):
        overpass_file = options["overpass_file"]
        pairs = options["pair"] or []
        if overpass_file and not options["trip"]:
            if len(pairs) != 1:
                raise CommandError("--overpass-file works only with --trip or with one --pair.")
            # Only the places change, so no ORS call and no key are needed.
            self._replace_pair_places(pairs[0], overpass_file)
            return
        if not settings.ORS_API_KEY:
            raise CommandError("ORS_API_KEY is not set in backend/.env.")
        if options["trip"]:
            self._record_trip(options["overpass_file"])
            return
        wanted = options["pair"] or [pair.number for pair in fixtures.DEMO_PAIRS]
        for pair in fixtures.DEMO_PAIRS:
            if pair.number in wanted:
                self._record(pair)

    def _record(self, pair):
        self.stdout.write(f"Pair {pair.number}: {pair.name}")
        ors = {}
        for name, avoid in (("normal", False), ("avoid", True)):
            try:
                status, body = routing.request_ors([pair.start, pair.end], avoid)
            except routing.UpstreamUnavailable as exc:
                raise CommandError(f"ORS failed: {exc}") from exc
            if status != 200 and routing.error_code(body) != routing.ORS_NO_ROUTE:
                raise CommandError(f"ORS answered {status}: {body}")
            ors[name] = {"status": status, "body": fixtures.trim_ors_body(body)}
            self.stdout.write(f"  ORS {name}: HTTP {status}")

        # Places along the route a family would walk: step-free if it exists.
        chosen = ors["avoid"] if ors["avoid"]["status"] == 200 else ors["normal"]
        geometry = routing.parse_ors_response(chosen["status"], chosen["body"]).geometry
        try:
            body = pois.request_overpass(pois.query_for_route(geometry, pair.start, pair.end))
            overpass = {"elements": body["elements"]}
            self.stdout.write(f"  Overpass: {len(overpass['elements'])} elements")
        except pois.OverpassUnavailable as exc:
            overpass = None
            self.stdout.write(
                self.style.WARNING(f"  Overpass unavailable ({exc}); run again later.")
            )

        fixtures.save_fixture(
            pair,
            {
                "pair": pair.number,
                "name": pair.name,
                "start": list(pair.start),
                "end": list(pair.end),
                "ors": ors,
                "overpass": overpass,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"  Saved {pair.path.name}"))

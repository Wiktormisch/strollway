"""Record real ORS and Overpass answers for the three demo pairs.

Run it by hand with ORS_API_KEY set in backend/.env. It writes planning/fixtures/pair_N.json.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from planning import fixtures, pois, routing


class Command(BaseCommand):
    help = "Call the real ORS and Overpass APIs for the demo pairs and save the answers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pair", type=int, action="append", choices=[1, 2, 3], help="Only these pairs."
        )

    def handle(self, *args, **options):
        if not settings.ORS_API_KEY:
            raise CommandError("ORS_API_KEY is not set in backend/.env.")
        wanted = options["pair"] or [pair.number for pair in fixtures.DEMO_PAIRS]
        for pair in fixtures.DEMO_PAIRS:
            if pair.number in wanted:
                self._record(pair)

    def _record(self, pair):
        self.stdout.write(f"Pair {pair.number}: {pair.name}")
        ors = {}
        for name, avoid in (("normal", False), ("avoid", True)):
            try:
                status, body = routing.request_ors(pair.start, pair.end, avoid)
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

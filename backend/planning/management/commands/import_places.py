"""Load places from an Overpass Turbo export into the Place table.

Usage (from backend/): python manage.py import_places data/places_tricity.json.gz

The export query is in docs/DECISIONS.md section 11. Only elements with a tag we use are
kept, with a few tags each. The old places are replaced in one transaction, so running the
command again is safe, and a bad file changes nothing.
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from planning import places


class Command(BaseCommand):
    help = "Replace the Place table with places from an Overpass JSON export (.json or .json.gz)."

    def add_arguments(self, parser):
        parser.add_argument("file", type=Path, help="Overpass export: raw OSM data as JSON.")

    def handle(self, *args, **options):
        path = options["file"]
        try:
            rows = places.parse_export(places.read_export(path))
            record = places.replace_places(rows, path.name)
        except places.ImportFileError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Imported {record.place_count} places from {path}."))
        self.stdout.write(
            f"Area: lat {record.min_lat:.4f}-{record.max_lat:.4f}, "
            f"lng {record.min_lng:.4f}-{record.max_lng:.4f}"
        )
        for category, count in places.count_by_category(rows).items():
            self.stdout.write(f"  {category}: {count}")

"""The committed OpenAPI schema must match the code.

The frontend generates its TypeScript types from `backend/openapi.yml`, so a stale file
means wrong types. After an API change, run:
    python manage.py spectacular --file openapi.yml --validate --fail-on-warn
"""

from pathlib import Path

from django.core.management import call_command

SCHEMA_FILE = Path(__file__).resolve().parent.parent / "openapi.yml"


def test_committed_schema_is_up_to_date(tmp_path):
    fresh = tmp_path / "openapi.yml"

    # --fail-on-warn makes the command fail on schema warnings, so this test catches them too.
    call_command("spectacular", file=str(fresh), validate=True, fail_on_warn=True)

    assert SCHEMA_FILE.read_text(encoding="utf-8") == fresh.read_text(encoding="utf-8"), (
        "backend/openapi.yml is out of date. Run: "
        "python manage.py spectacular --file openapi.yml --validate --fail-on-warn"
    )

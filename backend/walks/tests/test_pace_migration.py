"""Migration 0005 keeps today's walking times for old profiles."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("walks", "0004_stop_category_skatepark")]
AFTER = [("walks", "0005_profile_pace_kmh")]


def migrate(targets):
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps


@pytest.mark.django_db(transaction=True)
def test_old_paces_become_kmh_and_back():
    old_apps = migrate(BEFORE)
    Profile = old_apps.get_model("walks", "FamilyProfile")
    rows = {
        "relaxed": ("none", "relaxed"),
        "normal": ("none", "normal"),
        "normal stroller": ("stroller", "normal"),
    }
    for name, (wheels, pace) in rows.items():
        Profile.objects.create(client_id="c", name=name, wheels=wheels, pace=pace)

    new_apps = migrate(AFTER)
    Profile = new_apps.get_model("walks", "FamilyProfile")
    paces = dict(Profile.objects.values_list("name", "pace_kmh"))
    assert paces == {"relaxed": 3.5, "normal": 4.5, "normal stroller": 4.0}

    Profile = migrate(BEFORE).get_model("walks", "FamilyProfile")
    paces = dict(Profile.objects.values_list("name", "pace"))
    assert paces == {"relaxed": "relaxed", "normal": "normal", "normal stroller": "normal"}
    migrate(AFTER)

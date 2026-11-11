import json

import pytest
from django.core.management import CommandError, call_command

from planning import fixtures
from planning.tests.conftest import load


@pytest.fixture
def tmp_fixtures(tmp_path, monkeypatch):
    monkeypatch.setattr(fixtures, "FIXTURES_DIR", tmp_path)
    return tmp_path


def test_records_raw_answers_including_2009(ors, overpass, tmp_fixtures):
    ors.add(body=load("ors_pair2_normal.json")).add(
        status=404, body=load("ors_pair2_avoid_2009.json")
    )
    overpass.add(body={"elements": [{"type": "node", "id": 1, "lat": 54.357, "lon": 18.642}]})

    call_command("record_fixtures", pair=[2])

    data = json.loads((tmp_fixtures / "pair_2.json").read_text(encoding="utf-8"))
    assert data["ors"]["normal"]["status"] == 200
    assert data["ors"]["avoid"] == {"status": 404, "body": load("ors_pair2_avoid_2009.json")}
    assert len(data["overpass"]["elements"]) == 1
    assert set(data["ors"]["normal"]["body"]["routes"][0]) <= {
        "summary", "geometry", "extras", "way_points",
    }  # fmt: skip


def test_overpass_failure_saves_route_without_places(ors, overpass, tmp_fixtures):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))
    overpass.add(status=504, body={})

    call_command("record_fixtures", pair=[3])

    data = json.loads((tmp_fixtures / "pair_3.json").read_text(encoding="utf-8"))
    assert data["overpass"] is None


def test_missing_key_is_a_clear_error(tmp_fixtures):
    with pytest.raises(CommandError, match="ORS_API_KEY"):
        call_command("record_fixtures")
    assert list(tmp_fixtures.iterdir()) == []


def test_ors_failure_stops_without_writing(ors, tmp_fixtures):
    ors.add(status=503, body={})
    with pytest.raises(CommandError):
        call_command("record_fixtures", pair=[3])
    assert list(tmp_fixtures.iterdir()) == []


def test_fixture_file_uses_lf_line_endings(ors, overpass, tmp_fixtures):
    ors.add(body=load("ors_pair3_normal.json")).add(body=load("ors_pair3_avoid.json"))
    overpass.add(body={"elements": []})

    call_command("record_fixtures", pair=[3])

    assert b"\r\n" not in (tmp_fixtures / "pair_3.json").read_bytes()

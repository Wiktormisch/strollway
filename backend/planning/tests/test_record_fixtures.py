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


def test_records_the_demo_trip_with_every_plan_prefix(ors, overpass, tmp_fixtures, monkeypatch):
    from planning.management.commands import record_fixtures

    monkeypatch.setattr(record_fixtures.time, "sleep", lambda s: None)
    playground = {"type": "node", "id": 1, "lat": 54.3391, "lon": 18.6195,
                  "tags": {"leisure": "playground"}}  # fmt: skip
    overpass.add(body={"elements": [playground]})
    for _ in range(20):
        ors.add(body=load("ors_pair3_normal.json"))

    call_command("record_fixtures", trip=True)

    data = json.loads((tmp_fixtures / fixtures.TRIP_FILE).read_text(encoding="utf-8"))
    assert data["overpass"]["elements"] == [playground]
    # One stop: a loop and a one-way trip, each normal and avoid-steps.
    assert len(data["ors"]) == 4
    assert all(key.startswith("ors:54.3385:18.62:") for key in data["ors"])


def test_trip_places_can_come_from_a_file(ors, overpass, tmp_fixtures, tmp_path, monkeypatch):
    from planning.management.commands import record_fixtures

    monkeypatch.setattr(record_fixtures.time, "sleep", lambda s: None)
    playground = {"type": "node", "id": 1, "lat": 54.3391, "lon": 18.6195,
                  "tags": {"leisure": "playground"}}  # fmt: skip
    exported = tmp_path / "export.json"
    exported.write_text(json.dumps({"version": 0.6, "elements": [playground]}), encoding="utf-8")
    for _ in range(4):
        ors.add(body=load("ors_pair3_normal.json"))

    call_command("record_fixtures", trip=True, overpass_file=str(exported))

    data = json.loads((tmp_fixtures / fixtures.TRIP_FILE).read_text(encoding="utf-8"))
    assert data["overpass"]["elements"] == [playground]
    assert overpass.requests == []  # no live Overpass call


@pytest.mark.parametrize(
    "content",
    ["not json", '{"type": "FeatureCollection"}', '{"elements": [], "remark": "runtime error: x"}'],
)
def test_bad_overpass_file_is_a_clear_error(ors, tmp_fixtures, tmp_path, content):
    exported = tmp_path / "export.json"
    exported.write_text(content, encoding="utf-8")

    with pytest.raises(CommandError):
        call_command("record_fixtures", trip=True, overpass_file=str(exported))


def test_overpass_file_needs_trip(ors, tmp_path):
    with pytest.raises(CommandError):
        call_command("record_fixtures", overpass_file=str(tmp_path / "x.json"))


def test_trip_recording_stops_on_a_temporary_ors_error(ors, overpass, tmp_fixtures, monkeypatch):
    from planning.management.commands import record_fixtures

    monkeypatch.setattr(record_fixtures.time, "sleep", lambda s: None)
    playground = {"type": "node", "id": 1, "lat": 54.3391, "lon": 18.6195,
                  "tags": {"leisure": "playground"}}  # fmt: skip
    overpass.add(body={"elements": [playground]})
    ors.add(status=429, body={"error": "rate limit"})

    with pytest.raises(CommandError):
        call_command("record_fixtures", trip=True)
    assert not (tmp_fixtures / fixtures.TRIP_FILE).exists()

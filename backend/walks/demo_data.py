"""Sample data for one client: 1 profile and 2 walks in Gdansk with stops.

The numbers come from demo pairs 1 and 3 in docs/DECISIONS.md (real ORS answers).
When a recorded fixture exists (planning/fixtures/, written by `record_fixtures`),
the geometry and the numbers come from it. Otherwise a straight line is used.
No network calls here: seeding must work offline.
"""

from django.db import transaction

from planning import fixtures, geo, routing, services
from walks.models import FamilyProfile, Stop, Walk

DEMO_PROFILE_NAME = "Weekend with a stroller"

DEMO_WALKS = [
    {
        # Pair 1: big detour. Shortest route 132.4 m with 16 m of stairs; step-free 420.1 m, 302 s.
        "pair": 1,
        "name": "Kartuska: around the stairs",
        "start_lat": 54.347791,
        "start_lng": 18.618119,
        "end_lat": 54.34874,
        "end_lng": 18.618458,
        "start_label": "Kartuska",
        "end_label": "Kartuska, upper street",
        "distance_m": 420,
        "duration_min": 5,
        "stairs_m": 0,
        "stairs_avoided_m": 16,
        "detour_m": 288,
        "status": Walk.Status.DONE,
        "rating": 4,
        "stops": [
            {"order": 1, "name": "", "category": Stop.Category.BENCH, "planned_minutes": 5},
        ],
    },
    {
        # Pair 3: tiny detour. Shortest route 826.6 m with 12.6 m of stairs; step-free 832.8 m.
        "pair": 3,
        "name": "Oliwa SKM to Pacholek",
        "start_lat": 54.4097,
        "start_lng": 18.5655,
        "end_lat": 54.4115,
        "end_lng": 18.5745,
        "start_label": "Gdansk Oliwa SKM",
        "end_label": "Pacholek",
        "distance_m": 833,
        "duration_min": 10,
        "stairs_m": 0,
        "stairs_avoided_m": 13,
        "detour_m": 6,
        "status": Walk.Status.PLANNED,
        "rating": None,
        "stops": [
            {"order": 1, "name": "", "category": Stop.Category.PLAYGROUND, "planned_minutes": 20},
            {"order": 2, "name": "", "category": Stop.Category.CAFE, "planned_minutes": 30},
        ],
    },
]


def _recorded_route(pair_number, profile):
    """Geometry and numbers from the recorded fixture, or None if it is not recorded yet."""
    pair = next(p for p in fixtures.DEMO_PAIRS if p.number == pair_number)
    fixture = fixtures.load_fixture(pair)
    if fixture is None:
        return None
    comparison = routing.compare_routes(services.fixture_fetch(fixture), avoid_stairs=True)
    speed = services.speed_m_per_min(profile)
    route, baseline = comparison.route, comparison.baseline
    return {
        "geometry": [[round(lat, 6), round(lng, 6)] for lat, lng in route.geometry],
        "distance_m": round(route.distance_m),
        "duration_min": max(1, round(route.distance_m / speed)),
        "stairs_m": route.stairs_m or 0,
        "stairs_avoided_m": round(max((baseline.stairs_m or 0) - (route.stairs_m or 0), 0)),
        "detour_m": round(comparison.detour_m or 0),
    }


def _stop_position(geometry, stop_order, stops_total):
    """Put stops along the geometry, evenly between start and end."""
    share = stop_order / (stops_total + 1)
    lat, lng = geometry[round(share * (len(geometry) - 1))]
    return round(lat, 6), round(lng, 6)


@transaction.atomic
def create_demo_data(client_id):
    """Create the demo profile and walks for this client. Return True if anything was created.

    Idempotent: items are matched by their fixed names, so a second run creates nothing.
    """
    created_any = False
    profile, created = FamilyProfile.objects.get_or_create(
        client_id=client_id,
        name=DEMO_PROFILE_NAME,
        defaults={"children_ages": [2, 5], "wheels": "stroller", "pace": "relaxed"},
    )
    created_any |= created

    for data in DEMO_WALKS:
        if Walk.objects.filter(client_id=client_id, name=data["name"]).exists():
            continue
        walk_fields = {key: value for key, value in data.items() if key not in ("stops", "pair")}
        start = (data["start_lat"], data["start_lng"])
        end = (data["end_lat"], data["end_lng"])
        walk_fields["geometry"] = geo.straight_line(start, end)
        walk_fields |= _recorded_route(data["pair"], profile) or {}
        walk = Walk.objects.create(client_id=client_id, profile=profile, **walk_fields)
        for stop in data["stops"]:
            lat, lng = _stop_position(walk.geometry, stop["order"], len(data["stops"]))
            Stop.objects.create(walk=walk, lat=lat, lng=lng, source=Stop.Source.RULES, **stop)
        created_any = True

    return created_any

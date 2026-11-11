"""Sample data for one client: 1 profile and 2 walks in Gdansk with stops.

The numbers come from demo pairs 1 and 3 in docs/DECISIONS.md (real ORS answers).
The geometry is a straight line for now; stage 3 replaces it with recorded routes.
"""

from django.db import transaction

from walks.models import FamilyProfile, Stop, Walk

DEMO_PROFILE_NAME = "Weekend with a stroller"

DEMO_WALKS = [
    {
        # Pair 1: big detour. Shortest route 132.4 m with 16 m of stairs; step-free 420.1 m, 302 s.
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


def _straight_line(start_lat, start_lng, end_lat, end_lng, points=5):
    """A placeholder geometry: evenly spaced [lat, lng] points from start to end."""
    return [
        [
            round(start_lat + (end_lat - start_lat) * i / (points - 1), 6),
            round(start_lng + (end_lng - start_lng) * i / (points - 1), 6),
        ]
        for i in range(points)
    ]


def _stop_position(walk_data, stop_order, stops_total):
    """Put stops along the straight line, between start and end."""
    share = stop_order / (stops_total + 1)
    lat = walk_data["start_lat"] + (walk_data["end_lat"] - walk_data["start_lat"]) * share
    lng = walk_data["start_lng"] + (walk_data["end_lng"] - walk_data["start_lng"]) * share
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
        walk_fields = {key: value for key, value in data.items() if key != "stops"}
        walk = Walk.objects.create(
            client_id=client_id,
            profile=profile,
            geometry=_straight_line(
                data["start_lat"], data["start_lng"], data["end_lat"], data["end_lng"]
            ),
            **walk_fields,
        )
        for stop in data["stops"]:
            lat, lng = _stop_position(data, stop["order"], len(data["stops"]))
            Stop.objects.create(walk=walk, lat=lat, lng=lng, source=Stop.Source.RULES, **stop)
        created_any = True

    return created_any

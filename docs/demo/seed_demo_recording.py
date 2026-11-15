"""Sample data for the README demo GIFs. Run from backend/:

    python manage.py shell -c "exec(open('../docs/demo/seed_demo_recording.py').read())"

It touches only one fake client id (RECORDING_CLIENT_ID, also set in the .web.js scripts),
so your own walks and profiles stay as they are. Running it again gives the same data.
All places are public places from the OpenStreetMap export; no personal data.
"""

from django.db import transaction

from walks.demo_data import _recorded_route, _stop_position
from walks.models import FamilyProfile, Stop, Walk

RECORDING_CLIENT_ID = "00000000-0000-4000-8000-000000000001"

PROFILES = [
    {"name": "Weekend with a stroller", "children_ages": [1, 4], "pace_kmh": 3.5},
    {"name": "Slow walk with Grandma", "children_ages": [2], "pace_kmh": 3.0},
]

# (pair, profile index, walk fields, stops as (name, category, minutes, lat, lng))
WALKS = [
    (
        3,
        0,
        {
            "name": "Oliwa: playground and coffee",
            "start_label": "Gdansk Oliwa SKM",
            "end_label": "Pacholek viewpoint",
            "status": Walk.Status.DONE,
            "rating": 5,
            "notes": "Flat paths all the way. Good for a nap in the stroller.",
        },
        [
            ("Gym&Fun", Stop.Category.PLAYGROUND, 25, 54.4114628, 18.5670147),
            ("Bistro Peron 1", Stop.Category.CAFE, 30, 54.410005, 18.5716763),
        ],
    ),
    (
        1,
        1,
        {
            "name": "Kartuska: around the stairs",
            "start_label": "Kartuska street",
            "end_label": "Kartuska, upper street",
            "status": Walk.Status.PLANNED,
            "rating": None,
        },
        [("", Stop.Category.BENCH, 5, None, None)],
    ),
    (
        2,
        0,
        {
            "name": "Hevelianum hill (has stairs)",
            "start_label": "Old Town side",
            "end_label": "Hevelianum",
            "status": Walk.Status.PLANNED,
            "rating": None,
            "notes": "No stair-free way up. Better with a baby carrier.",
        },
        [],
    ),
]


@transaction.atomic
def seed():
    FamilyProfile.objects.filter(client_id=RECORDING_CLIENT_ID).delete()
    Walk.objects.filter(client_id=RECORDING_CLIENT_ID).delete()
    profiles = [
        FamilyProfile.objects.create(client_id=RECORDING_CLIENT_ID, wheels="stroller", **data)
        for data in PROFILES
    ]
    for pair, profile_index, fields, stops in WALKS:
        profile = profiles[profile_index]
        route = _recorded_route(pair, profile)
        if route is None:
            raise SystemExit(f"Fixture for demo pair {pair} is missing.")
        geometry = route["geometry"]
        start, end = geometry[0], geometry[-1]
        walk = Walk.objects.create(
            client_id=RECORDING_CLIENT_ID,
            profile=profile,
            start_lat=start[0],
            start_lng=start[1],
            end_lat=end[0],
            end_lng=end[1],
            **route,
            **fields,
        )
        for order, (name, category, minutes, lat, lng) in enumerate(stops, start=1):
            if lat is None:
                lat, lng = _stop_position(geometry, order, len(stops))
            Stop.objects.create(
                walk=walk,
                order=order,
                name=name,
                category=category,
                planned_minutes=minutes,
                lat=lat,
                lng=lng,
                source=Stop.Source.USER,
            )
    print(f"Recording data ready: {len(profiles)} profiles, {len(WALKS)} walks.")


seed()

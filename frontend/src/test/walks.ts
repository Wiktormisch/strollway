import type { FamilyProfile, Stop, WalkDetail, WalkListItem } from '@/api/types'

// Fake data only. Override what a test needs.

export function makeWalkItem(overrides: Partial<WalkListItem> = {}): WalkListItem {
  return {
    id: 1,
    profile: null,
    name: 'Fake park loop',
    start_label: '',
    end_label: '',
    avoid_stairs: true,
    distance_m: 1250,
    duration_min: 25,
    kcal: 90,
    stairs_m: 0,
    stairs_avoided_m: 16,
    detour_m: 288,
    status: 'planned',
    rating: null,
    stops_count: 2,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

export function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: 11,
    walk: 1,
    order: 1,
    name: 'Fake Playground',
    category: 'playground',
    lat: 54.348,
    lng: 18.618,
    osm_id: 'node/1',
    planned_minutes: 15,
    reason: '',
    source: 'user',
    ...overrides,
  }
}

export function makeWalkDetail(overrides: Partial<WalkDetail> = {}): WalkDetail {
  // The detail has the stops themselves instead of their count.
  const { stops_count, ...base } = makeWalkItem()
  void stops_count
  return {
    ...base,
    start_lat: 54.3478,
    start_lng: 18.6181,
    end_lat: 54.3487,
    end_lng: 18.6185,
    geometry: [
      [54.3478, 18.6181],
      [54.3487, 18.6185],
    ],
    notes: '',
    ai_summary: '',
    stops: [makeStop()],
    ...overrides,
  }
}

export function makeProfile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    id: 3,
    name: 'Fake weekend',
    children_ages: [2, 5],
    wheels: 'stroller',
    pace_kmh: 3.5,
    trip_minutes: 60,
    round_trip: true,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

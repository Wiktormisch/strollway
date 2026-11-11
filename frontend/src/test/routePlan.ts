import type { Poi, RoutePlan } from '@/api/types'

/** Demo pair 1 (big detour) from D.4, with fake places. Override what a test needs. */
export function makePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    source: 'ors',
    step_free_available: true,
    route: {
      geometry: [
        [54.3478, 18.6181],
        [54.3487, 18.6185],
      ],
      distance_m: 420,
      duration_min: 6,
      stairs_m: 0,
      stairs_segments: [],
    },
    baseline: {
      geometry: [
        [54.3478, 18.6181],
        [54.3487, 18.6184],
      ],
      distance_m: 132,
      duration_min: 2,
      stairs_m: 16,
      stairs_segments: [
        [
          [54.348, 18.6182],
          [54.3481, 18.6183],
        ],
      ],
    },
    detour_m: 288,
    extra_min: 4,
    pois_status: 'ok',
    pois: [
      makePoi({ poi_id: 'node/1', name: 'Fake Cafe', category: 'cafe', at_min: 3 }),
      makePoi({ poi_id: 'node/2', name: null, category: 'bench', at_min: 1 }),
    ],
    transit_stops: [{ name: 'Fake Stop', kind: 'tram', near: 'start', distance_m: 180 }],
    ...overrides,
  }
}

export function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    poi_id: 'node/99',
    name: 'Fake Place',
    category: 'playground',
    lat: 54.348,
    lng: 18.618,
    at_min: 2,
    off_route_m: 20,
    opening_hours: null,
    open_now: null,
    ...overrides,
  }
}

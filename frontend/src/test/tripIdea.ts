import type { TripIdea, TripStop } from '@/api/types'

export function makeTripStop(overrides: Partial<TripStop> = {}): TripStop {
  return {
    poi_id: 'node/1',
    name: 'Fake Playground',
    category: 'playground',
    lat: 54.339,
    lng: 18.621,
    distance_m: 150,
    opening_hours: null,
    open_now: null,
    arrive_min: 4,
    planned_minutes: 20,
    reason: 'Close to the start, good for a 4-year-old.',
    ...overrides,
  }
}

/** A fake trip with three stops: playground -> cafe -> pizza. */
export function makeTrip(overrides: Partial<TripIdea> = {}): TripIdea {
  const route = {
    geometry: [
      [54.3385, 18.62],
      [54.339, 18.621],
      [54.3385, 18.62],
    ] as [number, number][],
    distance_m: 1200,
    duration_min: 21,
    kcal: 77,
    stairs_m: 0,
    stairs_segments: [],
  }
  return {
    engine: 'rules',
    source: 'fixture',
    step_free_available: true,
    route,
    baseline: { ...route, distance_m: 1100, stairs_m: 8 },
    detour_m: 100,
    extra_min: 2,
    summary: 'A short loop: playground, coffee and pizza.',
    tips: ['Take a rain cover.'],
    unmet_wishes: ['ice cream'],
    stops: [
      makeTripStop(),
      makeTripStop({
        poi_id: 'node/2',
        name: 'Fake Cafe',
        category: 'cafe',
        arrive_min: 30,
        planned_minutes: 15,
        reason: 'Coffee for the parents.',
      }),
      makeTripStop({
        poi_id: 'node/3',
        name: null,
        category: 'restaurant',
        arrive_min: 50,
        planned_minutes: 20,
        reason: 'Pizza at the end.',
      }),
    ],
    dropped_stops: [],
    walking_min: 21,
    stops_min: 55,
    total_min: 76,
    max_minutes: 90,
    over_limit: false,
    weather: { temp_c: 8.4, precip_probability: 60, wind_kmh: 20 },
    transit_stops: [],
    ...overrides,
  }
}

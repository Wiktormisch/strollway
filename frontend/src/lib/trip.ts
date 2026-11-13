// Plain trip-idea logic, kept out of components so it can be tested on its own.
import type { Language, LatLng, TripEngine, TripIdea, TripStop } from '@/api/types'

/** The time limits offered in the form (the API accepts 15-180). */
export const TRIP_MINUTES = [30, 45, 60, 90, 120] as const
export const DEFAULT_TRIP_MINUTES = 60
export const MAX_WISHES_LENGTH = 200

/** The backend counts a plan as over the limit above +10% (D.6, step 6). */
const OVER_LIMIT_RATIO = 1.1

/** Matches DEMO_TRIP_START in backend/planning/fixtures.py, so mock mode has recorded data. */
export const DEMO_TRIP_START: LatLng = { lat: 54.3385, lng: 18.62 }

/** i18next may report "en-GB" or "pl-PL"; the API takes only "pl" or "en". */
export function apiLanguage(language: string | undefined): Language {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'pl'
}

export function isLlmEngine(engine: TripEngine): boolean {
  return engine !== 'rules'
}

export function remainingStops(trip: TripIdea, removed: ReadonlySet<string>): TripStop[] {
  return trip.stops.filter((stop) => !removed.has(stop.poi_id))
}

export interface TripTotals {
  walkingMin: number
  stopsMin: number
  totalMin: number
  maxMinutes: number
  overLimit: boolean
  /** true when the user removed a stop: the walking time is still the old route's. */
  edited: boolean
}

/**
 * Totals after the user removed stops. The time at the stops is exact; the walking time
 * cannot be recalculated in the browser (it needs a new route), so it stays as planned.
 */
export function tripTotals(trip: TripIdea, stops: TripStop[]): TripTotals {
  const edited = stops.length !== trip.stops.length
  if (!edited) {
    return {
      walkingMin: trip.walking_min,
      stopsMin: trip.stops_min,
      totalMin: trip.total_min,
      maxMinutes: trip.max_minutes,
      overLimit: trip.over_limit,
      edited,
    }
  }
  const stopsMin = stops.reduce((sum, stop) => sum + stop.planned_minutes, 0)
  const totalMin = trip.walking_min + stopsMin
  return {
    walkingMin: trip.walking_min,
    stopsMin,
    totalMin,
    maxMinutes: trip.max_minutes,
    overLimit: totalMin > trip.max_minutes * OVER_LIMIT_RATIO,
    edited,
  }
}

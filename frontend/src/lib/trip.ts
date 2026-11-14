// Plain trip-idea logic, kept out of components so it can be tested on its own.
import type { Language, LatLng, TripEngine, TripIdea, TripStop } from '@/api/types'

/** The time limit range in the form; the API accepts the same 15-180 (audit idea 11). */
export const MIN_TRIP_MINUTES = 15
export const MAX_TRIP_MINUTES = 180
export const TRIP_MINUTES_STEP = 5
export const DEFAULT_TRIP_MINUTES = 60

/** Turns the typed limit into a whole number inside the API range; no number gives the default. */
export function clampTripMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TRIP_MINUTES
  return Math.min(MAX_TRIP_MINUTES, Math.max(MIN_TRIP_MINUTES, Math.round(value)))
}
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

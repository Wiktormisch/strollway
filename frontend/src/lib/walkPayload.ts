import type { LatLng, NestedStopInput, Poi, RoutePlan, StopCategory, WalkCreate } from '@/api/types'

const STOP_CATEGORIES: readonly StopCategory[] = [
  'playground',
  'toilets',
  'cafe',
  'restaurant',
  'bench',
  'water',
  'park',
  'zoo',
  'museum',
  'beach',
  'shop',
  'other',
]

export const DEFAULT_STOP_MINUTES = 10
const MAX_OSM_ID_LENGTH = 40

/** A POI category the Stop model does not know becomes "other" (else the backend says 400). */
export function toStopCategory(category: string): StopCategory {
  return (STOP_CATEGORIES as readonly string[]).includes(category)
    ? (category as StopCategory)
    : 'other'
}

export function poiToStop(poi: Poi, order: number): NestedStopInput {
  return {
    order,
    name: poi.name ?? '',
    category: toStopCategory(poi.category),
    lat: poi.lat,
    lng: poi.lng,
    osm_id: poi.poi_id.slice(0, MAX_OSM_ID_LENGTH),
    planned_minutes: DEFAULT_STOP_MINUTES,
    reason: '',
    source: 'user',
  }
}

interface WalkPayloadInput {
  plan: RoutePlan
  start: LatLng
  end: LatLng
  avoidStairs: boolean
  name: string
  profileId: number | null
  /** Chosen places; saved in the order they appear on the route. */
  pois: Poi[]
}

/**
 * Builds the POST /api/walks/ body from a computed plan.
 * The plan uses null for "unknown", but the saved walk has whole numbers only,
 * so unknown stairs and a missing detour are saved as 0.
 */
export function buildWalkPayload(input: WalkPayloadInput): WalkCreate {
  const { plan } = input
  const routeStairs = plan.route.stairs_m ?? 0
  const baselineStairs = plan.baseline.stairs_m ?? 0
  const pois = [...input.pois].sort((a, b) => a.at_min - b.at_min)
  return {
    profile: input.profileId,
    name: input.name.trim(),
    start_lat: input.start.lat,
    start_lng: input.start.lng,
    end_lat: input.end.lat,
    end_lng: input.end.lng,
    start_label: '',
    end_label: '',
    avoid_stairs: input.avoidStairs,
    distance_m: Math.round(plan.route.distance_m),
    duration_min: Math.round(plan.route.duration_min),
    stairs_m: Math.round(routeStairs),
    stairs_avoided_m: Math.max(0, Math.round(baselineStairs - routeStairs)),
    detour_m: Math.round(plan.detour_m ?? 0),
    geometry: plan.route.geometry,
    stops: pois.map((poi, index) => poiToStop(poi, index + 1)),
  }
}

/** The next free order number for a stop added at the end. */
export function nextStopOrder(stops: { order: number }[]): number {
  return stops.reduce((max, stop) => Math.max(max, stop.order), 0) + 1
}

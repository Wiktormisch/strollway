// Plain planner logic, kept out of components so it can be tested without Leaflet.
import { ApiError } from '@/api/client'
import type {
  LatLng,
  LatLngTuple,
  Poi,
  RouteComparison,
  RoutePlanErrorCode,
  TripIdeaErrorCode,
} from '@/api/types'
import { DEMO_ROUTES, type DemoRoute } from '@/constants/demoRoutes'
import { categoryOrder } from '@/constants/poiCategories'

/**
 * A detour this small counts as "almost free". D.4 gives no number; demo pair 3 is +6 m (<1%).
 * Recorded in docs/DECISIONS.md.
 */
export const TINY_DETOUR_MAX_M = 25
export const TINY_DETOUR_MAX_RATIO = 0.03

export type DetourCase =
  | 'bigDetour' // a stair-free route exists and costs real extra distance
  | 'tinyDetour' // a stair-free route exists and costs almost nothing
  | 'noStepFree' // ORS found no stair-free route
  | 'noStairs' // the shortest route has no stairs anyway
  | 'notSearched' // the user switched "avoid stairs" off
  | 'checkFailed' // we asked for a stair-free route, but that request failed
  | 'unknownStairs' // a straight mock line: stairs are unknown

export function detourCase(plan: RouteComparison, avoidStairs: boolean): DetourCase {
  const stairs = plan.baseline.stairs_m
  if (stairs === null) return 'unknownStairs'
  if (stairs === 0) return 'noStairs'
  if (plan.step_free_available === false) return 'noStepFree'
  if (plan.step_free_available === null) return avoidStairs ? 'checkFailed' : 'notSearched'
  const detour = plan.detour_m ?? 0
  const ratio = plan.baseline.distance_m > 0 ? detour / plan.baseline.distance_m : 0
  return detour <= TINY_DETOUR_MAX_M || ratio <= TINY_DETOUR_MAX_RATIO ? 'tinyDetour' : 'bigDetour'
}

export interface PlannerPoints {
  start: LatLng | null
  end: LatLng | null
}

/** The first click sets the start, the second the end, a third click starts over. */
export function nextPoints({ start, end }: PlannerPoints, click: LatLng): PlannerPoints {
  if (!start) return { start: click, end }
  if (!end) return { start, end: click }
  return { start: click, end: null }
}

export function visiblePois(pois: Poi[], hidden: ReadonlySet<string>): Poi[] {
  return pois.filter((poi) => !hidden.has(poi.category))
}

export interface CategoryCount {
  category: string
  count: number
}

export function countCategories(pois: Poi[]): CategoryCount[] {
  const counts = new Map<string, number>()
  for (const poi of pois) counts.set(poi.category, (counts.get(poi.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category))
}

export type PlanErrorKey =
  | 'noRoute'
  | 'noRoutablePoint'
  | 'noPlacesNearby'
  | 'placesUnavailable'
  | 'invalid'
  | 'tooManyRequests'
  | 'network'
  | 'unknown'

const ERROR_CODE_KEYS: Record<RoutePlanErrorCode | TripIdeaErrorCode, PlanErrorKey> = {
  no_route: 'noRoute',
  no_routable_point: 'noRoutablePoint',
  no_places_nearby: 'noPlacesNearby',
  places_unavailable: 'placesUnavailable',
}

/** Maps a failed route-plans or trip-ideas request to an i18n key under `planner.errors`. */
export function planErrorKey(error: unknown): PlanErrorKey {
  if (!(error instanceof ApiError)) return 'unknown'
  if (error.status === 0) return 'network'
  if (error.status === 429) return 'tooManyRequests'
  if (error.status === 400) return 'invalid'
  if (error.status === 422) {
    const code = (error.body as { code?: string } | null)?.code
    if (code && code in ERROR_CODE_KEYS)
      return ERROR_CODE_KEYS[code as keyof typeof ERROR_CODE_KEYS]
  }
  return 'unknown'
}

/** All points of both routes, to fit the map view around them. */
export function planBounds(plan: RouteComparison): LatLngTuple[] {
  return [...plan.route.geometry, ...plan.baseline.geometry]
}

/**
 * The demo route a point comes from, or null. Derived from the point itself, so a map click
 * or "Change" removes the demo name with no extra state.
 */
export function demoRouteOf(point: LatLng | null, which: 'start' | 'end'): DemoRoute['id'] | null {
  if (!point) return null
  const match = DEMO_ROUTES.find(
    (route) => route[which].lat === point.lat && route[which].lng === point.lng,
  )
  return match?.id ?? null
}

/** The gap in px between the fitted points and the visible edge of the map. */
export const MAP_FIT_GAP = 40

/**
 * Leaflet padding for fitBounds. On phones the bottom sheet covers the lower part of the map,
 * so its height is added at the bottom: the route then fits in the part above the sheet.
 */
export function fitPadding(bottomInset: number): {
  paddingTopLeft: [number, number]
  paddingBottomRight: [number, number]
} {
  return {
    paddingTopLeft: [MAP_FIT_GAP, MAP_FIT_GAP],
    paddingBottomRight: [MAP_FIT_GAP, MAP_FIT_GAP + Math.max(0, bottomInset)],
  }
}

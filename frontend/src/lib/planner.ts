// Plain planner logic, kept out of components so it can be tested without Leaflet.
import { ApiError } from '@/api/client'
import type { LatLng, LatLngTuple, Poi, RoutePlan, RoutePlanErrorCode } from '@/api/types'
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

export function detourCase(plan: RoutePlan, avoidStairs: boolean): DetourCase {
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
  'noRoute' | 'noRoutablePoint' | 'invalid' | 'tooManyRequests' | 'network' | 'unknown'

/** Maps a failed request to an i18n key under `planner.errors`. */
export function planErrorKey(error: unknown): PlanErrorKey {
  if (!(error instanceof ApiError)) return 'unknown'
  if (error.status === 0) return 'network'
  if (error.status === 429) return 'tooManyRequests'
  if (error.status === 400) return 'invalid'
  if (error.status === 422) {
    const code = (error.body as { code?: RoutePlanErrorCode } | null)?.code
    if (code === 'no_route') return 'noRoute'
    if (code === 'no_routable_point') return 'noRoutablePoint'
  }
  return 'unknown'
}

/** All points of both routes, to fit the map view around them. */
export function planBounds(plan: RoutePlan): LatLngTuple[] {
  return [...plan.route.geometry, ...plan.baseline.geometry]
}

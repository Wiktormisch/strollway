// Hand-written types that match the backend (backend/planning/serializers.py).
// Coordinates in the API are always [lat, lng].

export type LatLngTuple = [number, number]

export interface LatLng {
  lat: number
  lng: number
}

export interface RoutePlanRequest {
  start: LatLng
  end: LatLng
  avoid_stairs: boolean
  profile_id?: number | null
}

export interface RouteGeometry {
  geometry: LatLngTuple[]
  distance_m: number
  /** At the family pace, computed by the backend. */
  duration_min: number
  /** null = unknown (a straight mock line). */
  stairs_m: number | null
  /** Line parts with stairs, drawn in red. */
  stairs_segments: LatLngTuple[][]
}

export type RouteSource = 'ors' | 'fixture' | 'mock'

export interface Poi {
  poi_id: string
  /** null for places without a name in OSM (benches, many playgrounds). */
  name: string | null
  category: string
  lat: number
  lng: number
  at_min: number
  off_route_m: number
  opening_hours: string | null
  open_now: boolean | null
  /**
   * Not sent by the backend yet. The UI shows it only when present,
   * so a later backend change needs no frontend change.
   */
  accessibility?: string[]
}

export interface TransitStop {
  name: string | null
  kind: 'bus' | 'tram'
  near: 'start' | 'end'
  distance_m: number
}

export interface RoutePlan {
  source: RouteSource
  /** false = no step-free route; null = not searched or the check failed. */
  step_free_available: boolean | null
  route: RouteGeometry
  baseline: RouteGeometry
  detour_m: number | null
  extra_min: number | null
  pois_status: 'ok' | 'unavailable'
  pois: Poi[]
  transit_stops: TransitStop[]
}

export type RoutePlanErrorCode = 'no_route' | 'no_routable_point'

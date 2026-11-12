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

// ----- Saved data (backend/walks/serializers.py) -----

export type Wheels = 'none' | 'stroller' | 'kid_bike'
export type Pace = 'relaxed' | 'normal'

export interface FamilyProfile {
  id: number
  name: string
  /** Whole numbers 0-17, 1-6 items. No names on purpose. */
  children_ages: number[]
  wheels: Wheels
  pace: Pace
  created_at: string
  updated_at: string
}

export type ProfileInput = Pick<FamilyProfile, 'name' | 'children_ages' | 'wheels' | 'pace'>

export type WalkStatus = 'planned' | 'done'

export type StopCategory =
  | 'playground'
  | 'toilets'
  | 'cafe'
  | 'restaurant'
  | 'bench'
  | 'water'
  | 'park'
  | 'zoo'
  | 'museum'
  | 'beach'
  | 'shop'
  | 'other'

export interface Stop {
  id: number
  walk?: number
  order: number
  /** Empty for places without a name in OSM. */
  name: string
  category: StopCategory
  lat: number
  lng: number
  osm_id: string
  /** 1-120. */
  planned_minutes: number
  /** A short note (max 200 characters). */
  reason: string
  source: 'ai' | 'rules' | 'user'
}

/** A stop sent inside a new walk. */
export type NestedStopInput = Omit<Stop, 'id' | 'walk'>

/** A stop added to an existing walk through /api/stops/. */
export type StopCreate = NestedStopInput & { walk: number }

export type StopUpdate = Partial<Pick<Stop, 'planned_minutes' | 'reason' | 'order'>>

interface WalkCommon {
  id: number
  profile: number | null
  name: string
  start_label: string
  end_label: string
  avoid_stairs: boolean
  distance_m: number
  duration_min: number
  stairs_m: number
  stairs_avoided_m: number
  detour_m: number
  status: WalkStatus
  /** 1-5, only when done. */
  rating: number | null
  created_at: string
  updated_at: string
}

export interface WalkListItem extends WalkCommon {
  stops_count: number
}

export interface WalkDetail extends WalkCommon {
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  geometry: LatLngTuple[]
  notes: string
  ai_summary: string
  stops: Stop[]
}

export type WalkCreate = Omit<
  WalkDetail,
  'id' | 'status' | 'rating' | 'notes' | 'ai_summary' | 'stops' | 'created_at' | 'updated_at'
> & { stops: NestedStopInput[] }

export type WalkUpdate = Partial<Pick<WalkDetail, 'name' | 'notes' | 'status' | 'rating'>>

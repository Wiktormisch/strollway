// API types, built from the types generated from the backend OpenAPI schema
// (`schema.d.ts`, made by `npm run gen:api` from `backend/openapi.yml`; never edit it by hand).
// This file only gives short names and fixes three things the schema cannot say:
// - Points are [lat, lng] pairs. OpenAPI has no tuples, so the schema says number[][].
// - Response fields with a model default are optional in the schema, but a ModelSerializer
//   always sends every field, so saved data uses Required<...>.
// - Poi.accessibility is frontend-only for now (see below).
// Coordinates in the API are always [lat, lng].

import type { components } from './schema'

type Schemas = components['schemas']

export type LatLngTuple = [number, number]

export type LatLng = Schemas['PointRequest']

export type PlaceSearchResult = Schemas['PlaceSearchResult']

export type BestTime = Schemas['BestTimeResponse']

export type BestTimeWindow = Schemas['BestTimeWindow']

export type RoutePlanRequest = Schemas['RoutePlanRequestRequest']

export type RouteGeometry = Omit<Schemas['Route'], 'geometry' | 'stairs_segments'> & {
  geometry: LatLngTuple[]
  /** Line parts with stairs, drawn in red. */
  stairs_segments: LatLngTuple[][]
}

/** Replaces the generated route fields with the [lat, lng] version. */
type WithRoutes<T> = Omit<T, 'route' | 'baseline'> & {
  route: RouteGeometry
  baseline: RouteGeometry
}

export type RouteSource = Schemas['RoutePlanSourceEnum']

export type Poi = Schemas['Poi'] & {
  /**
   * Not sent by the backend yet. The UI shows it only when present,
   * so a later backend change needs no frontend change.
   */
  accessibility?: string[]
}

export type TransitStop = Schemas['TransitStop']

/** The part shared by route-plans and trip-ideas: two routes and the stairs comparison. */
export type RouteComparison = WithRoutes<
  Pick<
    Schemas['RoutePlanResponse'],
    'source' | 'step_free_available' | 'route' | 'baseline' | 'detour_m' | 'extra_min'
  >
>

export type RoutePlan = WithRoutes<Omit<Schemas['RoutePlanResponse'], 'pois'>> & { pois: Poi[] }

export type RoutePlanErrorCode = Schemas['RoutePlanErrorCodeEnum']

// ----- Trip ideas -----

export type Language = Schemas['LanguageEnum']

export type TripIdeaRequest = Schemas['TripIdeaRequestRequest']

/** Who built the plan. Only "rules" is not an LLM. */
export type TripEngine = Schemas['EngineEnum']

export type TripStop = Schemas['TripStop']

export type Weather = Schemas['Weather']

export type TripIdea = WithRoutes<Schemas['TripIdeaResponse']>

export type TripIdeaErrorCode = Schemas['TripIdeaErrorCodeEnum']

// ----- Saved data -----

export type Wheels = Schemas['WheelsEnum']

export type FamilyProfile = Required<Schemas['FamilyProfile']>

export type ProfileInput = Pick<
  FamilyProfile,
  'name' | 'children_ages' | 'wheels' | 'pace_kmh' | 'trip_minutes' | 'round_trip'
>

export type WalkStatus = Schemas['StatusEnum']

export type StopCategory = Schemas['CategoryEnum']

/** A stop as the API sends it. `walk` is present only from /api/stops/, not inside a walk. */
export type Stop = Required<Schemas['NestedStop']> & { walk?: number }

/** A stop sent inside a new walk. */
export type NestedStopInput = Required<Schemas['NestedStopRequest']>

/** A stop added to an existing walk through /api/stops/. */
export type StopCreate = NestedStopInput & { walk: number }

export type StopUpdate = Partial<Pick<Stop, 'planned_minutes' | 'reason' | 'order'>>

export type WalkListItem = Schemas['WalkList']

export type WalkDetail = Required<Omit<Schemas['Walk'], 'geometry' | 'stops'>> & {
  geometry: LatLngTuple[]
  stops: Stop[]
}

export type WalkCreate = Omit<
  WalkDetail,
  // kcal is computed by the server when it reads a walk, so a new walk never sends it.
  | 'id'
  | 'kcal'
  | 'status'
  | 'rating'
  | 'notes'
  | 'ai_summary'
  | 'stops'
  | 'created_at'
  | 'updated_at'
> & { stops: NestedStopInput[]; ai_summary?: string }

export type WalkUpdate = Partial<Pick<WalkDetail, 'name' | 'notes' | 'status' | 'rating'>>

import type { FamilyProfile, Wheels } from '@/api/types'

// Same limits as backend/walks/models.py (audit idea 3).
export const PACE_MIN_KMH = 2.5
export const PACE_MAX_KMH = 5.5
export const PACE_STEP_KMH = 0.5
export const PACE_DEFAULT_KMH = 3.5
/** A stroller is not pushed faster than this. The backend uses the same limit. */
export const STROLLER_MAX_KMH = 4

/** The top of the pace slider for this way of moving. */
export function paceMax(wheels: Wheels | null | undefined): number {
  return wheels === 'stroller' ? STROLLER_MAX_KMH : PACE_MAX_KMH
}

/** Keeps the pace inside the slider range for this way of moving. */
export function clampPace(kmh: number, wheels: Wheels | null | undefined): number {
  return Math.min(Math.max(kmh, PACE_MIN_KMH), paceMax(wheels))
}

/** The planner pace for a profile. No profile: the stroller pace, like the backend. */
export function profilePace(profile: FamilyProfile | undefined): number {
  return profile ? clampPace(profile.pace_kmh, profile.wheels) : STROLLER_MAX_KMH
}

// Form limits and checks, copied from backend/walks/serializers.py.
// The backend still validates everything; these only give a faster, clearer message.

export const MAX_CHILDREN = 6
export const MAX_CHILD_AGE = 17
export const MIN_STOP_MINUTES = 1
export const MAX_STOP_MINUTES = 120
export const MAX_STOPS = 20

/** Fields each form shows; backend errors for other fields go to a toast. */
export const PROFILE_FIELDS = ['name', 'children_ages', 'wheels', 'pace_kmh'] as const
export const WALK_FORM_FIELDS = ['name', 'profile', 'stops'] as const
export const STOP_FIELDS = ['name', 'category', 'planned_minutes', 'reason', 'lat', 'lng'] as const

const WHOLE_NUMBER = /^\d+$/

/** An error key for a typed child's age, or null when it can be added. */
export function ageError(text: string, count: number): 'tooMany' | 'ageInvalid' | null {
  if (count >= MAX_CHILDREN) return 'tooMany'
  if (!WHOLE_NUMBER.test(text.trim())) return 'ageInvalid'
  return Number(text) <= MAX_CHILD_AGE ? null : 'ageInvalid'
}

/** An error key for planned minutes, or null when they are valid. */
export function minutesError(text: string): 'minutes' | null {
  if (!WHOLE_NUMBER.test(text.trim())) return 'minutes'
  const value = Number(text)
  return value >= MIN_STOP_MINUTES && value <= MAX_STOP_MINUTES ? null : 'minutes'
}

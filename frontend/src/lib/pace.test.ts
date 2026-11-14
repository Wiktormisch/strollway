import type { FamilyProfile } from '@/api/types'
import { clampPace, paceMax, profilePace } from './pace'

function profile(overrides: Partial<FamilyProfile>): FamilyProfile {
  return {
    id: 1,
    name: 'Fake',
    children_ages: [],
    wheels: 'none',
    pace_kmh: 3.5,
    trip_minutes: 60,
    round_trip: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('pace', () => {
  it('caps the slider at 4 km/h only for a stroller', () => {
    expect(paceMax('stroller')).toBe(4)
    expect(paceMax('kid_bike')).toBe(5.5)
    expect(paceMax(undefined)).toBe(5.5)
  })

  it('drops a fast pace to the stroller cap and keeps the minimum', () => {
    expect(clampPace(5, 'stroller')).toBe(4)
    expect(clampPace(5, 'none')).toBe(5)
    expect(clampPace(1, 'none')).toBe(2.5)
  })

  it('takes the planner pace from the profile, or the stroller pace without one', () => {
    expect(profilePace(undefined)).toBe(4)
    expect(profilePace(profile({ pace_kmh: 5 }))).toBe(5)
    expect(profilePace(profile({ wheels: 'stroller', pace_kmh: 4.5 }))).toBe(4)
  })
})

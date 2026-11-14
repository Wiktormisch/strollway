import { ApiError } from '@/api/client'
import { makePlan, makePoi } from '@/test/routePlan'
import { DEMO_ROUTES } from '@/constants/demoRoutes'
import {
  countCategories,
  demoRouteOf,
  detourCase,
  nextPoints,
  planErrorKey,
  visiblePois,
  fitPadding,
} from './planner'

const A = { lat: 54.1, lng: 18.1 }
const B = { lat: 54.2, lng: 18.2 }
const C = { lat: 54.3, lng: 18.3 }

function withBaseline(stairs: number | null, distance = 132) {
  return { ...makePlan().baseline, stairs_m: stairs, distance_m: distance }
}

describe('detourCase', () => {
  it('finds the four cases from D.4', () => {
    expect(detourCase(makePlan(), true)).toBe('bigDetour')
    expect(detourCase(makePlan({ detour_m: 6, baseline: withBaseline(12.6, 827) }), true)).toBe(
      'tinyDetour',
    )
    expect(detourCase(makePlan({ step_free_available: false, detour_m: null }), true)).toBe(
      'noStepFree',
    )
    expect(detourCase(makePlan({ detour_m: 0, baseline: withBaseline(0) }), true)).toBe('noStairs')
  })

  it('uses the tiny threshold: 25 m or 3% of the shortest route', () => {
    expect(detourCase(makePlan({ detour_m: 25, baseline: withBaseline(5, 100) }), true)).toBe(
      'tinyDetour',
    )
    expect(detourCase(makePlan({ detour_m: 26, baseline: withBaseline(5, 100) }), true)).toBe(
      'bigDetour',
    )
    expect(detourCase(makePlan({ detour_m: 60, baseline: withBaseline(5, 2000) }), true)).toBe(
      'tinyDetour',
    )
  })

  it('tells "not searched" from "the check failed" by the request flag', () => {
    const plan = makePlan({ step_free_available: null, detour_m: null })
    expect(detourCase(plan, false)).toBe('notSearched')
    expect(detourCase(plan, true)).toBe('checkFailed')
  })

  it('does not claim "no stairs" when stairs are unknown (mock line)', () => {
    expect(detourCase(makePlan({ baseline: withBaseline(null) }), true)).toBe('unknownStairs')
  })
})

describe('nextPoints', () => {
  it('sets the start, then the end, then starts over', () => {
    const first = nextPoints({ start: null, end: null }, A)
    expect(first).toEqual({ start: A, end: null })
    const second = nextPoints(first, B)
    expect(second).toEqual({ start: A, end: B })
    expect(nextPoints(second, C)).toEqual({ start: C, end: null })
  })

  it('fills a cleared start before anything else', () => {
    expect(nextPoints({ start: null, end: B }, C)).toEqual({ start: C, end: B })
  })
})

describe('places', () => {
  const pois = [
    makePoi({ poi_id: 'a', category: 'bench' }),
    makePoi({ poi_id: 'b', category: 'cafe' }),
    makePoi({ poi_id: 'c', category: 'bench' }),
    makePoi({ poi_id: 'd', category: 'mystery' }),
  ]

  it('hides the chosen categories', () => {
    expect(visiblePois(pois, new Set(['bench'])).map((poi) => poi.poi_id)).toEqual(['b', 'd'])
  })

  it('counts categories in a fixed order, unknown ones last', () => {
    expect(countCategories(pois)).toEqual([
      { category: 'cafe', count: 1 },
      { category: 'bench', count: 2 },
      { category: 'mystery', count: 1 },
    ])
  })
})

describe('planErrorKey', () => {
  it('maps API errors to messages', () => {
    expect(planErrorKey(new ApiError(422, 'x', { code: 'no_route' }))).toBe('noRoute')
    expect(planErrorKey(new ApiError(422, 'x', { code: 'no_routable_point' }))).toBe(
      'noRoutablePoint',
    )
    expect(planErrorKey(new ApiError(400, 'x', { end: ['Too far.'] }))).toBe('invalid')
    expect(planErrorKey(new ApiError(429, 'x'))).toBe('tooManyRequests')
    expect(planErrorKey(new ApiError(0, 'x'))).toBe('network')
    expect(planErrorKey(new ApiError(500, 'x'))).toBe('unknown')
    expect(planErrorKey(new Error('x'))).toBe('unknown')
  })
})

describe('demoRouteOf', () => {
  const demo = DEMO_ROUTES[0]

  it('finds the demo route of a demo point', () => {
    expect(demoRouteOf(demo.start, 'start')).toBe(demo.id)
    expect(demoRouteOf(demo.end, 'end')).toBe(demo.id)
  })

  it('returns null for other points, the wrong side or no point', () => {
    expect(demoRouteOf({ lat: 54.1, lng: 18.1 }, 'start')).toBeNull()
    expect(demoRouteOf(demo.start, 'end')).toBeNull()
    expect(demoRouteOf(null, 'start')).toBeNull()
  })
})

describe('fitPadding', () => {
  it('adds the sheet height to the bottom gap only', () => {
    expect(fitPadding(300)).toEqual({ paddingTopLeft: [40, 40], paddingBottomRight: [40, 340] })
  })

  it('uses the plain gap without a sheet and never a negative inset', () => {
    expect(fitPadding(0).paddingBottomRight).toEqual([40, 40])
    expect(fitPadding(-5).paddingBottomRight).toEqual([40, 40])
  })
})

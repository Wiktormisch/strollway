import { makePlan, makePoi } from '@/test/routePlan'
import { buildWalkPayload, nextStopOrder, toStopCategory } from './walkPayload'

const START = { lat: 54.3478, lng: 18.6181 }
const END = { lat: 54.3487, lng: 18.6185 }

function build(plan = makePlan(), pois = plan.pois) {
  return buildWalkPayload({
    plan,
    start: START,
    end: END,
    avoidStairs: true,
    name: '  Fake walk ',
    profileId: 3,
    pois,
  })
}

describe('buildWalkPayload', () => {
  it('saves the route numbers and the avoided stairs (big detour)', () => {
    const payload = build()
    expect(payload).toMatchObject({
      name: 'Fake walk',
      profile: 3,
      start_lat: 54.3478,
      end_lng: 18.6185,
      distance_m: 420,
      duration_min: 6,
      stairs_m: 0,
      stairs_avoided_m: 16,
      detour_m: 288,
    })
  })

  it('saves 0 for unknown stairs and a missing detour', () => {
    const plan = makePlan({ step_free_available: false, detour_m: null })
    plan.route = { ...plan.baseline }
    expect(build(plan)).toMatchObject({ stairs_m: 16, stairs_avoided_m: 0, detour_m: 0 })

    const mock = makePlan({ source: 'mock', detour_m: null })
    mock.route = { ...mock.route, stairs_m: null }
    mock.baseline = { ...mock.baseline, stairs_m: null }
    expect(build(mock)).toMatchObject({ stairs_m: 0, stairs_avoided_m: 0, detour_m: 0 })
  })

  it('turns places into stops in route order', () => {
    const stops = build().stops
    expect(stops.map((stop) => [stop.order, stop.osm_id])).toEqual([
      [1, 'node/2'],
      [2, 'node/1'],
    ])
    // A bench without a name in OSM is saved with an empty name.
    expect(stops[0]).toMatchObject({ name: '', category: 'bench', source: 'user' })
  })
})

it('maps unknown categories to "other"', () => {
  expect(toStopCategory('cafe')).toBe('cafe')
  expect(toStopCategory('ice_rink')).toBe('other')
  expect(build(makePlan(), [makePoi({ category: 'ice_rink' })]).stops[0].category).toBe('other')
})

it('gives a new stop the next order', () => {
  expect(nextStopOrder([])).toBe(1)
  expect(nextStopOrder([{ order: 1 }, { order: 4 }])).toBe(5)
})

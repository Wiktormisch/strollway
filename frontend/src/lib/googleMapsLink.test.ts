import type { LatLngTuple } from '@/api/types'
import { googleMapsLink, MAX_WAYPOINTS, samplePoints } from './googleMapsLink'

/** A straight line of `n` points, easy to check by index. */
function line(n: number): LatLngTuple[] {
  return Array.from({ length: n }, (_, i): LatLngTuple => [54 + i / 1000, 18 + i / 1000])
}

function params(url: string) {
  return new URL(url).searchParams
}

describe('samplePoints', () => {
  it('spreads points evenly and skips the ends', () => {
    expect(samplePoints(line(9), 3)).toEqual([line(9)[2], line(9)[4], line(9)[6]])
  })

  it('returns no points for a line with no inner points', () => {
    expect(samplePoints(line(2), 3)).toEqual([])
  })

  it('does not repeat points on a short line', () => {
    expect(samplePoints(line(3), 3)).toEqual([line(3)[1]])
  })
})

describe('googleMapsLink', () => {
  it('returns null with no line', () => {
    expect(googleMapsLink([])).toBeNull()
    expect(googleMapsLink(line(1))).toBeNull()
  })

  it('builds a walking link from the ends of the line, with sampled waypoints', () => {
    const link = googleMapsLink(line(9))!
    const query = params(link.url)
    expect(link.url.startsWith('https://www.google.com/maps/dir/?api=1&')).toBe(true)
    expect(query.get('origin')).toBe('54.00000,18.00000')
    expect(query.get('destination')).toBe('54.00800,18.00800')
    expect(query.get('travelmode')).toBe('walking')
    expect(query.get('waypoints')).toBe('54.00200,18.00200|54.00400,18.00400|54.00600,18.00600')
    expect(link.url).toContain('%7C')
    expect(link.stopsCut).toBe(false)
  })

  it('uses only the stops, in order, when there are stops', () => {
    const stops = [
      { lat: 54.5, lng: 18.5 },
      { lat: 54.4, lng: 18.4 },
    ]
    const link = googleMapsLink(line(9), stops)!
    expect(params(link.url).get('waypoints')).toBe('54.50000,18.50000|54.40000,18.40000')
  })

  it('keeps at most MAX_WAYPOINTS stops and reports the cut', () => {
    const stops = Array.from({ length: 5 }, (_, i) => ({ lat: 54 + i, lng: 18 }))
    const link = googleMapsLink(line(9), stops)!
    expect(params(link.url).get('waypoints')!.split('|')).toHaveLength(MAX_WAYPOINTS)
    expect(link.stopsCut).toBe(true)
  })

  it('adds no line points to a trip with every stop removed', () => {
    // Regression: an empty list was treated as a route, and the sampled points passed the
    // removed stops.
    expect(params(googleMapsLink(line(9), [])!.url).has('waypoints')).toBe(false)
  })

  it('leaves out waypoints for a two-point line', () => {
    expect(params(googleMapsLink(line(2))!.url).has('waypoints')).toBe(false)
  })
})

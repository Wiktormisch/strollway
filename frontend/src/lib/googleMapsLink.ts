// Builds a Google Maps directions link for a planned route or trip (audit idea 9, D9).
// No key, no Google API: the browser just opens google.com/maps with our points.
import type { LatLng, LatLngTuple } from '@/api/types'

/**
 * Google allows 9 waypoints, but only 3 when the link opens in a mobile browser
 * (Google Maps URLs docs, checked 2026-11-14). The app is mobile first, so we always use 3.
 */
export const MAX_WAYPOINTS = 3

/** 5 decimal places is about 1 m: precise enough, and keeps the link short. */
function format(point: LatLngTuple): string {
  return `${point[0].toFixed(5)},${point[1].toFixed(5)}`
}

/** `count` points spread evenly along the line, without its two ends. */
export function samplePoints(geometry: LatLngTuple[], count: number): LatLngTuple[] {
  if (count <= 0 || geometry.length < 3) return []
  const last = geometry.length - 1
  const picked: LatLngTuple[] = []
  for (let i = 1; i <= count; i++) {
    const index = Math.round((i * last) / (count + 1))
    // Skip the ends and repeats (a short line has fewer inner points than `count`).
    if (index > 0 && index < last && picked.at(-1) !== geometry[index]) {
      picked.push(geometry[index])
    }
  }
  return picked
}

export interface MapsLink {
  url: string
  /** true when the trip has more stops than fit in the link; the UI says so. */
  stopsCut: boolean
}

/**
 * Origin and destination are the ends of our geometry.
 * - With a stop list (a trip): the stops are the waypoints, in order, at most MAX_WAYPOINTS.
 *   No extra line points: the line may still pass removed stops, and the stops alone
 *   already hold the shape of the trip.
 * - With no stops (a route): points sampled from our stair-free line keep Google close to it.
 * Returns null when there is no line to export.
 */
export function googleMapsLink(geometry: LatLngTuple[], stops?: LatLng[]): MapsLink | null {
  if (geometry.length < 2) return null
  // `stops` undefined = a route. An empty list = a trip with every stop removed: then no line
  // points either, because the line still passes the removed stops.
  const waypoints =
    stops === undefined
      ? samplePoints(geometry, MAX_WAYPOINTS)
      : stops.slice(0, MAX_WAYPOINTS).map((stop): LatLngTuple => [stop.lat, stop.lng])

  const params = new URLSearchParams({
    api: '1',
    origin: format(geometry[0]),
    destination: format(geometry[geometry.length - 1]),
    travelmode: 'walking',
  })
  // URLSearchParams encodes the "|" separator as %7C, which Google expects.
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(format).join('|'))

  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    stopsCut: (stops?.length ?? 0) > MAX_WAYPOINTS,
  }
}

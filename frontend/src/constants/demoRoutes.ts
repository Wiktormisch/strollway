import type { LatLng } from '@/api/types'

// Demo pairs from docs/DECISIONS.md ("Demo pairs"). The doc uses [lon, lat]; here it is lat/lng.
export interface DemoRoute {
  id: 'bigDetour' | 'tinyDetour' | 'noStepFree'
  start: LatLng
  end: LatLng
}

export const DEMO_ROUTES: readonly DemoRoute[] = [
  {
    id: 'bigDetour', // Gdansk, near Kartuska: 132 m with 16 m of stairs -> 420 m without
    start: { lat: 54.347791, lng: 18.618119 },
    end: { lat: 54.34874, lng: 18.618458 },
  },
  {
    id: 'tinyDetour', // Oliwa SKM -> Pacholek: +6 m to avoid 12.6 m of stairs
    start: { lat: 54.4097, lng: 18.5655 },
    end: { lat: 54.4115, lng: 18.5745 },
  },
  {
    id: 'noStepFree', // Gdansk Glowny -> Hevelianum: ORS code 2009
    start: { lat: 54.3561, lng: 18.6437 },
    end: { lat: 54.358, lng: 18.6405 },
  },
]

/** Gdansk, where all demo routes are. */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 54.372, lng: 18.62 }
export const DEFAULT_MAP_ZOOM = 12

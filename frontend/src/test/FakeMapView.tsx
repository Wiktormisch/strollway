import type { ComponentProps } from 'react'
import type { MapView } from '@/components/planner/MapView'

/**
 * Stands in for the Leaflet map in every test (see setup.ts): jsdom cannot draw maps.
 * It shows what the page passes to the map and lets a test "click" the map.
 */
export function FakeMapView(props: ComponentProps<typeof MapView>) {
  return (
    <div data-testid="map">
      <button type="button" onClick={() => props.onMapClick({ lat: 54.35, lng: 18.61 })}>
        fake map click A
      </button>
      <button type="button" onClick={() => props.onMapClick({ lat: 54.351, lng: 18.612 })}>
        fake map click B
      </button>
      <p>map route: {props.plan ? 'drawn' : 'none'}</p>
      <p>map places: {props.pois.length}</p>
    </div>
  )
}

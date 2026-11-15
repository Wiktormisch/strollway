// A thin Leaflet wrapper for a saved walk: the route, A/B and numbered stops in category colours.
// The planner map is built around a RoutePlan, so this one stays separate and simple.
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, LatLngTuple, Stop } from '@/api/types'
import { mapLineStyles } from '@/constants/mapStyles'
import { useMapColors } from '@/lib/cssColors'
import { letterIcon, stopIcon } from '@/lib/mapIcons'
import { FitBounds } from '@/components/map/FitBounds'

const WALK_FIT_PADDING = { padding: [30, 30] as [number, number] }

export interface WalkMapProps {
  geometry: LatLngTuple[]
  start: LatLng
  end: LatLng
  stops: Stop[]
  stopLabel: (stop: Stop) => string
  /** A new stop being placed; shown as "+". */
  draft: LatLng | null
  /** Set only while the user is placing a new stop. */
  onMapClick?: (point: LatLng) => void
}

export function WalkMap(props: WalkMapProps) {
  const { t } = useTranslation()
  const lines = mapLineStyles(useMapColors())
  return (
    <MapContainer
      center={[props.start.lat, props.start.lng]}
      zoom={16}
      className={props.onMapClick ? 'size-full cursor-crosshair' : 'size-full'}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={props.geometry} padding={WALK_FIT_PADDING} />
      {props.onMapClick && <ClickHandler onClick={props.onMapClick} />}
      <Polyline positions={props.geometry} pathOptions={lines.routeGlow} />
      <Polyline positions={props.geometry} pathOptions={lines.routeCasing} />
      <Polyline positions={props.geometry} pathOptions={lines.route} />
      <Marker
        position={[props.start.lat, props.start.lng]}
        icon={letterIcon('A', 'var(--brand)')}
        title={t('planner.form.start')}
        alt={t('planner.form.start')}
      />
      <Marker
        position={[props.end.lat, props.end.lng]}
        icon={letterIcon('B', 'var(--primary)')}
        title={t('planner.form.end')}
        alt={t('planner.form.end')}
      />
      {props.stops.map((stop, index) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={stopIcon(index + 1, stop.category)}
          title={props.stopLabel(stop)}
          alt={props.stopLabel(stop)}
        />
      ))}
      {props.draft && (
        <Marker
          position={[props.draft.lat, props.draft.lng]}
          icon={letterIcon('+', 'var(--sage-500)')}
          title={t('stops.newPoint')}
          alt={t('stops.newPoint')}
        />
      )}
    </MapContainer>
  )
}

function ClickHandler({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({ click: (event) => onClick({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

// A thin Leaflet wrapper: it only draws what it gets and reports clicks.
// All decisions live in lib/planner.ts and PlannerPage, which are tested without Leaflet.
import { useEffect } from 'react'
import { latLngBounds } from 'leaflet'
import {
  AttributionControl,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, LatLngTuple, Poi, RouteComparison } from '@/api/types'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/constants/demoRoutes'
import { mapLineStyles } from '@/constants/mapStyles'
import { useMapColors } from '@/lib/cssColors'
import { finishIcon, letterIcon, poiIcon } from '@/lib/mapIcons'
import { fitPadding, planBounds } from '@/lib/planner'
import { PoiDetails } from './PoiDetails'

interface MapViewProps {
  start: LatLng | null
  /** A round trip: the start is also the finish, so it gets a finish flag. */
  startIsFinish?: boolean
  end: LatLng | null
  plan: RouteComparison | undefined
  pois: Poi[]
  /** Trip stops, drawn as numbered markers in this order. */
  stops?: NumberedStop[]
  poiLabel: (poi: Poi) => string
  pointLabels: { start: string; end: string }
  onMapClick: (point: LatLng) => void
  onCenterChange: (center: LatLng) => void
  /** Px of the map covered by the phone bottom sheet; fitted points stay above it. */
  bottomInset?: number
  /** Points to show at once (a demo click), before any result. `id` changes on every click. */
  focus?: MapFocus | null
}

export interface MapFocus {
  id: number
  points: LatLngTuple[]
}

export interface NumberedStop {
  id: string
  lat: number
  lng: number
  title: string
}

export function MapView(props: MapViewProps) {
  const { plan } = props
  const inset = props.bottomInset ?? 0
  const lines = mapLineStyles(useMapColors())
  return (
    <MapContainer
      center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
      zoom={DEFAULT_MAP_ZOOM}
      className="size-full"
      attributionControl={false}
    >
      {/* Top right: at the bottom, the mobile panel would cover the OSM credit. */}
      <AttributionControl position="topright" prefix={false} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapEvents onClick={props.onMapClick} onCenterChange={props.onCenterChange} />
      {/* Before the plan's FitBounds: when both change at once, the route fit runs last. */}
      {props.focus && (
        <FitBounds
          points={props.focus.points}
          fitKey={`focus-${props.focus.id}`}
          bottomInset={inset}
          maxZoom={16}
        />
      )}
      {plan && (
        <>
          <FitBounds points={planBounds(plan)} bottomInset={inset} />
          <Polyline positions={plan.baseline.geometry} pathOptions={lines.baseline} />
          <Polyline positions={plan.route.geometry} pathOptions={lines.routeGlow} />
          <Polyline positions={plan.route.geometry} pathOptions={lines.routeCasing} />
          <Polyline positions={plan.route.geometry} pathOptions={lines.route} />
          {plan.baseline.stairs_segments.map((segment, index) => (
            <Polyline key={`c${index}`} positions={segment} pathOptions={lines.stairsCasing} />
          ))}
          {plan.baseline.stairs_segments.map((segment, index) => (
            <Polyline key={index} positions={segment} pathOptions={lines.stairs} />
          ))}
        </>
      )}
      {props.pois.map((poi) => (
        <Marker
          key={poi.poi_id}
          position={[poi.lat, poi.lng]}
          icon={poiIcon(poi.category)}
          title={props.poiLabel(poi)}
          alt={props.poiLabel(poi)}
        >
          <Popup>
            <PoiDetails poi={poi} />
          </Popup>
        </Marker>
      ))}
      {props.stops?.map((stop, index) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={letterIcon(String(index + 1), 'var(--primary)')}
          title={stop.title}
          alt={stop.title}
        />
      ))}
      {props.start && (
        <PointMarker
          point={props.start}
          letter="A"
          finish={props.startIsFinish}
          title={props.pointLabels.start}
        />
      )}
      {props.end && <PointMarker point={props.end} letter="B" title={props.pointLabels.end} />}
    </MapContainer>
  )
}

function MapEvents({
  onClick,
  onCenterChange,
}: {
  onClick: (point: LatLng) => void
  onCenterChange: (center: LatLng) => void
}) {
  // react-leaflet gives the map only through hooks used inside <MapContainer>.
  const map = useMapEvents({
    click: (event) => onClick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => onCenterChange(map.getCenter()),
  })
  return null
}

interface FitBoundsProps {
  points: LatLngTuple[]
  /** Fit again only when this changes. Defaults to the first and last point and the count. */
  fitKey?: string
  bottomInset: number
  maxZoom?: number
}

function FitBounds({ points, fitKey, bottomInset, maxZoom = 18 }: FitBoundsProps) {
  const map = useMap()
  const key = fitKey ?? JSON.stringify([points[0], points[points.length - 1], points.length])
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(latLngBounds(points), { ...fitPadding(bottomInset), maxZoom })
    }
    // Fit only when the route changes, not on every render and not when the sheet is
    // opened or closed: that would move a map the user has just panned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

interface PointMarkerProps {
  point: LatLng
  letter: string
  title: string
  finish?: boolean
}

function PointMarker({ point, letter, title, finish }: PointMarkerProps) {
  const color = letter === 'A' ? 'var(--brand)' : 'var(--primary)'
  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={finish ? finishIcon() : letterIcon(letter, color)}
      title={title}
      alt={title}
    />
  )
}

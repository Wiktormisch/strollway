// A thin Leaflet wrapper: it only draws what it gets and reports clicks.
// All decisions live in lib/planner.ts and PlannerPage, which are tested without Leaflet.
import { useEffect } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { divIcon, latLngBounds, type DivIcon } from 'leaflet'
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
import { categoryColor, categoryIcon } from '@/constants/poiCategories'
import { planBounds } from '@/lib/planner'
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
}

export interface NumberedStop {
  id: string
  lat: number
  lng: number
  title: string
}

export function MapView(props: MapViewProps) {
  const { plan } = props
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
      {plan && (
        <>
          <FitBounds points={planBounds(plan)} />
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

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap()
  const key = JSON.stringify([points[0], points[points.length - 1], points.length])
  useEffect(() => {
    if (points.length > 0) map.fitBounds(latLngBounds(points), { padding: [40, 40], maxZoom: 18 })
    // Fit only when the route changes, not on every render.
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

// Icons are HTML (divIcon), so no PNG files are needed. That also avoids the
// known broken default marker image in Vite builds.
const iconCache = new Map<string, DivIcon>()

function poiIcon(category: string): DivIcon {
  const cached = iconCache.get(category)
  if (cached) return cached
  const Icon = categoryIcon(category)
  const svg = renderToStaticMarkup(<Icon size={16} strokeWidth={2.25} aria-hidden />)
  const icon = divIcon({
    html: `<span class="sw-poi-icon" style="color:${categoryColor(category)}">${svg}</span>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
  iconCache.set(category, icon)
  return icon
}

function finishIcon(): DivIcon {
  const cached = iconCache.get('finish')
  if (cached) return cached
  const svg = renderToStaticMarkup(<FlagIcon />)
  const icon = divIcon({
    html: `<span class="sw-point-icon" style="background:var(--brand)">${svg}</span>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
  iconCache.set('finish', icon)
  return icon
}

/** A small chequered flag: start and finish at the same point. */
function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 1v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="2" width="10" height="7" fill="currentColor" />
      <path
        d="M4 2h2.5v1.75H4zM9 2h2.5v1.75H9zM6.5 3.75H9V5.5H6.5zM11.5 3.75H14V5.5h-2.5zM4 5.5h2.5v1.75H4zM9 5.5h2.5v1.75H9zM6.5 7.25H9V9H6.5zM11.5 7.25H14V9h-2.5z"
        style={{ fill: 'var(--primary)' }}
      />
    </svg>
  )
}

function letterIcon(letter: string, color: string): DivIcon {
  const cacheKey = `${letter}:${color}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached
  const icon = divIcon({
    html: `<span class="sw-point-icon" style="background:${color}">${letter}</span>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
  iconCache.set(cacheKey, icon)
  return icon
}

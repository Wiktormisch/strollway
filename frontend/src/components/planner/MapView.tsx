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
import type { LatLng, LatLngTuple, Poi, RoutePlan } from '@/api/types'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/constants/demoRoutes'
import { BASELINE_STYLE, ROUTE_STYLE, STAIRS_STYLE } from '@/constants/mapStyles'
import { categoryIcon } from '@/constants/poiCategories'
import { planBounds } from '@/lib/planner'
import { PoiDetails } from './PoiDetails'

interface MapViewProps {
  start: LatLng | null
  end: LatLng | null
  plan: RoutePlan | undefined
  pois: Poi[]
  poiLabel: (poi: Poi) => string
  pointLabels: { start: string; end: string }
  onMapClick: (point: LatLng) => void
  onCenterChange: (center: LatLng) => void
}

export function MapView(props: MapViewProps) {
  const { plan } = props
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
          <Polyline positions={plan.baseline.geometry} pathOptions={BASELINE_STYLE} />
          <Polyline positions={plan.route.geometry} pathOptions={ROUTE_STYLE} />
          {plan.baseline.stairs_segments.map((segment, index) => (
            <Polyline key={index} positions={segment} pathOptions={STAIRS_STYLE} />
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
      {props.start && (
        <PointMarker point={props.start} letter="A" title={props.pointLabels.start} />
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

function PointMarker({ point, letter, title }: { point: LatLng; letter: string; title: string }) {
  const color = letter === 'A' ? '#059669' : '#7c3aed'
  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={letterIcon(letter, color)}
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
    html: `<span class="sw-poi-icon">${svg}</span>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
  iconCache.set(category, icon)
  return icon
}

function letterIcon(letter: string, color: string): DivIcon {
  const cached = iconCache.get(letter)
  if (cached) return cached
  const icon = divIcon({
    html: `<span class="sw-point-icon" style="background:${color}">${letter}</span>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
  iconCache.set(letter, icon)
  return icon
}

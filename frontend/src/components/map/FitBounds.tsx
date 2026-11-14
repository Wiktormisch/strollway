// Fits the map to a list of points. Shared by the planner map and the saved walk map (audit F7).
import { useEffect } from 'react'
import { latLngBounds, type FitBoundsOptions } from 'leaflet'
import { useMap } from 'react-leaflet'
import type { LatLngTuple } from '@/api/types'
import { prefersReducedMotion } from '@/lib/planner'

interface FitBoundsProps {
  points: LatLngTuple[]
  /** Fit again only when this changes. Defaults to the first and last point and the count. */
  fitKey?: string
  /** Leaflet padding options, for example `fitPadding(bottomInset)` from lib/planner. */
  padding: Pick<FitBoundsOptions, 'padding' | 'paddingTopLeft' | 'paddingBottomRight'>
  maxZoom?: number
}

export function FitBounds({ points, fitKey, padding, maxZoom = 18 }: FitBoundsProps) {
  const map = useMap()
  const key = fitKey ?? JSON.stringify([points[0], points[points.length - 1], points.length])
  useEffect(() => {
    if (points.length > 0) {
      // No pan and zoom animation when the system asks for less motion (audit U7).
      map.fitBounds(latLngBounds(points), {
        ...padding,
        maxZoom,
        animate: !prefersReducedMotion(),
      })
    }
    // Fit only when the route changes, not on every render and not when the padding changes
    // (the phone sheet opens or closes): that would move a map the user has just panned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

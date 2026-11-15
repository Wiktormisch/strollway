import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { BestTime, LatLng } from './types'

/** The backend rounds to 0.01 degrees (about 1 km) for the weather; the cache key does too. */
export function weatherCell(point: LatLng): LatLng {
  return { lat: Number(point.lat.toFixed(2)), lng: Number(point.lng.toFixed(2)) }
}

export function getBestWalkTime(point: LatLng): Promise<BestTime> {
  return apiFetch<BestTime>(`/api/best-walk-time/?lat=${point.lat}&lng=${point.lng}`)
}

/**
 * The best hours for a walk near the start (audit idea 2). It loads by itself when a start is
 * set. A small move of the start stays in the same cell, so it sends no new request.
 */
export function useBestWalkTime(start: LatLng | null) {
  const cell = start ? weatherCell(start) : null
  return useQuery({
    queryKey: ['best-walk-time', cell?.lat, cell?.lng] as const,
    queryFn: () => {
      if (!cell) throw new Error('No start point')
      return getBestWalkTime(cell)
    },
    enabled: cell !== null,
    // The forecast changes slowly; the backend caches it for an hour too.
    staleTime: 30 * 60 * 1000,
    // A new start keeps the old windows on screen until the new ones arrive, so the card
    // does not jump to placeholders every time the user moves the start.
    placeholderData: keepPreviousData,
    // "No forecast" is a normal 200 answer; a 429 will not change on a retry.
    retry: false,
  })
}

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { PlaceSearchResult } from './types'

export const MIN_PLACE_QUERY_LENGTH = 2

export function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  return apiFetch<PlaceSearchResult[]>(`/api/places/search/?q=${encodeURIComponent(query)}`)
}

/** Places by name from our own table (audit idea 15). Short queries send nothing. */
export function usePlaceSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['place-search', trimmed] as const,
    queryFn: () => searchPlaces(trimmed),
    enabled: trimmed.length >= MIN_PLACE_QUERY_LENGTH,
    // The place table changes only on a new import, so a result stays good for a long time.
    staleTime: 60 * 60 * 1000,
    retry: false,
  })
}

import { useQuery, type QueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { RoutePlan, RoutePlanRequest } from './types'

/** How long a computed route is reused without asking the server again. */
export const ROUTE_PLAN_CACHE_MS = 10 * 60 * 1000

export function postRoutePlan(request: RoutePlanRequest): Promise<RoutePlan> {
  return apiFetch<RoutePlan>('/api/route-plans/', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

function routePlanOptions(request: RoutePlanRequest | null) {
  return {
    // The whole request is the key, so a cached plan always matches the points and the switch.
    queryKey: ['route-plan', request] as const,
    queryFn: () => {
      if (!request) throw new Error('No route request')
      return postRoutePlan(request)
    },
    staleTime: ROUTE_PLAN_CACHE_MS,
    gcTime: ROUTE_PLAN_CACHE_MS,
  }
}

/**
 * Reads the cached plan for the current points. It never fetches by itself
 * (`enabled: false`): clicking the map must not send requests. `fetchRoutePlan` does.
 */
export function useRoutePlan(request: RoutePlanRequest | null) {
  return useQuery({ ...routePlanOptions(request), enabled: false })
}

/**
 * Fetches a plan, or reuses a fresh cached one. `force` skips the cache
 * ("Load places again"). Errors are shown from the query state, so they are not thrown here.
 */
export function fetchRoutePlan(
  queryClient: QueryClient,
  request: RoutePlanRequest,
  { force = false } = {},
): void {
  const options = routePlanOptions(request)
  queryClient.fetchQuery({ ...options, staleTime: force ? 0 : options.staleTime }).catch(() => {})
}

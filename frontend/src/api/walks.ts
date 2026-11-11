import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from './client'
import type {
  Stop,
  StopCreate,
  StopUpdate,
  WalkCreate,
  WalkDetail,
  WalkListItem,
  WalkStatus,
  WalkUpdate,
} from './types'

/**
 * Query keys in one place. invalidateQueries matches by prefix, so
 * `["walks"]` refreshes the list for every filter at once.
 */
export const walkKeys = {
  lists: ['walks'] as const,
  list: (status?: WalkStatus) => ['walks', { status: status ?? 'all' }] as const,
  details: ['walk'] as const,
  detail: (id: number) => ['walk', id] as const,
}

export function getWalks(status?: WalkStatus): Promise<WalkListItem[]> {
  const query = status ? `?status=${status}` : ''
  return apiFetch<WalkListItem[]>(`/api/walks/${query}`)
}

export function getWalk(id: number): Promise<WalkDetail> {
  return apiFetch<WalkDetail>(`/api/walks/${id}/`)
}

export function useWalks(status?: WalkStatus) {
  return useQuery({ queryKey: walkKeys.list(status), queryFn: () => getWalks(status) })
}

export function useWalk(id: number) {
  return useQuery({
    queryKey: walkKeys.detail(id),
    queryFn: () => getWalk(id),
    // A missing walk will not appear by asking again.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
}

/** Refreshes the lists and one walk after any change to it or its stops. */
function useRefreshWalk() {
  const queryClient = useQueryClient()
  return (walkId: number) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: walkKeys.lists }),
      queryClient.invalidateQueries({ queryKey: walkKeys.detail(walkId) }),
    ])
}

export function useCreateWalk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WalkCreate) =>
      apiFetch<WalkDetail>('/api/walks/', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (walk) => {
      // The answer is the full walk, so its page opens with no extra request.
      queryClient.setQueryData(walkKeys.detail(walk.id), walk)
      return queryClient.invalidateQueries({ queryKey: walkKeys.lists })
    },
  })
}

export function useUpdateWalk(id: number) {
  const refresh = useRefreshWalk()
  return useMutation({
    mutationFn: (input: WalkUpdate) =>
      apiFetch<WalkDetail>(`/api/walks/${id}/`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => refresh(id),
  })
}

export function useDeleteWalk(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<null>(`/api/walks/${id}/`, { method: 'DELETE' }),
    // The detail cache is not removed here: its page is still open and would fetch it
    // again (a 404 flash). The page navigates away; the unused cache entry expires by itself.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: walkKeys.lists }),
  })
}

export function useCreateStop(walkId: number) {
  const refresh = useRefreshWalk()
  return useMutation({
    mutationFn: (input: Omit<StopCreate, 'walk'>) =>
      apiFetch<Stop>('/api/stops/', {
        method: 'POST',
        body: JSON.stringify({ ...input, walk: walkId }),
      }),
    onSuccess: () => refresh(walkId),
  })
}

export function useUpdateStop(walkId: number) {
  const refresh = useRefreshWalk()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: StopUpdate }) =>
      apiFetch<Stop>(`/api/stops/${id}/`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => refresh(walkId),
  })
}

export function useDeleteStop(walkId: number) {
  const refresh = useRefreshWalk()
  return useMutation({
    mutationFn: (id: number) => apiFetch<null>(`/api/stops/${id}/`, { method: 'DELETE' }),
    onSuccess: () => refresh(walkId),
  })
}

export function useLoadDemoData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ created: boolean }>('/api/demo-data/', { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: walkKeys.lists }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
      ]),
  })
}

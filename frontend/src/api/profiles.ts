import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { FamilyProfile, ProfileInput } from './types'
import { walkKeys } from './walks'

export const profileKeys = {
  all: ['profiles'] as const,
}

export function getProfiles(): Promise<FamilyProfile[]> {
  return apiFetch<FamilyProfile[]>('/api/profiles/')
}

export function useProfiles() {
  return useQuery({ queryKey: profileKeys.all, queryFn: getProfiles })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<FamilyProfile>('/api/profiles/', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProfileInput }) =>
      apiFetch<FamilyProfile>(`/api/profiles/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

/**
 * Changes only the given fields (PATCH). The planner uses it to save its settings, so it
 * never overwrites a name or ages changed in another tab (audit idea 4).
 */
export function usePatchProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ProfileInput> }) =>
      apiFetch<FamilyProfile>(`/api/profiles/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<null>(`/api/profiles/${id}/`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.all }),
        // The backend sets walk.profile to null, so saved walks change too.
        queryClient.invalidateQueries({ queryKey: walkKeys.lists }),
        queryClient.invalidateQueries({ queryKey: walkKeys.details }),
      ]),
  })
}

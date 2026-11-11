import { QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'
import { fetchRoutePlan } from './planning'

const REQUEST = {
  start: { lat: 54.35, lng: 18.61 },
  end: { lat: 54.351, lng: 18.612 },
  avoid_stairs: true,
}

it('does not retry a failed route plan, even when the app retries other queries', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ code: 'no_route' }, { status: 422 }))
  // The same default as main.tsx.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

  fetchRoutePlan(queryClient, REQUEST)

  await vi.waitFor(() =>
    expect(queryClient.getQueryState(['route-plan', REQUEST])?.status).toBe('error'),
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

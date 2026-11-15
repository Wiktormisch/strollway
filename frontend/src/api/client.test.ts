import { vi } from 'vitest'
import { ApiError, apiFetch, getClientId } from './client'

const UUID = /^[0-9a-f-]{36}$/

describe('getClientId', () => {
  it('creates an id once and then reuses it', () => {
    const first = getClientId()
    expect(first).toMatch(UUID)
    expect(getClientId()).toBe(first)
  })

  it('keeps one id when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    const first = getClientId()

    expect(first).toMatch(UUID)
    expect(getClientId()).toBe(first)
  })
})

describe('apiFetch', () => {
  it('sends the X-Client-Id header and returns JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ a: 1 }))

    const data = await apiFetch<{ a: number }>('/api/health/')

    expect(data).toEqual({ a: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/health\/$/)
    expect(new Headers(init?.headers).get('X-Client-Id')).toBe(getClientId())
  })

  it('turns an HTTP error into ApiError with the server detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ detail: 'Invalid X-Client-Id.' }, { status: 400 }),
    )

    const error = await apiFetch('/api/walks/').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Invalid X-Client-Id.' })
  })

  it('uses a generic message when the error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad gateway', { status: 502 }))

    await expect(apiFetch('/api/x/')).rejects.toMatchObject({ status: 502, message: 'HTTP 502' })
  })

  it('maps a network failure to ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiFetch('/api/x/')).rejects.toMatchObject({ status: 0, name: 'ApiError' })
  })
})

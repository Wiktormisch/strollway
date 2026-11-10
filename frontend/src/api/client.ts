const CLIENT_ID_STORAGE_KEY = 'strollway.clientId'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

/**
 * One error type for every failed API call.
 * `status` is 0 when the server could not be reached at all.
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** A random id for this browser, kept in localStorage. It is not a login. */
export function getClientId(): string {
  try {
    const saved = localStorage.getItem(CLIENT_ID_STORAGE_KEY)
    if (saved) return saved
    const created = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
    return body.detail
  }
  return `HTTP ${status}`
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Client-Id', getClientId())
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, body), body)
  }
  return body as T
}

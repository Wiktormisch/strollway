import { vi } from 'vitest'

export interface ApiCall {
  method: string
  path: string
  search: string
  body: unknown
}

type Handler = (call: ApiCall) => Response | Promise<Response>
// Not `unknown`: a union with unknown is just unknown, and handlers would lose their types.
type Answer = Handler | Response | Error | object | string | number | boolean | null

/**
 * Mocks fetch with a table like { "GET /api/walks/": [...] }.
 * A plain value becomes a JSON 200, an Error a network failure, a function decides itself.
 * Unknown routes answer 404, so a missing mock shows up in the test.
 * Returns every call, to check what the UI sent.
 */
export function mockApi(routes: Record<string, Answer>): ApiCall[] {
  const calls: ApiCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input))
    const call: ApiCall = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      search: url.search,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const answer = routes[`${call.method} ${call.path}`]
    if (answer === undefined) return Response.json({ detail: 'not mocked' }, { status: 404 })
    if (answer instanceof Error) throw answer
    if (answer instanceof Response) return answer.clone()
    if (typeof answer === 'function') return answer(call)
    return Response.json(answer)
  })
  return calls
}

/** A promise that never settles: keeps a query in its loading state. */
export function never(): Promise<Response> {
  return new Promise(() => {})
}

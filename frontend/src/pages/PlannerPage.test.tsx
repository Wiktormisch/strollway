import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { RoutePlan } from '@/api/types'
import { renderWithProviders } from '@/test/render'
import { makePlan } from '@/test/routePlan'
import { makeProfile } from '@/test/walks'
import { PlannerPage } from './PlannerPage'

type RouteAnswer = RoutePlan | Promise<RoutePlan> | { status: number; body: unknown }

/** Health always answers; each route-plans call takes the next answer from the list. */
function mockApi(...answers: RouteAnswer[]) {
  const routeCalls: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (url.includes('/api/health/')) return Promise.resolve(Response.json({ status: 'ok' }))
    if (url.includes('/api/profiles/')) return Promise.resolve(Response.json([makeProfile()]))
    routeCalls.push(JSON.parse(String(init?.body)))
    const answer = answers.shift()
    if (!answer) return Promise.reject(new TypeError('no more answers'))
    if (answer instanceof Promise) return answer.then((plan) => Response.json(plan))
    if ('status' in answer && 'body' in answer) {
      return Promise.resolve(Response.json(answer.body, { status: answer.status }))
    }
    return Promise.resolve(Response.json(answer))
  })
  return routeCalls
}

describe('PlannerPage', () => {
  it('shows the demo points on the map at once, again on each click (audit idea 6)', async () => {
    mockApi(makePlan(), makePlan())
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    expect(screen.getByText('map focus: none')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Big detour' }))
    expect(
      screen.getByText('map focus: 1 [[54.347791,18.618119],[54.34874,18.618458]]'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Big detour' }))
    expect(screen.getByText(/^map focus: 2 /)).toBeInTheDocument()
  })

  it('plans a demo route and shows the comparison, places and stops', async () => {
    const calls = mockApi(makePlan({ source: 'fixture' }))
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    expect(screen.getByText(/Set a start and an end/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Map legend' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Big detour' }))

    expect(await screen.findByText(/Stair-free route: \+288 m, \+4 min\./)).toBeInTheDocument()
    expect(calls).toEqual([
      {
        start: { lat: 54.347791, lng: 18.618119 },
        end: { lat: 54.34874, lng: 18.618458 },
        avoid_stairs: true,
      },
    ])
    expect(screen.getByText(/Demo mode: a recorded route/)).toBeInTheDocument()
    // Both point rows show the demo name, never raw coordinates.
    expect(screen.getAllByText('Big detour')).toHaveLength(3) // the demo button + rows A and B
    expect(screen.queryByText('Point on the map')).not.toBeInTheDocument()
    expect(screen.getByText('map route: drawn')).toBeInTheDocument()
    // With a result, the legend chip appears on the map.
    expect(screen.getByRole('list', { name: 'Map legend' })).toBeInTheDocument()
    // Phones open it from the "i" button, so it does not cover the route.
    const legendButton = screen.getByRole('button', { name: 'Show the map legend' })
    await user.click(legendButton)
    expect(legendButton).toHaveAttribute('aria-expanded', 'true')
    expect(legendButton).toHaveAccessibleName('Hide the map legend')
    expect(screen.getByText('Fake Cafe')).toBeInTheDocument()
    expect(screen.getByText('Fake Stop')).toBeInTheDocument()

    // Hiding a category removes its places from the list and the map.
    expect(screen.getByText('map places: 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cafe (1)' }))
    expect(screen.queryByText('Fake Cafe')).not.toBeInTheDocument()
    expect(screen.getByText('map places: 1')).toBeInTheDocument()
  })

  it('sets points by map clicks, sends the switch value and clears a point', async () => {
    const calls = mockApi(makePlan({ step_free_available: null, detour_m: null }))
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    const plan = screen.getByRole('button', { name: 'Plan route' })
    expect(plan).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'fake map click A' }))
    await user.click(screen.getByRole('button', { name: 'fake map click B' }))
    await user.click(screen.getByRole('switch', { name: 'Avoid stairs' }))
    await user.click(plan)

    expect(await screen.findByText('Stairs are not avoided.')).toBeInTheDocument()
    expect(calls[0]).toMatchObject({ avoid_stairs: false, end: { lat: 54.351, lng: 18.612 } })

    // Changing a point drops the old result, so the map never shows a stale route.
    await user.click(screen.getByRole('button', { name: 'Clear End' }))
    expect(screen.getByText('map route: none')).toBeInTheDocument()
    expect(plan).toBeDisabled()
  })

  it('shows its own message for 422 no_route and retries', async () => {
    mockApi({ status: 422, body: { code: 'no_route', detail: 'x' } }, makePlan())
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    await user.click(screen.getByRole('button', { name: 'No stair-free route' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('We could not find any walking route')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Stair-free route: +288 m, +4 min' }),
    ).toBeInTheDocument()
  })

  it('offers to load places again when the places service is down', async () => {
    let answerReload: (plan: RoutePlan) => void = () => {}
    const reload = new Promise<RoutePlan>((resolve) => {
      answerReload = resolve
    })
    const calls = mockApi(makePlan({ pois_status: 'unavailable', pois: [] }), reload)
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    await user.click(screen.getByRole('button', { name: 'Tiny detour' }))
    expect(await screen.findByText('The places service did not answer.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load places again' }))
    // Regression: while places reload, the route and the comparison stay on screen.
    expect(screen.getByRole('button', { name: 'Load places again' })).toBeDisabled()
    expect(screen.getByText('map route: drawn')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Stair-free route: +288 m, +4 min' }),
    ).toBeInTheDocument()

    answerReload(makePlan({ pois: [] }))
    expect(
      await screen.findByText('There are no tagged places near this route in OpenStreetMap.'),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
  })

  it('reuses a computed route when the same input comes back', async () => {
    const calls = mockApi(makePlan())
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    await user.click(screen.getByRole('button', { name: 'Big detour' }))
    expect(
      await screen.findByRole('heading', { name: 'Stair-free route: +288 m, +4 min' }),
    ).toBeInTheDocument()

    // A changed input hides the old result and sends nothing by itself.
    const avoid = screen.getByRole('switch', { name: 'Avoid stairs' })
    await user.click(avoid)
    expect(screen.getByText('map route: none')).toBeInTheDocument()
    expect(calls).toHaveLength(1)

    // Back to the first input: the cached result shows at once, with no new request.
    await user.click(avoid)
    expect(
      screen.getByRole('heading', { name: 'Stair-free route: +288 m, +4 min' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plan route' }))
    expect(calls).toHaveLength(1)
  })

  it('plans from a button on the map when the panel is folded', async () => {
    const calls = mockApi(makePlan())
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    const toggle = screen.getByRole('button', { name: 'Hide the panel' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Show the panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await user.click(screen.getByRole('button', { name: 'fake map click A' }))
    await user.click(screen.getByRole('button', { name: 'fake map click B' }))

    // jsdom has no CSS, so the folded panel's own button is in the DOM too; the map one is last.
    const buttons = screen.getAllByRole('button', { name: 'Plan route' })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1])

    expect(await screen.findByText('map route: drawn')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    // With a result the map button changes to the next step: saving the walk.
    expect(screen.getAllByRole('button', { name: 'Plan route' })).toHaveLength(1)
    const saveButtons = screen.getAllByRole('button', { name: 'Save walk' })
    expect(saveButtons).toHaveLength(2)
    await user.click(saveButtons[1])
    expect(screen.getByRole('dialog', { name: 'Save walk' })).toBeInTheDocument()
  })

  it('sends profile_id after choosing a profile and plans again', async () => {
    const calls = mockApi(makePlan(), makePlan({ route: { ...makePlan().route, duration_min: 9 } }))
    const user = userEvent.setup()
    renderWithProviders(<PlannerPage />)

    await user.click(screen.getByRole('button', { name: 'Big detour' }))
    await screen.findByText('map route: drawn')
    expect(calls[0]).not.toHaveProperty('profile_id')

    await user.click(screen.getByRole('combobox', { name: /Family profile/ }))
    await user.click(await screen.findByRole('option', { name: 'Fake weekend' }))

    expect(await screen.findByText(/9 min/)).toBeInTheDocument()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ avoid_stairs: true, profile_id: 3 })
  })
})

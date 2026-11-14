import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { mockApi } from '@/test/mockApi'
import { makeTrip } from '@/test/tripIdea'
import { makeProfile } from '@/test/walks'
import { PlannerPage } from './PlannerPage'

function WalkStub() {
  return <p>walk page {useParams().id}</p>
}

function renderPlanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PlannerPage />} />
          <Route path="/walks/:id" element={<WalkStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const BASE = {
  'GET /api/health/': { status: 'ok' },
  'GET /api/profiles/': [makeProfile()],
}

describe('PlannerPage, trip idea', () => {
  it('suggests a trip, removes a stop, saves it and opens the walk', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /api/trip-ideas/': makeTrip(),
      'POST /api/walks/': { id: 42 },
    })
    const user = userEvent.setup()
    renderPlanner()

    await user.click(screen.getByRole('tab', { name: 'Trip idea' }))
    await user.click(screen.getByRole('button', { name: 'Try the demo start' }))
    // The demo start is shown on the map at once (audit idea 6).
    expect(screen.getByText(/^map focus: 1 \[\[/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))

    expect(await screen.findByText('Planned by rules (demo mode)')).toBeInTheDocument()
    expect(calls.find((call) => call.path === '/api/trip-ideas/')?.body).toEqual({
      start: { lat: 54.3385, lng: 18.62 },
      max_minutes: 60,
      round_trip: true,
      language: 'en',
      wishes: '',
    })
    expect(
      screen.getByText('map stops: Fake Playground, Fake Cafe, Restaurant'),
    ).toBeInTheDocument()
    expect(screen.getByText('ice cream')).toBeInTheDocument()
    // The values are separate items, so the check reads the text of the whole weather line.
    expect(screen.getByText('8°C').closest('p')).toHaveTextContent(
      'Weather: 8°C·rain 60%·wind 20 km/h',
    )

    await user.click(screen.getByRole('button', { name: 'Remove stop Fake Cafe' }))
    expect(screen.getByText('map stops: Fake Playground, Restaurant')).toBeInTheDocument()
    expect(screen.getByText(/You removed a stop/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save walk' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Stops to save: 2/)).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Name'), 'Sunday loop')
    await user.click(within(dialog).getByRole('button', { name: 'Save walk' }))

    expect(await screen.findByText('walk page 42')).toBeInTheDocument()
    const saved = calls.find((call) => call.path === '/api/walks/')?.body as {
      ai_summary: string
      stops: { osm_id: string; source: string; order: number }[]
    }
    expect(saved.ai_summary).toBe('A short loop: playground, coffee and pizza.')
    expect(saved.stops.map((stop) => [stop.order, stop.osm_id, stop.source])).toEqual([
      [1, 'node/1', 'rules'],
      [2, 'node/3', 'rules'],
    ])
  })

  it('shows a friendly message for 422 no_places_nearby', async () => {
    mockApi({
      ...BASE,
      'POST /api/trip-ideas/': Response.json(
        { code: 'no_places_nearby', detail: 'No places.' },
        { status: 422 },
      ),
    })
    const user = userEvent.setup()
    renderPlanner()

    await user.click(screen.getByRole('tab', { name: 'Trip idea' }))
    await user.click(screen.getByRole('button', { name: 'fake map click A' }))
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /found no playgrounds, cafes or restaurants near this start point/,
    )
  })
  it('explains a 400 in trip words, not with the route message', async () => {
    mockApi({
      ...BASE,
      'POST /api/trip-ideas/': Response.json({ profile_id: ['Not found.'] }, { status: 400 }),
    })
    const user = userEvent.setup()
    renderPlanner()

    await user.click(screen.getByRole('tab', { name: 'Trip idea' }))
    await user.click(screen.getByRole('button', { name: 'fake map click A' }))
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/The form has an invalid value/)
    expect(alert).not.toHaveTextContent(/Put the end closer/)
  })

  it('on a phone with the panel folded, the map button suggests and then saves', async () => {
    const calls = mockApi({ ...BASE, 'POST /api/trip-ideas/': makeTrip() })
    const user = userEvent.setup()
    renderPlanner()

    await user.click(screen.getByRole('tab', { name: 'Trip idea' }))
    await user.click(screen.getByRole('button', { name: '90 min' }))
    await user.click(screen.getByRole('button', { name: 'Try the demo start' }))
    await user.click(screen.getByRole('button', { name: 'Hide the panel' }))

    // Two buttons share the name; the map one is the last in the DOM.
    const suggest = screen.getAllByRole('button', { name: 'Suggest a trip' }).at(-1)!
    await user.click(suggest)

    expect(await screen.findByText('map start: start and finish')).toBeInTheDocument()
    const sent = calls.filter((call) => call.path === '/api/trip-ideas/')
    expect(sent).toHaveLength(1)
    // The folded form was submitted, so the chosen limit is in the request.
    expect(sent[0].body).toMatchObject({ max_minutes: 90 })
    expect(screen.getAllByRole('button', { name: 'Save walk' }).length).toBeGreaterThan(0)
  })
})

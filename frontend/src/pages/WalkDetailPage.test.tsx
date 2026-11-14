import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import type { WalkDetail } from '@/api/types'
import { mockApi } from '@/test/mockApi'
import { renderWithProviders } from '@/test/render'
import { makeWalkDetail } from '@/test/walks'
import { WalkDetailPage } from './WalkDetailPage'

function renderPage() {
  renderWithProviders(
    <Routes>
      <Route path="/walks/:id" element={<WalkDetailPage />} />
      <Route path="/walks" element={<p>walks list page</p>} />
    </Routes>,
    { route: '/walks/1' },
  )
  return userEvent.setup()
}

/** The walk answers GET; PATCH changes it, so the refetch after invalidation sees the change. */
function mockWalk(initial: WalkDetail = makeWalkDetail()) {
  let walk = initial
  return mockApi({
    'GET /api/walks/1/': () => Response.json(walk),
    'PATCH /api/walks/1/': (call) => {
      walk = { ...walk, ...(call.body as Partial<WalkDetail>) }
      return Response.json(walk)
    },
    'DELETE /api/walks/1/': () => new Response(null, { status: 204 }),
    'PATCH /api/stops/11/': (call) => {
      const changes = call.body as Partial<WalkDetail['stops'][number]>
      walk = { ...walk, stops: walk.stops.map((stop) => ({ ...stop, ...changes })) }
      return Response.json(walk.stops[0])
    },
    'DELETE /api/stops/11/': () => {
      walk = { ...walk, stops: [] }
      return new Response(null, { status: 204 })
    },
  })
}

describe('WalkDetailPage', () => {
  it('shows the walk with its stops', async () => {
    mockWalk()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Fake park loop' })).toBeInTheDocument()
    expect(screen.getByText('walk map: 1 stops')).toBeInTheDocument()
    expect(screen.getByText('Fake Playground')).toBeInTheDocument()
  })

  it('shows the stats row and the status chip, and no raw coordinates', async () => {
    mockWalk()
    renderPage()
    await screen.findByRole('heading', { name: 'Fake park loop' })
    const stats = screen.getByLabelText('The walk in numbers')
    expect(within(stats).getByText('Stairs on the route')).toBeInTheDocument()
    expect(screen.getByText('Planned')).toBeInTheDocument()
    // Stop rows show a name or a category, never "54.35, 18.64" style numbers.
    expect(document.body.textContent).not.toMatch(/\d+\.\d{3,}/)
  })

  it('shows a not-found state for a missing walk', async () => {
    mockApi({ 'GET /api/walks/1/': Response.json({ detail: 'Not found.' }, { status: 404 }) })
    renderPage()
    expect(await screen.findByText('Walk not found.')).toBeInTheDocument()
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const calls = mockWalk()
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete walk' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this walk?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  })

  it('deletes after confirming and goes back to the list', async () => {
    const calls = mockWalk()
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete walk' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this walk?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('walks list page')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  })

  it('marks the walk as done with a rating', async () => {
    const calls = mockWalk()
    const user = renderPage()
    const markDone = await screen.findByRole('button', { name: 'Mark as done' })
    expect(markDone).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: '4 of 5' }))
    await user.click(markDone)

    expect(await screen.findByRole('button', { name: 'Mark as planned again' })).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      status: 'done',
      rating: 4,
    })
  })

  it('validates and saves the planned minutes of a stop', async () => {
    const calls = mockWalk()
    const user = renderPage()
    const minutes = await screen.findByLabelText('Minutes')

    await user.clear(minutes)
    await user.type(minutes, '200')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(minutes).toHaveAccessibleDescription('Give a whole number from 1 to 120.')
    expect(calls.some((call) => call.path === '/api/stops/11/')).toBe(false)

    await user.clear(minutes)
    await user.type(minutes, '30')
    await user.type(screen.getByLabelText('Note'), 'Fake note')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // After the refetch the row shows the saved values and the Save button is gone.
    expect(await screen.findByDisplayValue('Fake note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(calls.find((call) => call.path === '/api/stops/11/')?.body).toEqual({
      planned_minutes: 30,
      reason: 'Fake note',
    })
  })

  it('deletes a stop only after confirming', async () => {
    const calls = mockWalk()
    const user = renderPage()
    const deleteStop = await screen.findByRole('button', { name: 'Delete stop Fake Playground' })

    await user.click(deleteStop)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)

    await user.click(deleteStop)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No stops yet.')).toBeInTheDocument()
  })
})

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, never } from '@/test/mockApi'
import { renderWithProviders } from '@/test/render'
import { makeWalkItem } from '@/test/walks'
import { WalksPage } from './WalksPage'

describe('WalksPage', () => {
  it('shows a loading state', () => {
    mockApi({ 'GET /api/walks/': () => never() })
    renderWithProviders(<WalksPage />)
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty state that loads sample walks', async () => {
    let created = false
    const calls = mockApi({
      'GET /api/walks/': () => Response.json(created ? [makeWalkItem()] : []),
      'POST /api/demo-data/': () => {
        created = true
        return Response.json({ created: true }, { status: 201 })
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<WalksPage />)

    expect(await screen.findByText('No saved walks yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add sample walks' }))

    // The list refreshes by itself after the mutation (query invalidation).
    expect(await screen.findByRole('link', { name: 'Fake park loop' })).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
  })

  it('shows an error with a working retry', async () => {
    let fail = true
    mockApi({
      'GET /api/walks/': () =>
        fail ? Response.json({}, { status: 500 }) : Response.json([makeWalkItem()]),
    })
    const user = userEvent.setup()
    renderWithProviders(<WalksPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The server returned error 500.')
    fail = false
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Fake park loop' })).toBeInTheDocument()
  })

  it('lists walks and filters them by status', async () => {
    const calls = mockApi({
      'GET /api/walks/': (call) =>
        Response.json(
          call.search === '?status=done'
            ? [makeWalkItem({ id: 2, name: 'Fake done walk', status: 'done', rating: 4 })]
            : [makeWalkItem()],
        ),
    })
    const user = userEvent.setup()
    renderWithProviders(<WalksPage />)

    const link = await screen.findByRole('link', { name: 'Fake park loop' })
    expect(link).toHaveAttribute('href', '/walks/1')
    expect(screen.getByText('1.3 km')).toBeInTheDocument()
    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(screen.getByText('16 m')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem')).getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('Saved Jan 1, 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Fake done walk')).toBeInTheDocument()
    expect(screen.getByText('4 of 5')).toBeInTheDocument()
    expect(calls.at(-1)?.search).toBe('?status=done')
  })
})

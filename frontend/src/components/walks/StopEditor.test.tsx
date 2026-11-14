import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { toast } from 'sonner'
import type { LatLng, Stop } from '@/api/types'
import { renderWithProviders } from '@/test/render'
import { makeStop } from '@/test/walks'
import { StopEditor } from './StopEditor'

// Toasts render outside the component; checking the calls is enough here.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// restoreMocks resets spies only; clear the toast calls so one test cannot pass on another's.
beforeEach(() => vi.clearAllMocks())

const FAKE_POINT: LatLng = { lat: 54.35, lng: 18.62 }

/** Answers every request with a fresh Response (a body can be read only once). */
function mockFetch(status = 200, body: unknown = {}) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
    )
}

function lastRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return {
    url: String(url),
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  }
}

function setup(options: { stops?: Stop[]; adding?: boolean; draft?: LatLng | null } = {}) {
  const onAddingChange = vi.fn()
  renderWithProviders(
    <StopEditor
      walkId={1}
      stops={options.stops ?? []}
      stopLabel={(stop) => stop.name || stop.category}
      draft={options.draft ?? null}
      adding={options.adding ?? false}
      onAddingChange={onAddingChange}
    />,
  )
  return { onAddingChange, user: userEvent.setup() }
}

describe('StopEditor: list', () => {
  it('shows the empty state and starts adding', async () => {
    const { onAddingChange, user } = setup()

    expect(screen.getByText('No stops yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a stop' }))

    expect(onAddingChange).toHaveBeenCalledWith(true)
  })

  it('numbers the stops in order', () => {
    setup({
      stops: [makeStop({ id: 1, name: 'Fake A' }), makeStop({ id: 2, name: 'Fake B' })],
    })

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('1')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Fake B')).toBeInTheDocument()
  })
})

describe('StopEditor: new stop', () => {
  it('asks for a map point before it sends anything', async () => {
    const fetchMock = mockFetch()
    const { user } = setup({ adding: true })

    expect(screen.queryByRole('button', { name: 'Add a stop' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add stop' }))

    expect(screen.getByText('Click the map to place the stop.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects minutes out of range', async () => {
    const fetchMock = mockFetch()
    const { user } = setup({ adding: true, draft: FAKE_POINT })

    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '121')
    await user.click(screen.getByRole('button', { name: 'Add stop' }))

    expect(screen.getByLabelText('Minutes')).toHaveAccessibleDescription(
      'Give a whole number from 1 to 120.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the new stop after the last one and closes the form', async () => {
    const fetchMock = mockFetch(201, makeStop({ id: 99 }))
    const { onAddingChange, user } = setup({
      adding: true,
      draft: FAKE_POINT,
      stops: [makeStop({ id: 1, order: 4 })],
    })

    await user.type(screen.getByLabelText('Name (optional)'), '  Fake Ice cream  ')
    await user.click(screen.getByRole('combobox', { name: 'Category' }))
    await user.click(screen.getByRole('option', { name: 'Cafe' }))
    await user.click(screen.getByRole('button', { name: 'Add stop' }))

    expect(lastRequest(fetchMock)).toEqual({
      url: expect.stringMatching(/\/api\/stops\/$/),
      method: 'POST',
      body: {
        walk: 1,
        order: 5,
        name: 'Fake Ice cream',
        category: 'cafe',
        lat: FAKE_POINT.lat,
        lng: FAKE_POINT.lng,
        osm_id: '',
        planned_minutes: 10,
        reason: '',
        source: 'user',
      },
    })
    expect(toast.success).toHaveBeenCalledWith('Stop added.')
    expect(onAddingChange).toHaveBeenCalledWith(false)
  })

  it('cancels without a request', async () => {
    const fetchMock = mockFetch()
    const { onAddingChange, user } = setup({ adding: true })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onAddingChange).toHaveBeenCalledWith(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('StopEditor: edit a stop', () => {
  it('shows Save only after a change and sends the new values', async () => {
    const fetchMock = mockFetch(200, makeStop())
    const { user } = setup({ stops: [makeStop({ id: 11, planned_minutes: 15 })] })

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '20')
    await user.type(screen.getByLabelText('Note'), 'Fake shade')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(lastRequest(fetchMock)).toEqual({
      url: expect.stringMatching(/\/api\/stops\/11\/$/),
      method: 'PATCH',
      body: { planned_minutes: 20, reason: 'Fake shade' },
    })
    expect(toast.success).toHaveBeenCalledWith('Stop saved.')
  })

  it('checks the minutes before it sends anything', async () => {
    const fetchMock = mockFetch()
    const { user } = setup({ stops: [makeStop()] })

    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Minutes')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a field error from the server next to the field', async () => {
    mockFetch(400, { reason: ['Fake server message.'] })
    const { user } = setup({ stops: [makeStop()] })

    await user.type(screen.getByLabelText('Note'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Fake server message.')).toBeInTheDocument()
    expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'true')
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('StopEditor: delete a stop', () => {
  it('asks first, then deletes the stop', async () => {
    const fetchMock = mockFetch(204)
    const { user } = setup({ stops: [makeStop({ id: 11, name: 'Fake Playground' })] })

    await user.click(screen.getByRole('button', { name: 'Delete stop Fake Playground' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this stop?' })
    expect(dialog).toHaveTextContent('"Fake Playground" will be removed from the walk.')
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(lastRequest(fetchMock)).toMatchObject({
      url: expect.stringMatching(/\/api\/stops\/11\/$/),
      method: 'DELETE',
    })
    expect(toast.success).toHaveBeenCalledWith('Stop deleted.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the dialog open and shows an error when the delete fails', async () => {
    mockFetch(500, {})
    const { user } = setup({ stops: [makeStop()] })

    await user.click(screen.getByRole('button', { name: 'Delete stop Fake Playground' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not delete the stop.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

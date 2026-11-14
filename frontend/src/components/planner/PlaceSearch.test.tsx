import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderWithProviders } from '@/test/render'
import { PlaceSearch } from './PlaceSearch'

const PARK = { poi_id: 'way/1', name: 'Park Oliwski', category: 'park', lat: 54.41, lng: 18.56 }
const ZOO = { poi_id: 'way/2', name: 'Oliwa Zoo', category: 'zoo', lat: 54.4, lng: 18.5 }

function setup(answer: object = [PARK, ZOO]) {
  const calls = mockApi({ 'GET /api/places/search/': answer })
  const onPick = vi.fn()
  renderWithProviders(<PlaceSearch onPick={onPick} />)
  return {
    calls,
    onPick,
    input: screen.getByRole('combobox', { name: 'Search for a start place' }),
  }
}

describe('PlaceSearch', () => {
  it('sends one request after typing and picks a result with a click', async () => {
    const user = userEvent.setup()
    const { calls, onPick, input } = setup()
    await user.type(input, 'oliw')
    await user.click(await screen.findByRole('option', { name: /Park Oliwski/ }))

    expect(onPick).toHaveBeenCalledWith({ lat: 54.41, lng: 18.56 })
    expect(input).toHaveValue('')
    // Debounced: the four keys give one request with the whole text.
    expect(calls.map((call) => call.search)).toEqual(['?q=oliw'])
  })

  it('picks with the arrow keys and Enter', async () => {
    const user = userEvent.setup()
    const { onPick, input } = setup()
    await user.type(input, 'oliw')
    await screen.findByRole('option', { name: /Oliwa Zoo/ })
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledWith({ lat: 54.4, lng: 18.5 })
  })

  it('sends nothing for one letter', async () => {
    const user = userEvent.setup()
    const { calls, input } = setup()
    await user.type(input, 'o')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(calls).toHaveLength(0)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('says when nothing is found', async () => {
    const user = userEvent.setup()
    const { input } = setup([])
    await user.type(input, 'xyz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Nothing found'))
  })
})

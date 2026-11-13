import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { tripTotals } from '@/lib/trip'
import { renderWithProviders } from '@/test/render'
import { makeTrip } from '@/test/tripIdea'
import { StopsTimeline } from './StopsTimeline'

describe('StopsTimeline', () => {
  it('lists the stops in the trip order with arrival, minutes and reason', () => {
    const trip = makeTrip()
    renderWithProviders(
      <StopsTimeline engine="rules" stops={trip.stops} totals={tripTotals(trip, trip.stops)} />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(/^1Fake Playground/)
    expect(items[1]).toHaveTextContent(/^2Fake Cafe/)
    // No name in OSM: the category label instead.
    expect(items[2]).toHaveTextContent(/^3Restaurant/)
    expect(within(items[1]).getByText('arrive at 30 min · 15 min here')).toBeInTheDocument()
    expect(within(items[1]).getByText('Coffee for the parents.')).toBeInTheDocument()
    expect(screen.getByText('Total: 1 h 16 min of 1 h 30 min')).toBeInTheDocument()
  })

  it('labels a rule-based plan honestly', () => {
    const trip = makeTrip()
    renderWithProviders(
      <StopsTimeline engine="rules" stops={trip.stops} totals={tripTotals(trip, trip.stops)} />,
    )
    expect(screen.getByText('Planned by rules (demo mode)')).toBeInTheDocument()
    expect(screen.queryByText('Planned by AI')).not.toBeInTheDocument()
  })

  it('labels an LLM plan as AI', () => {
    const trip = makeTrip({ engine: 'claude_cli' })
    renderWithProviders(
      <StopsTimeline
        engine="claude_cli"
        stops={trip.stops}
        totals={tripTotals(trip, trip.stops)}
      />,
    )
    expect(screen.getByText('Planned by AI')).toBeInTheDocument()
  })

  it('warns when the trip is over the limit, and not otherwise', () => {
    const over = makeTrip({ total_min: 80, max_minutes: 60, over_limit: true })
    const { unmount } = renderWithProviders(
      <StopsTimeline engine="rules" stops={over.stops} totals={tripTotals(over, over.stops)} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/longer than your time limit/)
    unmount()

    const fine = makeTrip()
    renderWithProviders(
      <StopsTimeline engine="rules" stops={fine.stops} totals={tripTotals(fine, fine.stops)} />,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('removes a stop, but never the last one', async () => {
    const trip = makeTrip()
    const onRemove = vi.fn()
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(
      <StopsTimeline
        engine="rules"
        stops={trip.stops}
        totals={tripTotals(trip, trip.stops)}
        onRemove={onRemove}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Remove stop Fake Cafe' }))
    expect(onRemove).toHaveBeenCalledWith('node/2')

    const one = trip.stops.slice(0, 1)
    rerender(
      <StopsTimeline
        engine="rules"
        stops={one}
        totals={tripTotals(trip, one)}
        onRemove={onRemove}
      />,
    )
    expect(screen.queryByRole('button', { name: /Remove stop/ })).not.toBeInTheDocument()
  })
})

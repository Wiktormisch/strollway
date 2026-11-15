import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { BestTimeWindow } from '@/api/types'
import { weatherCell } from '@/api/weather'
import { mockApi, never } from '@/test/mockApi'
import { renderWithProviders } from '@/test/render'
import { BestTimeCard } from './BestTimeCard'

const START = { lat: 54.338512, lng: 18.620049 }

function makeWindow(changes: Partial<BestTimeWindow> = {}): BestTimeWindow {
  return {
    date: '2026-11-13',
    day_offset: 2,
    start: '12:00',
    end: '16:00',
    hours: 4,
    score: 90,
    label: 'great',
    temp_c: 9.4,
    precip_probability: 5,
    wind_kmh: 8,
    sunshine_pct: 100,
    ...changes,
  }
}

function setup(answer: unknown, start: typeof START | null = START) {
  const calls = mockApi({ 'GET /api/best-walk-time/': answer as object })
  renderWithProviders(<BestTimeCard start={start} />)
  return calls
}

/** The card with a button that moves the start to another weather cell. */
function MovableStart() {
  const [start, setStart] = useState(START)
  return (
    <>
      <button onClick={() => setStart({ lat: 54.4, lng: 18.57 })}>move</button>
      <BestTimeCard start={start} />
    </>
  )
}

describe('BestTimeCard', () => {
  it('shows nothing and sends nothing without a start', () => {
    const calls = setup({ available: true, windows: [] }, null)
    expect(screen.queryByRole('heading', { name: 'Best time for a walk' })).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('loads by itself for the start, rounded to the weather cell', async () => {
    const calls = setup({
      available: true,
      windows: [
        makeWindow(),
        makeWindow({ day_offset: 0, date: '2026-11-11', start: '11:00', end: '15:00' }),
        makeWindow({ day_offset: 1, date: '2026-11-12', label: 'ok', score: 40 }),
      ],
    })

    const lists = await screen.findAllByRole('list')
    expect(calls.map((call) => call.search)).toEqual(['?lat=54.34&lng=18.62'])
    // The outer <ol> holds one item per window; each window has its own small <ul> of facts.
    const windows = [...lists.find((list) => list.tagName === 'OL')!.children] as HTMLElement[]
    expect(windows.map((row) => within(row).getAllByRole('paragraph')[0].textContent)).toEqual([
      'Friday, 12:00–16:00',
      'Today, 11:00–15:00',
      'Tomorrow, 12:00–16:00',
    ])
    expect(within(windows[0]).getByText('Great')).toBeInTheDocument()
    expect(within(windows[0]).getByText('9°C')).toBeInTheDocument()
    expect(within(windows[0]).getByText('rain 5%')).toBeInTheDocument()
    expect(within(windows[0]).getByText('wind 8 km/h')).toBeInTheDocument()
    expect(within(windows[2]).getByText('OK')).toBeInTheDocument()
  })

  it('keeps the old windows, dimmed, while a new start loads', async () => {
    const calls = mockApi({
      'GET /api/best-walk-time/': (call) =>
        call.search.includes('54.34')
          ? Response.json({ available: true, windows: [makeWindow()] })
          : never(),
    })
    renderWithProviders(<MovableStart />)
    await screen.findByText('Friday, 12:00–16:00')

    await userEvent.click(screen.getByRole('button', { name: 'move' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    const text = screen.getByText('Friday, 12:00–16:00')
    expect(text.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
    expect(text.closest('[aria-busy]')).toHaveClass('opacity-60')
  })

  it('credits Open-Meteo with a link (audit X1)', async () => {
    setup({ available: true, windows: [makeWindow()] })
    const link = await screen.findByRole('link', { name: 'Open-Meteo.com' })
    expect(link).toHaveAttribute('href', 'https://open-meteo.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/Weather data by/)).toBeInTheDocument()
  })

  it('says when there are no good hours', async () => {
    setup({ available: true, windows: [] })
    expect(await screen.findByText(/No good hours in the next 3 days/)).toBeInTheDocument()
  })

  it('says when the forecast is not available, without an error', async () => {
    setup({ available: false, windows: [] })
    expect(await screen.findByText(/forecast is not available/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open-Meteo.com' })).not.toBeInTheDocument()
  })

  it('handles a failed request like a missing forecast', async () => {
    mockApi({ 'GET /api/best-walk-time/': new Error('offline') })
    renderWithProviders(<BestTimeCard start={START} />)
    expect(await screen.findByText(/forecast is not available/)).toBeInTheDocument()
  })

  it('shows placeholders while loading', () => {
    mockApi({ 'GET /api/best-walk-time/': () => never() })
    renderWithProviders(<BestTimeCard start={START} />)
    expect(screen.getByRole('heading', { name: 'Best time for a walk' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('weatherCell', () => {
  it('rounds to 0.01 degrees like the backend', () => {
    expect(weatherCell(START)).toEqual({ lat: 54.34, lng: 18.62 })
  })
})

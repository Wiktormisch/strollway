import { render, screen } from '@testing-library/react'
import { makePlan } from '@/test/routePlan'
import { DetourCard } from './DetourCard'

function card() {
  return screen.getByRole('region')
}

describe('DetourCard', () => {
  it('big detour: states the stairs and the cost', () => {
    render(<DetourCard plan={makePlan()} avoidStairs />)
    expect(card()).toHaveTextContent(
      'The shortest route has 16 m of stairs. Stair-free route: +288 m, +4 min.',
    )
    expect(card()).toHaveTextContent('Route to follow: 420 m, 6 min.')
  })

  it('tiny detour: says the stairs cost almost nothing', () => {
    const plan = makePlan({
      detour_m: 6,
      extra_min: 0,
      baseline: { ...makePlan().baseline, distance_m: 827, stairs_m: 12.6 },
    })
    render(<DetourCard plan={plan} avoidStairs />)
    expect(
      screen.getByRole('heading', {
        name: 'You can avoid the stairs with almost no extra distance.',
      }),
    ).toBeInTheDocument()
    expect(card()).toHaveTextContent('+6 m')
  })

  it('no stair-free route: says so and highlights the stairs', () => {
    const plan = makePlan({ step_free_available: false, detour_m: null, extra_min: null })
    render(<DetourCard plan={plan} avoidStairs />)
    expect(
      screen.getByRole('heading', { name: 'There is no stair-free route between these points.' }),
    ).toBeInTheDocument()
    const stairs = screen.getByText('16 m of stairs')
    expect(stairs.tagName).toBe('STRONG')
  })

  it('no stairs: says the route is clear', () => {
    const plan = makePlan({ detour_m: 0, baseline: { ...makePlan().baseline, stairs_m: 0 } })
    render(<DetourCard plan={plan} avoidStairs />)
    expect(screen.getByRole('heading', { name: 'No stairs on this route.' })).toBeInTheDocument()
  })

  it('stairs not avoided: does not pretend we searched', () => {
    const plan = makePlan({ step_free_available: null, detour_m: null })
    render(<DetourCard plan={plan} avoidStairs={false} />)
    expect(screen.getByRole('heading', { name: 'Stairs are not avoided.' })).toBeInTheDocument()
  })

  it('mock line: says stairs are unknown', () => {
    const plan = makePlan({ source: 'mock', baseline: { ...makePlan().baseline, stairs_m: null } })
    render(<DetourCard plan={plan} avoidStairs />)
    expect(card()).toHaveTextContent('We do not know if it has stairs.')
  })
})

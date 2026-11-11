import { render, screen } from '@testing-library/react'
import { makePoi } from '@/test/routePlan'
import { PoiDetails } from './PoiDetails'

describe('PoiDetails', () => {
  it('shows the category label when the place has no name', () => {
    render(<PoiDetails poi={makePoi({ name: null, category: 'bench', at_min: 3 })} />)
    expect(screen.getByText('Bench')).toBeInTheDocument()
    expect(screen.getByText('about 3 min from start')).toBeInTheDocument()
  })

  it('falls back to a generic label for an unknown category', () => {
    render(<PoiDetails poi={makePoi({ name: null, category: 'mystery' })} />)
    expect(screen.getByText('Place')).toBeInTheDocument()
  })

  it('shows the name, the category and the opening hours', () => {
    render(
      <PoiDetails
        poi={makePoi({ name: 'Fake Cafe', category: 'cafe', opening_hours: 'Mo-Su 10:00-20:00' })}
      />,
    )
    expect(screen.getByText('Fake Cafe')).toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText('Opening hours: Mo-Su 10:00-20:00')).toBeInTheDocument()
  })

  it('shows accessibility tags only when they exist', () => {
    const { rerender } = render(<PoiDetails poi={makePoi()} />)
    expect(screen.queryByRole('list', { name: 'Accessibility' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Opening hours/)).not.toBeInTheDocument()

    rerender(<PoiDetails poi={makePoi({ accessibility: ['wheelchair'] })} />)
    expect(screen.getByRole('list', { name: 'Accessibility' })).toHaveTextContent(
      'Wheelchair access',
    )
  })
})

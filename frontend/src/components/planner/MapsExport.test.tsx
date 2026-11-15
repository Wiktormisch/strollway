import { render, screen } from '@testing-library/react'
import type { LatLngTuple } from '@/api/types'
import { MapsExport } from './MapsExport'

const LINE: LatLngTuple[] = [
  [54.1, 18.1],
  [54.2, 18.2],
  [54.3, 18.3],
]

describe('MapsExport', () => {
  it('links to Google Maps in a new tab and warns about stairs', () => {
    render(<MapsExport geometry={LINE} />)
    const link = screen.getByRole('link', { name: /Open in Google Maps/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir/?api=1'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(/may choose a way with stairs/)).toBeInTheDocument()
    expect(screen.queryByText(/only the first/)).not.toBeInTheDocument()
  })

  it('says when not all stops fit in the link', () => {
    const stops = Array.from({ length: 4 }, (_, i) => ({ lat: 54 + i / 10, lng: 18 }))
    render(<MapsExport geometry={LINE} stops={stops} />)
    expect(screen.getByText(/only the first 3 stops/)).toBeInTheDocument()
  })

  it('renders nothing with no line', () => {
    const { container } = render(<MapsExport geometry={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

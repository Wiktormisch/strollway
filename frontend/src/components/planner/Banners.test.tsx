import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ApiError } from '@/api/client'
import { DemoModeBanner, ErrorBanner } from './Banners'

describe('ErrorBanner', () => {
  it.each([
    [{ code: 'no_route' }, 'We could not find any walking route between these points.'],
    [{ code: 'no_routable_point' }, 'A point is too far from a path or a street.'],
  ])('has its own message for 422 %o', (body, text) => {
    render(<ErrorBanner error={new ApiError(422, 'x', body)} onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })

  it('offers a retry', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner error={new ApiError(0, 'down')} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No connection to the server.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('DemoModeBanner', () => {
  it('shows only for fixture and mock sources', () => {
    const { rerender, container } = render(<DemoModeBanner source="ors" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DemoModeBanner source="fixture" />)
    expect(screen.getByText(/Demo mode: a recorded route/)).toBeInTheDocument()
    rerender(<DemoModeBanner source="mock" />)
    expect(screen.getByText(/Demo mode: a straight line/)).toBeInTheDocument()
  })
})

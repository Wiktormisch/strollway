import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocateButton } from './LocateButton'

type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number }) => void

/** A fake navigator.geolocation that answers with `answer`. */
function mockGeolocation(answer: (ok: Success, fail: Failure) => void) {
  const getCurrentPosition = vi.fn(answer)
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition, watchPosition: vi.fn() },
  })
  return getCurrentPosition
}

describe('LocateButton', () => {
  beforeEach(() => {
    vi.stubGlobal('isSecureContext', true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // Remove the fake, so other tests see a browser with no geolocation.
    delete (navigator as { geolocation?: unknown }).geolocation
  })

  it('reads the position once and passes it on', async () => {
    const user = userEvent.setup()
    const get = mockGeolocation((ok) => ok({ coords: { latitude: 54.35, longitude: 18.65 } }))
    const onLocate = vi.fn()
    render(<LocateButton onLocate={onLocate} />)
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(get).toHaveBeenCalledTimes(1)
    expect(onLocate).toHaveBeenCalledWith({ lat: 54.35, lng: 18.65 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [1, 'Location access is blocked'],
    [2, 'Your location is not available'],
    [3, 'Finding your location took too long'],
  ])('shows a message for browser error %i', async (code, text) => {
    const user = userEvent.setup()
    mockGeolocation((_, fail) => fail({ code }))
    const onLocate = vi.fn()
    render(<LocateButton onLocate={onLocate} />)
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(onLocate).not.toHaveBeenCalled()
  })

  it('explains when the page is not on https', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('isSecureContext', false)
    const get = mockGeolocation(() => {})
    render(<LocateButton onLocate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(get).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('needs a secure (https) page')
  })
})

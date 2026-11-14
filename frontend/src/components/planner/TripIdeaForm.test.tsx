import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TripIdeaForm } from './TripIdeaForm'

const START = { lat: 54.3385, lng: 18.62 }

type FormProps = Parameters<typeof TripIdeaForm>[0]

/** The page owns the limit and "come back"; this harness plays the page in tests. */
function Harness(
  props: Omit<FormProps, 'minutes' | 'onMinutesChange' | 'roundTrip' | 'onRoundTripChange'>,
) {
  const [minutes, setMinutes] = useState(60)
  const [roundTrip, setRoundTrip] = useState(true)
  return (
    <TripIdeaForm
      {...props}
      minutes={minutes}
      onMinutesChange={setMinutes}
      roundTrip={roundTrip}
      onRoundTripChange={setRoundTrip}
    />
  )
}

function renderForm(overrides: Partial<FormProps> = {}) {
  const onSubmit = vi.fn()
  renderWithProviders(
    <Harness
      start={START}
      profiles={[]}
      profileId={null}
      planning={false}
      onProfileChange={vi.fn()}
      pace={3.5}
      maxPace={5.5}
      onPaceChange={vi.fn()}
      canSaveSettings={false}
      savingSettings={false}
      onSaveSettings={vi.fn()}
      onClearStart={vi.fn()}
      onUseMapCenter={vi.fn()}
      onDemoStart={vi.fn()}
      onLocate={vi.fn()}
      onSearchPick={vi.fn()}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return onSubmit
}

describe('TripIdeaForm', () => {
  it('sends the chosen limit, round trip, language and trimmed wishes', async () => {
    const onSubmit = renderForm({ profileId: 3 })
    const user = userEvent.setup()

    const minutes = screen.getByRole('spinbutton', { name: 'Time limit in minutes' })
    await user.clear(minutes)
    await user.type(minutes, '45')
    await user.click(screen.getByRole('switch', { name: 'Come back to the start' }))
    await user.type(screen.getByLabelText('Your wishes (optional)'), '  coffee, then pizza ')
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))

    expect(onSubmit).toHaveBeenCalledWith({
      start: START,
      profile_id: 3,
      max_minutes: 45,
      round_trip: false,
      language: 'en',
      wishes: 'coffee, then pizza',
      pace_kmh: 3.5,
    })
  })

  it('leaves profile_id out without a profile and uses 60 min by default', async () => {
    const onSubmit = renderForm()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Suggest a trip' }))
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('profile_id')
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ max_minutes: 60, round_trip: true })
  })

  it('keeps the slider and the number field in sync (audit idea 11)', async () => {
    renderForm()
    const user = userEvent.setup()
    const slider = screen.getByRole('slider', { name: 'Time limit, slider' })
    const field = screen.getByRole('spinbutton', { name: 'Time limit in minutes' })
    expect(slider).toHaveValue('60')

    // jsdom cannot drag a range input, so the test sends its change event.
    fireEvent.change(slider, { target: { value: '135' } })
    expect(field).toHaveValue(135)
    expect(slider).toHaveAttribute('aria-valuetext', '135 min')

    await user.clear(field)
    await user.type(field, '25')
    expect(slider).toHaveValue('25')
  })

  it('fixes a limit outside 15-180 when the field loses focus and before sending', async () => {
    const onSubmit = renderForm()
    const user = userEvent.setup()
    const field = screen.getByRole('spinbutton', { name: 'Time limit in minutes' })

    await user.clear(field)
    await user.type(field, '500')
    await user.tab()
    expect(field).toHaveValue(180)

    await user.clear(field)
    await user.type(field, '3')
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ max_minutes: 15 })

    await user.clear(field)
    await user.click(screen.getByRole('button', { name: 'Suggest a trip' }))
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ max_minutes: 60 })
  })

  it('keeps wishes at 200 characters, shows the counter and the privacy hint', () => {
    renderForm()
    const field = screen.getByLabelText('Your wishes (optional)')
    expect(field).toHaveAttribute('maxLength', '200')
    expect(field).toHaveAccessibleDescription(/Do not enter personal data/)

    // A paste can bypass maxLength in jsdom, so the handler cuts it too.
    fireEvent.change(field, { target: { value: 'a'.repeat(250) } })
    expect(field).toHaveValue('a'.repeat(200))
    expect(screen.getByText('200 / 200')).toHaveClass('text-destructive')
  })

  it('cannot be sent without a start or while planning', () => {
    renderForm({ start: null })
    expect(screen.getByRole('button', { name: 'Suggest a trip' })).toBeDisabled()
  })

  it('shows a clear in-progress state', () => {
    renderForm({ planning: true })
    expect(screen.getByRole('button', { name: 'Planning the trip…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/up to a minute/)
  })
})

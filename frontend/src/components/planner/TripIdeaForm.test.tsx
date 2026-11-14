import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { TripIdeaForm } from './TripIdeaForm'

const START = { lat: 54.3385, lng: 18.62 }

function renderForm(overrides: Partial<Parameters<typeof TripIdeaForm>[0]> = {}) {
  const onSubmit = vi.fn()
  renderWithProviders(
    <TripIdeaForm
      start={START}
      profiles={[]}
      profileId={null}
      planning={false}
      onProfileChange={vi.fn()}
      onClearStart={vi.fn()}
      onUseMapCenter={vi.fn()}
      onDemoStart={vi.fn()}
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

    await user.click(screen.getByRole('button', { name: '45 min' }))
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
    })
  })

  it('leaves profile_id out without a profile and uses 60 min by default', async () => {
    const onSubmit = renderForm()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Suggest a trip' }))
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('profile_id')
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ max_minutes: 60, round_trip: true })
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

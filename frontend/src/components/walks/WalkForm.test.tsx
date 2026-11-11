import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { makePoi } from '@/test/routePlan'
import { makeProfile } from '@/test/walks'
import { WalkForm } from './WalkForm'

const POIS = [
  makePoi({ poi_id: 'node/1', name: 'Fake Cafe', category: 'cafe', at_min: 3 }),
  makePoi({ poi_id: 'node/2', name: null, category: 'bench', at_min: 1 }),
]

function setup(serverErrors?: Record<string, string>) {
  const onSubmit = vi.fn()
  render(
    <WalkForm
      pois={POIS}
      profiles={[makeProfile()]}
      defaultProfileId={null}
      serverErrors={serverErrors}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  )
  return { onSubmit, user: userEvent.setup() }
}

describe('WalkForm', () => {
  it('requires a name', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save walk' }))

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Give the walk a name.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the name and the chosen places', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Name'), 'Fake Sunday')
    // A place without a name shows its category.
    await user.click(screen.getByRole('checkbox', { name: /Bench/ }))
    await user.click(screen.getByRole('button', { name: 'Save walk' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Fake Sunday',
      profileId: null,
      poiIds: ['node/2'],
    })
  })

  it('warns when the chosen profile is not the one the route was planned with', async () => {
    const { onSubmit, user } = setup()
    const hint = /The walking time was planned with another profile/
    expect(screen.queryByText(hint)).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Family profile' }))
    await user.click(await screen.findByRole('option', { name: 'Fake weekend' }))
    expect(screen.getByText(hint)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Fake Sunday')
    await user.click(screen.getByRole('button', { name: 'Save walk' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ profileId: 3 }))
  })

  it('shows a backend error next to the name', () => {
    setup({ name: 'Ensure this field has no more than 80 characters.' })
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Ensure this field has no more than 80 characters.',
    )
  })
})

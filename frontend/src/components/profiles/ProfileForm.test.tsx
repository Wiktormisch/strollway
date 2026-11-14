import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { makeProfile } from '@/test/walks'
import { ProfileForm } from './ProfileForm'

function setup(props: Partial<Parameters<typeof ProfileForm>[0]> = {}) {
  const onSubmit = vi.fn()
  render(<ProfileForm onSubmit={onSubmit} onCancel={() => {}} {...props} />)
  return { onSubmit, user: userEvent.setup() }
}

describe('ProfileForm', () => {
  it('rejects an age out of range', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Child's age"), '18')
    await user.click(screen.getByRole('button', { name: 'Add age' }))
    expect(screen.getByText('An age is a whole number from 0 to 17.')).toBeInTheDocument()
  })

  it('requires a name', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText("Child's age"), '3')
    await user.click(screen.getByRole('button', { name: 'Add age' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Give the profile a name.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the ages as numbers, after adding and removing chips', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Profile name'), '  Fake family ')
    for (const age of ['1', '4', '7']) {
      await user.type(screen.getByLabelText("Child's age"), `${age}{Enter}`)
    }
    await user.click(screen.getByRole('button', { name: 'Remove age 4' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Fake family',
      children_ages: [1, 7],
      wheels: 'stroller',
      pace: 'relaxed',
    })
  })

  it('saves a profile without children (audit idea 5)', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Profile name'), 'Fake adults')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ children_ages: [] }))
  })

  it('allows at most six children', async () => {
    const { user } = setup({ initial: makeProfile({ children_ages: [1, 2, 3, 4, 5, 6] }) })
    await user.type(screen.getByLabelText("Child's age"), '2')
    await user.click(screen.getByRole('button', { name: 'Add age' }))
    expect(screen.getByText('At most 6 children.')).toBeInTheDocument()
  })

  it('shows a backend error next to its field', () => {
    setup({ serverErrors: { children_ages: 'Give between 1 and 6 ages.' } })
    expect(screen.getByLabelText("Child's age")).toHaveAccessibleDescription(
      'Give between 1 and 6 ages.',
    )
  })
})

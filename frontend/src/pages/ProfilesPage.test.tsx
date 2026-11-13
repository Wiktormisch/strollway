import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/test/mockApi'
import { renderWithProviders } from '@/test/render'
import { ProfilesPage } from './ProfilesPage'

describe('ProfilesPage', () => {
  it('offers one action in the empty state that opens the form', async () => {
    mockApi({ 'GET /api/profiles/': () => Response.json([]) })
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPage />)

    await user.click(await screen.findByRole('button', { name: 'Add a profile' }))
    expect(screen.getByRole('dialog', { name: 'New profile' })).toBeInTheDocument()
  })
})

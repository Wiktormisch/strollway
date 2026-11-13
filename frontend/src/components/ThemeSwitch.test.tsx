import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ThemeSwitch } from './ThemeSwitch'

afterEach(() => document.documentElement.classList.remove('dark'))

it('switches between light and dark and remembers the choice', async () => {
  const user = userEvent.setup()
  renderWithProviders(<ThemeSwitch />)

  // jsdom has no matchMedia, so the start is light.
  await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
  expect(document.documentElement).toHaveClass('dark')
  expect(localStorage.getItem('strollway.theme')).toBe('dark')

  await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
  expect(document.documentElement).not.toHaveClass('dark')
})

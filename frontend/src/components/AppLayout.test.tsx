import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { AppLayout } from './AppLayout'

afterEach(() => document.documentElement.classList.remove('dark'))

function renderLayout(route = '/walks') {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="*" element={<p>page</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

it('marks the current page in the navigation', () => {
  renderLayout('/walks')
  const nav = screen.getByRole('navigation')
  expect(within(nav).getByRole('link', { name: 'My walks' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(within(nav).getByRole('link', { name: 'Planner' })).not.toHaveAttribute('aria-current')
})

it('opens the phone menu with the theme and language switches', async () => {
  const user = userEvent.setup()
  renderLayout()

  await user.click(screen.getByRole('button', { name: 'More options' }))
  const menu = screen.getByRole('dialog', { name: 'More options' })

  await user.click(within(menu).getByRole('button', { name: 'Switch to dark theme' }))
  expect(document.documentElement).toHaveClass('dark')
  expect(within(menu).getByRole('group', { name: 'Language' })).toBeInTheDocument()

  // Escape closes the menu and gives the focus back to its button.
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'More options' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus()
})

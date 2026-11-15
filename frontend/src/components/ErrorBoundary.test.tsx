import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/render'
import { AppLayout } from './AppLayout'

function Broken(): never {
  throw new Error('bad data')
}

it('shows a message and keeps the navigation when a page crashes', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/walks" element={<Broken />} />
        <Route path="/profiles" element={<p>profiles page</p>} />
      </Route>
    </Routes>,
    { route: '/walks' },
  )

  expect(screen.getByRole('alert')).toHaveTextContent('This page stopped working')
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()

  // Another page works again: the boundary resets on navigation.
  await userEvent.click(screen.getByRole('link', { name: 'Profiles' }))
  expect(screen.getByText('profiles page')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

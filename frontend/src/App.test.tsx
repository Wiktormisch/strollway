import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { renderWithProviders } from './test/render'

function mockHealth(result: Response | Error) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result.clone()),
  )
}

describe('App', () => {
  it('shows the backend status on the home page', async () => {
    mockHealth(Response.json({ status: 'ok' }))
    renderWithProviders(<App />)

    expect(screen.getByRole('heading', { name: 'Plan a walk' })).toBeInTheDocument()
    expect(await screen.findByText('The server works')).toBeInTheDocument()
  })

  it('shows an error when the backend is down', async () => {
    mockHealth(new TypeError('Failed to fetch'))
    renderWithProviders(<App />)

    expect(await screen.findByText(/The server does not answer/)).toBeInTheDocument()
  })

  it('navigates between pages', async () => {
    mockHealth(Response.json({ status: 'ok' }))
    renderWithProviders(<App />)

    await userEvent.click(screen.getByRole('link', { name: 'My walks' }))
    expect(screen.getByRole('heading', { name: 'My walks' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Profiles' }))
    expect(screen.getByRole('heading', { name: 'Child profiles' })).toBeInTheDocument()
  })

  it('renders the walk detail route', () => {
    renderWithProviders(<App />, { route: '/walks/7' })
    expect(screen.getByRole('heading', { name: 'Walk 7' })).toBeInTheDocument()
  })

  it('renders a not-found page for unknown paths', () => {
    renderWithProviders(<App />, { route: '/nope' })
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

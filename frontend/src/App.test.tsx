import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { mockApi } from './test/mockApi'
import { renderWithProviders } from './test/render'

function mockHealth(health: Response | Error) {
  mockApi({
    'GET /api/health/': health,
    'GET /api/profiles/': [],
    'GET /api/walks/': [],
  })
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

  it('renders the walk detail route', async () => {
    mockHealth(Response.json({ status: 'ok' }))
    renderWithProviders(<App />, { route: '/walks/7' })
    // The fetch mock has no walk 7, so the page shows its not-found state.
    expect(await screen.findByText('Walk not found.')).toBeInTheDocument()
  })

  it('renders a not-found page for unknown paths', () => {
    renderWithProviders(<App />, { route: '/nope' })
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

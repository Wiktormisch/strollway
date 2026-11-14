import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { HowItWorksPage } from './HowItWorksPage'

it('explains the app and credits every data source with a link (audit X1)', () => {
  renderWithProviders(<HowItWorksPage />)

  expect(screen.getByRole('heading', { level: 1, name: 'How it works' })).toBeInTheDocument()
  // The Tricity note and the keyboard note (audit U3) have their own sections.
  expect(screen.getByRole('heading', { name: 'Where it works' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Without a mouse' })).toBeInTheDocument()

  const credits: [string, string][] = [
    ['© openrouteservice by HeiGIT | Data from OpenStreetMap', 'https://openrouteservice.org'],
    ['© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright'],
    ['Weather data by Open-Meteo.com', 'https://open-meteo.com'],
  ]
  for (const [name, href] of credits) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
  }
})

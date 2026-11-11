import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '@/i18n'

// Leaflet does not render in jsdom; the map is thin and its logic is tested elsewhere.
vi.mock('@/components/planner/MapView', async () => ({
  MapView: (await import('./FakeMapView')).FakeMapView,
}))

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
})

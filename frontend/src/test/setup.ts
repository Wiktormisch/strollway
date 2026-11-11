import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '@/i18n'

// Leaflet does not render in jsdom; the map is thin and its logic is tested elsewhere.
vi.mock('@/components/planner/MapView', async () => ({
  MapView: (await import('./FakeMapView')).FakeMapView,
}))
vi.mock('@/components/walks/WalkMap', () => ({
  WalkMap: (props: { stops: unknown[] }) => `walk map: ${props.stops.length} stops`,
}))

// Radix Select uses pointer capture and scrollIntoView, which jsdom does not have.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
})

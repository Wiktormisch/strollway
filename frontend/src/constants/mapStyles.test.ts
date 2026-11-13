import { expect, it } from 'vitest'
import { mapLineStyles } from './mapStyles'

const colors = {
  route: '#111111',
  'muted-foreground': '#222222',
  stairs: '#333333',
  card: '#ffffff',
}

it('draws a glow and a wider casing in the card colour under the route', () => {
  const lines = mapLineStyles(colors)
  expect(lines.route.color).toBe('#111111')
  expect(lines.routeCasing.color).toBe('#ffffff')
  expect(lines.routeCasing.weight).toBeGreaterThan(lines.route.weight)
  expect(lines.stairsCasing.weight).toBeGreaterThan(lines.stairs.weight)
  expect(lines.routeGlow.color).toBe('#111111')
  expect(lines.routeGlow.weight).toBeGreaterThan(lines.routeCasing.weight)
  expect(lines.baseline.dashArray).toBeDefined()
})

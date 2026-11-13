import { vi } from 'vitest'
import { currentTheme, initTheme, setTheme } from './theme'

function fakeSystem(dark: boolean) {
  const listeners: (() => void)[] = []
  const media = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  }
  vi.stubGlobal('matchMedia', () => media)
  return { media, fire: () => listeners.forEach((listener) => listener()) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

it('follows the system theme and its changes while nothing is saved', () => {
  const { media, fire } = fakeSystem(true)
  initTheme()
  expect(document.documentElement).toHaveClass('dark')

  media.matches = false
  fire()
  expect(document.documentElement).not.toHaveClass('dark')
})

it('a saved choice wins over the system, also after a system change', () => {
  const { media, fire } = fakeSystem(true)
  setTheme('light')
  initTheme()
  expect(currentTheme()).toBe('light')
  expect(document.documentElement).not.toHaveClass('dark')

  media.matches = true
  fire()
  expect(document.documentElement).not.toHaveClass('dark')
})

// Light or dark theme. index.css has the dark colours under `.dark`; this switches that class
// on <html>. A choice made with the header button is saved; without one, the system decides.
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'strollway.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null // localStorage can be blocked (private mode).
  }
}

function systemTheme(): Theme {
  if (typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return savedTheme() ?? systemTheme()
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Called once at start-up. Follows later system changes until the user picks a theme. */
export function initTheme(): void {
  apply(currentTheme())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (savedTheme() === null) apply(systemTheme())
  })
}

export function setTheme(theme: Theme): void {
  apply(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not critical: the choice just will not survive a reload.
  }
}

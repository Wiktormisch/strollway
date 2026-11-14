// Leaflet draws lines as SVG with a colour attribute, and an attribute cannot use var(--brand).
// So the map reads the theme colours from the CSS variables in index.css at runtime.
import { useEffect, useState } from 'react'

/** Light theme values from docs/DESIGN.md, used when a variable is missing (e.g. in tests). */
const FALLBACK = {
  route: '#0096c7',
  'muted-foreground': '#5f6b73',
  stairs: '#c2662d',
  card: '#ffffff',
} as const

export type MapColorName = keyof typeof FALLBACK
export type MapColors = Record<MapColorName, string>

/** Reads one CSS variable from <html>, or returns the fallback when it is not set. */
export function readCssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return value || fallback
}

export function readMapColors(): MapColors {
  const entries = Object.entries(FALLBACK).map(([name, fallback]) => [
    name,
    readCssColor(name, fallback),
  ])
  return Object.fromEntries(entries) as MapColors
}

/**
 * The map colours for the current theme. lib/theme.ts switches the `dark` class on <html>;
 * a MutationObserver sees that change, whatever caused it (button or system setting).
 * It also watches inline styles, so variables set on <html> by code are picked up too.
 */
export function useMapColors(): MapColors {
  const [colors, setColors] = useState(readMapColors)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readMapColors()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    return () => observer.disconnect()
  }, [])
  return colors
}

// Leaflet marker icons shared by the planner map and the saved walk map.
// Icons are HTML (divIcon), so no PNG files are needed. That also avoids the
// known broken default marker image in Vite builds. Styles: `.sw-*-icon` in index.css.
// The inner HTML is aria-hidden, so a screen reader names the marker by its `title`
// ("Stop 1: playground"), not by the letter or number drawn inside it (audit U5).
import type { ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { divIcon, type DivIcon } from 'leaflet'
import { categoryColor, categoryIcon, POI_CATEGORIES } from '@/constants/poiCategories'

/**
 * Turns small JSX icons into SVG text for Leaflet divIcons.
 *
 * Not `react-dom/server`: it put the whole server renderer into the browser bundle (about
 * 20 % of it, audit F1). Instead each icon is rendered once into a detached element with
 * the client renderer the app already has, and its `innerHTML` is read.
 *
 * This runs when the module loads, not when a map renders: `flushSync` cannot flush while
 * React is in the middle of another render, so building icons lazily in render would give
 * empty text.
 */
function renderToSvgText(element: ReactElement): string {
  const container = document.createElement('div')
  const root = createRoot(container)
  flushSync(() => root.render(element))
  const text = container.innerHTML
  root.unmount()
  return text
}

/** The category icons as SVG text. Unknown categories use the fallback icon (`other`). */
const CATEGORY_SVG = new Map(
  [...POI_CATEGORIES, 'other'].map((category) => {
    const Icon = categoryIcon(category)
    return [category, renderToSvgText(<Icon size={16} strokeWidth={2.25} aria-hidden />)]
  }),
)

const FLAG_SVG = renderToSvgText(flagSvg())

const iconCache = new Map<string, DivIcon>()

function cached(key: string, build: () => DivIcon): DivIcon {
  const found = iconCache.get(key)
  if (found) return found
  const icon = build()
  iconCache.set(key, icon)
  return icon
}

/** A place: white 28 px circle with a sage outline and the coloured category icon. */
export function poiIcon(category: string): DivIcon {
  return cached(`poi:${category}`, () => {
    const svg = CATEGORY_SVG.get(category) ?? CATEGORY_SVG.get('other')
    return divIcon({
      html: `<span aria-hidden="true" class="sw-poi-icon" style="color:${categoryColor(category)}">${svg}</span>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    })
  })
}

/** A, B or another short text on a 36 px coloured circle. */
export function letterIcon(letter: string, color: string): DivIcon {
  return cached(`letter:${letter}:${color}`, () =>
    divIcon({
      html: `<span aria-hidden="true" class="sw-point-icon" style="background:${color}">${letter}</span>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
  )
}

/** A round trip: start and finish at the same point. */
export function finishIcon(): DivIcon {
  return cached('finish', () => {
    return divIcon({
      html: `<span aria-hidden="true" class="sw-point-icon" style="background:var(--brand)">${FLAG_SVG}</span>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
  })
}

/**
 * A saved stop: its number on a 32 px circle with an outline in the category colour.
 * The number keeps the order visible; the colour matches the icon in the stop list.
 */
export function stopIcon(number: number, category: string): DivIcon {
  return cached(`stop:${number}:${category}`, () =>
    divIcon({
      html: `<span aria-hidden="true" class="sw-stop-icon" style="border-color:${categoryColor(category)}">${number}</span>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
  )
}

/** A small chequered flag (plain JSX, not a component: this file exports only helpers). */
function flagSvg(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 1v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="2" width="10" height="7" fill="currentColor" />
      <path
        d="M4 2h2.5v1.75H4zM9 2h2.5v1.75H9zM6.5 3.75H9V5.5H6.5zM11.5 3.75H14V5.5h-2.5zM4 5.5h2.5v1.75H4zM9 5.5h2.5v1.75H9zM6.5 7.25H9V9H6.5zM11.5 7.25H14V9h-2.5z"
        style={{ fill: 'var(--primary)' }}
      />
    </svg>
  )
}

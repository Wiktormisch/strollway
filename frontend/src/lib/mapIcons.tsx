// Leaflet marker icons shared by the planner map and the saved walk map.
// Icons are HTML (divIcon), so no PNG files are needed. That also avoids the
// known broken default marker image in Vite builds. Styles: `.sw-*-icon` in index.css.
import { renderToStaticMarkup } from 'react-dom/server'
import { divIcon, type DivIcon } from 'leaflet'
import { categoryColor, categoryIcon } from '@/constants/poiCategories'

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
    const Icon = categoryIcon(category)
    const svg = renderToStaticMarkup(<Icon size={16} strokeWidth={2.25} aria-hidden />)
    return divIcon({
      html: `<span class="sw-poi-icon" style="color:${categoryColor(category)}">${svg}</span>`,
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
      html: `<span class="sw-point-icon" style="background:${color}">${letter}</span>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
  )
}

/** A round trip: start and finish at the same point. */
export function finishIcon(): DivIcon {
  return cached('finish', () => {
    const svg = renderToStaticMarkup(flagSvg())
    return divIcon({
      html: `<span class="sw-point-icon" style="background:var(--brand)">${svg}</span>`,
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
      html: `<span class="sw-stop-icon" style="border-color:${categoryColor(category)}">${number}</span>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
  )
}

/** A small chequered flag (plain JSX, not a component: this file exports only helpers). */
function flagSvg() {
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

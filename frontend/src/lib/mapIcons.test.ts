import { describe, expect, it } from 'vitest'
import { finishIcon, letterIcon, poiIcon, stopIcon } from './mapIcons'

const html = (icon: ReturnType<typeof stopIcon>) => String(icon.options.html)

describe('map icons', () => {
  it('draws a saved stop as its number with a category-coloured outline', () => {
    const icon = stopIcon(2, 'playground')
    expect(html(icon)).toContain('>2<')
    expect(html(icon)).toContain('border-color:var(--cat-play)')
    expect(icon.options.iconSize).toEqual([32, 32])
  })

  it('uses the muted colour for unknown categories, never the stairs colour', () => {
    expect(html(stopIcon(1, 'other'))).toContain('var(--muted-foreground)')
    expect(html(stopIcon(1, 'other'))).not.toContain('stairs')
  })

  it('reuses the same icon object for the same input', () => {
    expect(letterIcon('A', 'var(--brand)')).toBe(letterIcon('A', 'var(--brand)'))
    expect(poiIcon('cafe')).toBe(poiIcon('cafe'))
    expect(stopIcon(1, 'cafe')).not.toBe(stopIcon(2, 'cafe'))
  })

  it('draws a place as the category SVG in the category colour', () => {
    const markup = html(poiIcon('cafe'))
    expect(markup).toContain('style="color:var(--cat-')
    expect(markup).toMatch(/<svg[^>]*width="16"[^>]*>.*<path/)
    expect(markup).toContain('stroke-width="2.25"')
  })

  it('draws an unknown category with the fallback icon, not empty', () => {
    expect(html(poiIcon('unknown-kind'))).toMatch(/<svg.*<\/svg>/)
  })

  it('draws the finish flag as SVG', () => {
    expect(html(finishIcon())).toMatch(/<svg[^>]*viewBox="0 0 16 16".*<rect/)
  })
})

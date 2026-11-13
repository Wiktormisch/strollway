import { describe, expect, it } from 'vitest'
import { categoryColor, POI_CATEGORIES } from './poiCategories'

describe('categoryColor', () => {
  it('groups categories into a few colour tokens', () => {
    expect(categoryColor('playground')).toBe('var(--cat-play)')
    expect(categoryColor('cafe')).toBe('var(--cat-food)')
    expect(categoryColor('toilets')).toBe('var(--cat-care)')
    expect(categoryColor('park')).toBe('var(--sage-500)')
  })

  it('uses the muted colour for museums and unknown categories', () => {
    expect(categoryColor('museum')).toBe('var(--muted-foreground)')
    expect(categoryColor('volcano')).toBe('var(--muted-foreground)')
  })

  it('never uses the stairs colour, which is kept for stairs', () => {
    for (const category of POI_CATEGORIES) {
      expect(categoryColor(category)).not.toContain('stairs')
    }
  })
})

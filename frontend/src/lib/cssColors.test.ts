import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { readCssColor, readMapColors, useMapColors } from './cssColors'

const root = document.documentElement

afterEach(() => {
  root.removeAttribute('style')
  root.classList.remove('dark')
})

describe('readCssColor', () => {
  it('reads a CSS variable from <html>', () => {
    root.style.setProperty('--brand', ' #123456 ')
    expect(readCssColor('brand', '#000000')).toBe('#123456')
  })

  it('falls back when the variable is missing', () => {
    expect(readCssColor('brand', '#2d6a4f')).toBe('#2d6a4f')
  })
})

describe('readMapColors', () => {
  it('uses the light theme values when nothing is set', () => {
    expect(readMapColors()).toEqual({
      route: '#0096c7',
      'muted-foreground': '#5f6b73',
      stairs: '#c2662d',
      card: '#ffffff',
    })
  })
})

describe('useMapColors', () => {
  it('reads new colours when the theme class changes', async () => {
    root.style.setProperty('--route', '#0096c7')
    const { result } = renderHook(() => useMapColors())
    expect(result.current.route).toBe('#0096c7')

    // In the app, index.css changes the variables under .dark; here we do it by hand.
    await act(async () => {
      root.style.setProperty('--route', '#48cae4')
      root.classList.add('dark')
      await Promise.resolve() // MutationObserver callbacks run as a microtask.
    })
    expect(result.current.route).toBe('#48cae4')
  })
})

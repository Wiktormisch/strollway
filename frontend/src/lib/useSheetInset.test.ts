import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSheetInset } from './useSheetInset'

function sheet(height: number) {
  const element = document.createElement('section')
  Object.defineProperty(element, 'offsetHeight', { value: height })
  return { current: element }
}

function stubPhone(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSheetInset', () => {
  it('returns the sheet height on a phone', () => {
    stubPhone(true)
    const { result } = renderHook(() => useSheetInset(sheet(420)))
    expect(result.current).toBe(420)
  })

  it('returns 0 on wider screens, where the panel is beside the map', () => {
    stubPhone(false)
    const { result } = renderHook(() => useSheetInset(sheet(420)))
    expect(result.current).toBe(0)
  })

  it('returns 0 when matchMedia is missing', () => {
    const { result } = renderHook(() => useSheetInset(sheet(420)))
    expect(result.current).toBe(0)
  })
})

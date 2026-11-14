import { useEffect, useState, type RefObject } from 'react'

/** The same break point as Tailwind `md`: below it the planner panel is a bottom sheet. */
export const PHONE_QUERY = '(max-width: 767.98px)'

/**
 * How many px of the map the bottom sheet covers: its height on phones, 0 on wider screens
 * (there the panel is beside the map). ResizeObserver follows the sheet when it opens,
 * closes or its content grows.
 */
export function useSheetInset(ref: RefObject<HTMLElement | null>): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof window.matchMedia !== 'function') return
    const phone = window.matchMedia(PHONE_QUERY)
    const measure = () => setInset(phone.matches ? element.offsetHeight : 0)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    phone.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      phone.removeEventListener('change', measure)
    }
  }, [ref])
  return inset
}

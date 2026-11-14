import { useEffect, useState } from 'react'

/** The value, but only after it has not changed for `delayMs` (e.g. while the user types). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    // A new value before the delay ends cancels the old timer, so only the last one counts.
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

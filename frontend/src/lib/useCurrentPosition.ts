// One-time browser position for "Use my location" (audit idea 8, D9).
// getCurrentPosition, never watchPosition: live tracking would be navigation (PLAN.md section C).
import { useState } from 'react'
import type { LatLng } from '@/api/types'

export type PositionError = 'unsupported' | 'denied' | 'unavailable' | 'timeout'

/** Browser error codes (GeolocationPositionError) to our names. */
const ERRORS: Record<number, PositionError> = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }

export function useCurrentPosition(onPosition: (point: LatLng) => void) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<PositionError | null>(null)

  function locate() {
    setError(null)
    // Missing on old browsers and on plain http (not localhost): browsers allow it only on https.
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setError('unsupported')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        onPosition({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      (failure) => {
        setLocating(false)
        setError(ERRORS[failure.code] ?? 'unavailable')
      },
      // A walk start does not need GPS precision; a 1-minute-old position is fine.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return { locate, locating, error }
}

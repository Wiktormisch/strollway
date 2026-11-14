/** "420 m" below 1 km, "1.2 km" (or "1,2 km" in Polish) above. */
export function formatDistance(metres: number, locale = 'en'): string {
  const rounded = Math.round(metres)
  if (rounded < 1000) return `${rounded} m`
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rounded / 1000)
  return `${km} km`
}

/** "3.5 km/h" (or "3,5 km/h" in Polish). */
export function formatKmh(kmh: number, locale = 'en'): string {
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kmh)
  return `${value} km/h`
}

/** "Jan 1, 2026" in English, "1 sty 2026" in Polish, in the user's time zone. */
export function formatDate(iso: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "6 min", "1 h", "1 h 05 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`
}

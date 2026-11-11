/** "420 m" below 1 km, "1.2 km" (or "1,2 km" in Polish) above. */
export function formatDistance(metres: number, locale = 'en'): string {
  const rounded = Math.round(metres)
  if (rounded < 1000) return `${rounded} m`
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rounded / 1000)
  return `${km} km`
}

/** "6 min", "1 h", "1 h 05 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`
}

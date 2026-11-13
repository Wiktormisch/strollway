import { useTranslation } from 'react-i18next'
import { CloudSun, Lightbulb, SearchX } from 'lucide-react'
import type { TripIdea, Weather } from '@/api/types'

/** The texts under the timeline: summary, wishes we could not meet and tips. */
export function TripSummary({ trip }: { trip: TripIdea }) {
  const { t } = useTranslation()
  const unmet = [
    ...trip.unmet_wishes,
    ...trip.dropped_stops.map((stop) =>
      t('trip.summary.dropped', { name: stop.name ?? t('poi.categories.other') }),
    ),
  ]

  return (
    <div className="space-y-3 text-sm">
      <p>{trip.summary}</p>

      {unmet.length > 0 && (
        <section aria-labelledby="unmet-title" className="rounded-lg border border-dashed p-3">
          <h3 id="unmet-title" className="mb-1 flex items-center gap-1.5 font-medium">
            <SearchX aria-hidden className="size-4" />
            {t('trip.summary.unmet')}
          </h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {unmet.map((wish, index) => (
              <li key={index}>{wish}</li>
            ))}
          </ul>
        </section>
      )}

      {trip.tips.length > 0 && (
        <section aria-labelledby="tips-title">
          <h3 id="tips-title" className="mb-1 flex items-center gap-1.5 font-medium">
            <Lightbulb aria-hidden className="size-4" />
            {t('trip.summary.tips')}
          </h3>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {trip.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** A full-width line above the stops: the weather matters before the plan is read. */
export function WeatherChip({ weather }: { weather: Weather | null }) {
  const { t } = useTranslation()
  if (!weather) return null
  const parts: string[] = []
  if (weather.temp_c !== null) {
    parts.push(t('trip.weather.temp', { value: Math.round(weather.temp_c) }))
  }
  if (weather.precip_probability !== null) {
    parts.push(t('trip.weather.rain', { value: weather.precip_probability }))
  }
  if (weather.wind_kmh !== null) {
    parts.push(t('trip.weather.wind', { value: Math.round(weather.wind_kmh) }))
  }
  if (parts.length === 0) return null
  return (
    // Centred; each value is its own item, so `gap-x-3` spaces them and they wrap on narrow screens.
    <p className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-muted px-3 py-2 text-sm">
      <CloudSun aria-hidden className="size-4 shrink-0 text-sage-500" />
      <span className="sr-only">{t('trip.weather.label')}: </span>
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-3">
          {index > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
    </p>
  )
}

import { useTranslation } from 'react-i18next'
import { CloudSun, Lightbulb, SearchX } from 'lucide-react'
import type { TripIdea, Weather } from '@/api/types'

/** The texts around the timeline: summary, weather, wishes we could not meet and tips. */
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
      <div className="flex flex-wrap items-start gap-2">
        <p className="flex-1">{trip.summary}</p>
        <WeatherChip weather={trip.weather} />
      </div>

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

function WeatherChip({ weather }: { weather: Weather | null }) {
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
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
      <CloudSun aria-hidden className="size-3.5" />
      <span className="sr-only">{t('trip.weather.label')}: </span>
      {parts.join(' · ')}
    </span>
  )
}

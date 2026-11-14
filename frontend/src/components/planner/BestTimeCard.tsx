import { useTranslation } from 'react-i18next'
import { Cloud, CloudSun, Droplets, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import type { BestTimeWindow, LatLng } from '@/api/types'
import { useBestWalkTime } from '@/api/weather'
import { ListSkeleton } from '@/components/common/States'
import { cn } from '@/lib/utils'

const LABEL_ICON: Record<BestTimeWindow['label'], LucideIcon> = {
  great: Sun,
  good: CloudSun,
  ok: Cloud,
}

/** "Best time for a walk" for the chosen start (audit idea 2). Hidden without a start. */
export function BestTimeCard({ start }: { start: LatLng | null }) {
  const { t } = useTranslation()
  const query = useBestWalkTime(start)
  if (!start) return null

  const windows = query.data?.windows ?? []
  const unavailable = query.isError || query.data?.available === false

  return (
    <section aria-labelledby="best-time-title" className="space-y-3 rounded-2xl border bg-card p-4">
      <h3 id="best-time-title" className="flex items-center gap-1.5 text-sm font-semibold">
        <Sun aria-hidden className="size-4 shrink-0 text-sage-500" />
        {t('planner.bestTime.title')}
      </h3>
      <div
        aria-live="polite"
        aria-busy={query.isFetching}
        // Old windows while the new start loads: dimmed, so they do not look like the answer.
        className={cn('transition-opacity duration-200', query.isPlaceholderData && 'opacity-60')}
      >
        {query.isPending ? (
          <ListSkeleton count={2} itemClassName="h-14" />
        ) : unavailable ? (
          <p className="text-sm text-muted-foreground">{t('planner.bestTime.unavailable')}</p>
        ) : windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('planner.bestTime.none')}</p>
        ) : (
          // A short fade-in once, when the answer arrives; no motion when the user turns it off.
          <ol className="space-y-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
            {windows.map((window) => (
              <WindowRow key={`${window.date}-${window.start}`} window={window} />
            ))}
          </ol>
        )}
      </div>
      {!unavailable && <WeatherCredit />}
    </section>
  )
}

function WindowRow({ window }: { window: BestTimeWindow }) {
  const { t } = useTranslation()
  const day = useDayName(window)
  const Icon = LABEL_ICON[window.label]
  const facts: { icon: LucideIcon; text: string }[] = []
  if (window.temp_c !== null) {
    facts.push({
      icon: Thermometer,
      text: t('trip.weather.temp', { value: Math.round(window.temp_c) }),
    })
  }
  if (window.precip_probability !== null) {
    facts.push({
      icon: Droplets,
      text: t('trip.weather.rain', { value: window.precip_probability }),
    })
  }
  if (window.wind_kmh !== null) {
    facts.push({ icon: Wind, text: t('trip.weather.wind', { value: Math.round(window.wind_kmh) }) })
  }

  return (
    <li className="rounded-xl bg-muted px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold tabular-nums">
          {day}, {window.start}–{window.end}
        </p>
        <p
          className={cn(
            'flex items-center gap-1 text-sm font-medium',
            window.label === 'ok' ? 'text-muted-foreground' : 'text-brand',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {t(`planner.bestTime.labels.${window.label}`)}
        </p>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {facts.map(({ icon: FactIcon, text }) => (
          <li key={text} className="flex items-center gap-1">
            <FactIcon aria-hidden className="size-4 shrink-0" />
            {text}
          </li>
        ))}
      </ul>
    </li>
  )
}

/** "Today", "Tomorrow" or the weekday in the app language. */
function useDayName(window: BestTimeWindow) {
  const { t, i18n } = useTranslation()
  if (window.day_offset === 0) return t('planner.bestTime.today')
  if (window.day_offset === 1) return t('planner.bestTime.tomorrow')
  // Noon local time, so no time zone can move the date to another day.
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(
    new Date(`${window.date}T12:00:00`),
  )
  return weekday.charAt(0).toLocaleUpperCase(i18n.language) + weekday.slice(1)
}

/** Open-Meteo data is CC BY 4.0: the app must credit it with a link (audit X1). */
export function WeatherCredit({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {t('planner.bestTime.credit')}{' '}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Open-Meteo.com
      </a>
    </p>
  )
}

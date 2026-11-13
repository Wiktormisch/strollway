import { useTranslation } from 'react-i18next'
import { Bot, Clock, ListChecks, TriangleAlert, X } from 'lucide-react'
import type { TripEngine, TripStop } from '@/api/types'
import { Button } from '@/components/ui/button'
import { categoryIcon } from '@/constants/poiCategories'
import { formatDuration } from '@/lib/format'
import { usePoiLabel } from '@/lib/poiLabel'
import { isLlmEngine, type TripTotals } from '@/lib/trip'
import { cn } from '@/lib/utils'

interface StopsTimelineProps {
  engine: TripEngine
  stops: TripStop[]
  totals: TripTotals
  /** Missing = read only. The last stop cannot be removed: a walk needs at least one. */
  onRemove?: (poiId: string) => void
}

/** The engine label, the time against the limit and the numbered stops of a trip idea. */
export function StopsTimeline({ engine, stops, totals, onRemove }: StopsTimelineProps) {
  const { t } = useTranslation()
  const label = usePoiLabel()
  const llm = isLlmEngine(engine)
  const EngineIcon = llm ? Bot : ListChecks

  return (
    <section aria-labelledby="timeline-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="timeline-title" className="text-base font-semibold">
          {t('trip.timeline.title')}
        </h2>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
            llm
              ? 'border-violet-300 bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100'
              : 'border-slate-300 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100',
          )}
        >
          <EngineIcon aria-hidden className="size-3.5" />
          {t(llm ? 'trip.engine.ai' : 'trip.engine.rules')}
        </span>
      </div>

      <div
        className={cn(
          'rounded-lg border p-3 text-sm',
          totals.overLimit &&
            'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
        )}
      >
        <p className="flex items-center gap-2 font-medium">
          <Clock aria-hidden className="size-4 shrink-0" />
          {t('trip.totals.total', {
            total: formatDuration(totals.totalMin),
            max: formatDuration(totals.maxMinutes),
          })}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {t('trip.totals.split', {
            walking: formatDuration(totals.walkingMin),
            stops: formatDuration(totals.stopsMin),
          })}
        </p>
        {totals.overLimit && (
          <p role="alert" className="mt-2 flex gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('trip.totals.overLimit')}
          </p>
        )}
        {totals.edited && <p className="mt-2 text-xs opacity-80">{t('trip.totals.edited')}</p>}
      </div>

      <ol className="space-y-2">
        {stops.map((stop, index) => {
          const Icon = categoryIcon(stop.category)
          const name = label(stop)
          return (
            <li key={stop.poi_id} className="flex gap-3 rounded-lg border p-3">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-semibold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('trip.timeline.arrive', { minutes: stop.arrive_min })} ·{' '}
                  {t('trip.timeline.stay', { minutes: stop.planned_minutes })}
                </p>
                {stop.reason && <p>{stop.reason}</p>}
              </div>
              {onRemove && stops.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('trip.timeline.remove', { name })}
                  title={t('trip.timeline.remove', { name })}
                  onClick={() => onRemove(stop.poi_id)}
                >
                  <X aria-hidden />
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

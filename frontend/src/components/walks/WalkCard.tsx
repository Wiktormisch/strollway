import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, Star } from 'lucide-react'
import type { WalkListItem, WalkStatus } from '@/api/types'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatList, type Stat } from '@/components/common/StatList'

export function WalkCard({ walk }: { walk: WalkListItem }) {
  const { t, i18n } = useTranslation()
  const stats: Stat[] = [
    {
      kind: 'distance',
      label: t('walks.card.distance'),
      value: formatDistance(walk.distance_m, i18n.language),
    },
    { kind: 'time', label: t('walks.card.duration'), value: formatDuration(walk.duration_min) },
    {
      kind: 'kcal',
      label: t('walks.card.kcal'),
      value: t('planner.detour.kcalValue', { kcal: walk.kcal }),
    },
    {
      kind: 'stairsAvoided',
      label: t('walks.card.stairsAvoided'),
      value: formatDistance(walk.stairs_avoided_m, i18n.language),
    },
    { kind: 'places', label: t('walks.card.stops'), value: String(walk.stops_count) },
  ]
  return (
    // The whole card is clickable, but only the name is a link: its ::after layer covers the
    // card ("stretched link"). The heading stays a heading for screen readers.
    <Card className="relative h-full transition-colors hover:border-brand/50 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold break-words">
              <Link
                to={`/walks/${walk.id}`}
                className="outline-none after:absolute after:inset-0 after:rounded-2xl"
              >
                {walk.name}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">
              <time dateTime={walk.created_at}>
                {t('walks.card.saved', { date: formatDate(walk.created_at, i18n.language) })}
              </time>
            </p>
          </div>
          <StatusChip status={walk.status} />
        </div>

        <StatList stats={stats} size="md" className="border-t pt-4" />

        {walk.status === 'done' && walk.rating !== null && (
          <p className="mt-auto flex items-center gap-1.5 text-sm font-medium">
            <Star aria-hidden className="size-4 fill-sage-500 text-sage-500" />
            {t('walks.rating.value', { value: walk.rating })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Done = success colours (`brand` on `brand-soft`), planned = info colours (on `muted`). */
export function StatusChip({ status, className }: { status: WalkStatus; className?: string }) {
  const { t } = useTranslation()
  const Icon = status === 'done' ? Check : CalendarClock
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-foreground',
        status === 'done' ? 'bg-brand-soft' : 'bg-muted',
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-3.5', status === 'done' && 'text-brand')} />
      {t(`walks.status.${status}`)}
    </span>
  )
}

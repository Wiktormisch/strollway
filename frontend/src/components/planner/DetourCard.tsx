import { Trans, useTranslation } from 'react-i18next'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { RouteComparison } from '@/api/types'
import { formatDistance, formatDuration } from '@/lib/format'
import { detourCase, type DetourCase } from '@/lib/planner'
import { cn } from '@/lib/utils'
import { StatList, type Stat } from '@/components/common/StatList'

const TONE: Record<DetourCase, 'good' | 'info' | 'warn'> = {
  bigDetour: 'info',
  tinyDetour: 'good',
  noStairs: 'good',
  noStepFree: 'warn',
  checkFailed: 'warn',
  notSearched: 'info',
  unknownStairs: 'info',
}

const TONE_STYLE = {
  // Navy text reads best on the soft green; the icon carries the brand colour.
  // `[&>svg]:` styles the direct svg child.
  good: 'border-brand/30 bg-brand-soft text-foreground',
  info: 'border-border bg-muted text-foreground',
  warn: 'border-stairs/40 bg-stairs/10 text-foreground',
}

// The small tag carries the status colour; the long text stays navy for easy reading.
const TAG_STYLE = {
  good: 'text-brand',
  info: 'text-muted-foreground',
  warn: 'text-stairs-text',
}

const TONE_ICON = { good: CircleCheck, info: Info, warn: TriangleAlert }

interface DetourCardProps {
  plan: RouteComparison
  /** What the user asked for; tells "not searched" from "the check failed". */
  avoidStairs: boolean
  /** Places along the route or stops of the trip; the stat is hidden without it. */
  places?: number
}

/** The twist of the app: how many metres of stairs we avoid and what it costs. */
export function DetourCard({ plan, avoidStairs, places }: DetourCardProps) {
  const { t, i18n } = useTranslation()
  const variant = detourCase(plan, avoidStairs)
  const tone = TONE[variant]
  const Icon = TONE_ICON[tone]

  const values = {
    stairs: formatDistance(plan.baseline.stairs_m ?? 0, i18n.language),
    detour: formatDistance(plan.detour_m ?? 0, i18n.language),
    minutes: plan.extra_min ?? 0,
  }
  // <Trans> puts the <stairs> tag from the translation around a real <strong> element.
  const stairsTag = { stairs: <strong className="font-semibold text-stairs-text" /> }

  const stat = (kind: Stat['kind'], value: string): Stat => ({
    kind,
    label: t(`planner.detour.stats.${kind}`),
    value,
  })
  const stats = [
    stat('distance', formatDistance(plan.route.distance_m, i18n.language)),
    stat('time', formatDuration(plan.route.duration_min)),
    // A rough estimate for a 70 kg adult, so the value says "about" (DECISIONS.md section 13).
    stat('kcal', t('planner.detour.kcalValue', { kcal: plan.route.kcal })),
    ...(places === undefined ? [] : [stat('places', String(places))]),
  ]

  // The result hero (DESIGN.md section 5): tag, title, body, then a row of stats.
  return (
    <section
      aria-labelledby="detour-title"
      className={cn('space-y-3 rounded-2xl border p-5', TONE_STYLE[tone])}
      data-variant={variant}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 text-[13px] leading-4 font-medium tracking-wide uppercase',
          TAG_STYLE[tone],
        )}
      >
        <Icon aria-hidden className="size-4" />
        {t(`planner.detour.${variant}.tag`)}
      </p>
      <h2 id="detour-title" className="text-xl font-semibold tracking-tight">
        {t(`planner.detour.${variant}.title`, values)}
      </h2>
      <p>
        <Trans
          i18nKey={`planner.detour.${variant}.detail`}
          values={values}
          components={stairsTag}
        />
      </p>
      <StatList
        stats={stats}
        label={t('planner.detour.statsLabel')}
        className="pt-1 sm:flex sm:flex-wrap sm:gap-x-6"
      />
    </section>
  )
}

export function DetourCardSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" className="animate-pulse space-y-3 rounded-2xl border p-5">
      <span className="sr-only">{t('planner.loading')}</span>
      <div className="h-3 w-1/4 rounded-full bg-muted" />
      <div className="h-6 w-3/4 rounded-lg bg-muted" />
      <div className="h-4 w-full rounded-lg bg-muted" />
      <div className="flex gap-6 pt-1">
        <div className="h-10 w-16 rounded-lg bg-muted" />
        <div className="h-10 w-16 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

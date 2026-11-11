import { Trans, useTranslation } from 'react-i18next'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { RoutePlan } from '@/api/types'
import { formatDistance, formatDuration } from '@/lib/format'
import { detourCase, type DetourCase } from '@/lib/planner'
import { cn } from '@/lib/utils'

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
  good: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  info: 'border-sky-300 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-50',
  warn: 'border-red-300 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50',
}

const TONE_ICON = { good: CircleCheck, info: Info, warn: TriangleAlert }

interface DetourCardProps {
  plan: RoutePlan
  /** What the user asked for; tells "not searched" from "the check failed". */
  avoidStairs: boolean
}

/** The twist of the app: how many metres of stairs we avoid and what it costs. */
export function DetourCard({ plan, avoidStairs }: DetourCardProps) {
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
  const stairsTag = { stairs: <strong className="font-semibold text-red-700 dark:text-red-300" /> }

  return (
    <section
      aria-labelledby="detour-title"
      className={cn('flex gap-3 rounded-lg border p-3', TONE_STYLE[tone])}
      data-variant={variant}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <h2 id="detour-title" className="font-semibold">
          {t(`planner.detour.${variant}.title`, values)}
        </h2>
        <p>
          <Trans
            i18nKey={`planner.detour.${variant}.detail`}
            values={values}
            components={stairsTag}
          />
        </p>
        <p className="text-xs opacity-80">
          {t('planner.detour.summary', {
            distance: formatDistance(plan.route.distance_m, i18n.language),
            duration: formatDuration(plan.route.duration_min),
          })}
        </p>
      </div>
    </section>
  )
}

export function DetourCardSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" className="animate-pulse space-y-2 rounded-lg border p-3">
      <span className="sr-only">{t('planner.loading')}</span>
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

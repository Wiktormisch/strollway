import { useTranslation } from 'react-i18next'
import { FlaskConical, TriangleAlert } from 'lucide-react'
import type { RouteSource } from '@/api/types'
import { Button } from '@/components/ui/button'
import { planErrorKey } from '@/lib/planner'

/** Shown when the route is a recorded demo or a straight line, not a live ORS answer. */
export function DemoModeBanner({ source }: { source: RouteSource }) {
  const { t } = useTranslation()
  if (source === 'ors') return null
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{t(`planner.demoMode.${source}`)}</p>
    </div>
  )
}

interface ErrorBannerProps {
  error: unknown
  onRetry: () => void
  /** A 400 means different things: bad points on a route, a bad form on a trip. */
  mode?: 'route' | 'trip'
}

export function ErrorBanner({ error, onRetry, mode = 'route' }: ErrorBannerProps) {
  const { t } = useTranslation()
  const planKey = planErrorKey(error)
  const key = mode === 'trip' && planKey === 'invalid' ? 'invalidTrip' : planKey
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <p className="flex gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
        {t(`planner.errors.${key}`)}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('planner.retry')}
      </Button>
    </div>
  )
}

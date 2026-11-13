import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import type { RouteSource } from '@/api/types'
import { WarningBanner } from '@/components/common/States'
import { planErrorKey } from '@/lib/planner'

/** Shown when the route is a recorded demo or a straight line, not a live ORS answer. */
export function DemoModeBanner({ source }: { source: RouteSource }) {
  const { t } = useTranslation()
  if (source === 'ors') return null
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-muted p-2 text-sm text-foreground">
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
    <WarningBanner
      message={t(`planner.errors.${key}`)}
      retryLabel={t('planner.retry')}
      onRetry={onRetry}
    />
  )
}

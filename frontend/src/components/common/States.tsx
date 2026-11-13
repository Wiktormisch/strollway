import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/fieldErrors'
import { cn } from '@/lib/utils'

/** Nothing to show: one short sentence and at most one action (DESIGN.md section 7). */
export function EmptyState({
  title,
  text,
  action,
  titleAs: Title = 'p',
}: {
  title: string
  text?: string
  action?: ReactNode
  /** 'h1' when the empty state is the whole page (for example "Page not found"). */
  titleAs?: 'p' | 'h1'
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-card px-5 py-8 text-center">
      <Title className="text-base font-medium">{title}</Title>
      {text && <p className="max-w-prose text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  )
}

/**
 * Warning banner: `stairs-text` on an 8% terracotta tint. 8% keeps the text above 4.5:1 on both
 * `background` and `card` (10% drops to 4.4:1 on the light background).
 */
export function WarningBanner({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-stairs/40 bg-stairs/8 p-4 text-sm text-stairs-text"
    >
      <p className="flex gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-stairs" />
        {message}
      </p>
      <Button variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  )
}

/** A failed load: a clear message and "Try again". */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <WarningBanner
      message={t('common.loadFailed', { reason: errorMessage(t, error) })}
      retryLabel={t('common.retry')}
      onRetry={onRetry}
    />
  )
}

/** Loading placeholders in `muted`; no spinners for content. */
export function ListSkeleton({
  count = 3,
  itemClassName = 'h-36',
  className,
}: {
  count?: number
  itemClassName?: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')} className={cn('grid gap-3', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn('rounded-2xl', itemClassName)} />
      ))}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

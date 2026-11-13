import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { WalkStatus } from '@/api/types'
import { useLoadDemoData, useWalks } from '@/api/walks'
import { EmptyState, ListSkeleton, LoadError } from '@/components/common/States'
import { WalkCard } from '@/components/walks/WalkCard'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/fieldErrors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/usePageTitle'

type Filter = 'all' | WalkStatus
const FILTERS: Filter[] = ['all', 'planned', 'done']

export function WalksPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.walks.title'))
  const [filter, setFilter] = useState<Filter>('all')
  const walks = useWalks(filter === 'all' ? undefined : filter)
  const demo = useLoadDemoData()

  function loadDemo() {
    demo.mutate(undefined, {
      onSuccess: (answer) =>
        toast.success(t(answer.created ? 'walks.demo.added' : 'walks.demo.existed')),
      onError: (error) => toast.error(t('walks.demo.failed', { reason: errorMessage(t, error) })),
    })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t('pages.walks.title')}</h1>

      {/* Looks like the planner tabs (a pill track in `muted`), but it filters one list, so it
          is a group of toggle buttons (aria-pressed), not tabs with their own panels. */}
      <div
        role="group"
        aria-label={t('walks.filter.label')}
        className="inline-flex max-w-full gap-1 rounded-full bg-muted p-1"
      >
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'h-10 min-w-0 truncate rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              filter === value && 'bg-card text-foreground shadow-sm',
            )}
          >
            {t(`walks.filter.${value}`)}
          </button>
        ))}
      </div>

      {walks.isPending && <ListSkeleton className="sm:grid-cols-2 lg:grid-cols-3" />}
      {walks.isError && <LoadError error={walks.error} onRetry={() => walks.refetch()} />}
      {walks.data?.length === 0 &&
        (filter === 'all' ? (
          <EmptyState
            title={t('walks.empty.title')}
            text={t('walks.empty.text')}
            action={
              <Button onClick={loadDemo} disabled={demo.isPending}>
                {demo.isPending ? t('walks.demo.loading') : t('walks.demo.button')}
              </Button>
            }
          />
        ) : (
          <EmptyState title={t('walks.empty.filtered')} />
        ))}
      {walks.data && walks.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {walks.data.map((walk) => (
            <li key={walk.id}>
              <WalkCard walk={walk} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

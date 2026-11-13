import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { WalkStatus } from '@/api/types'
import { useLoadDemoData, useWalks } from '@/api/walks'
import { EmptyState, ListSkeleton, LoadError } from '@/components/common/States'
import { WalkCard } from '@/components/walks/WalkCard'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/fieldErrors'
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('pages.walks.title')}</h1>

      <div role="group" aria-label={t('walks.filter.label')} className="flex flex-wrap gap-1.5">
        {FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(`walks.filter.${value}`)}
          </Button>
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

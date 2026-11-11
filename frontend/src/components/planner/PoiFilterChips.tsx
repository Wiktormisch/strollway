import { useTranslation } from 'react-i18next'
import { categoryIcon } from '@/constants/poiCategories'
import type { CategoryCount } from '@/lib/planner'
import { cn } from '@/lib/utils'
import { categoryLabel } from '@/lib/poiLabel'

interface PoiFilterChipsProps {
  categories: CategoryCount[]
  hidden: ReadonlySet<string>
  onToggle: (category: string) => void
}

/** Toggle buttons, one per category. `aria-pressed` tells screen readers the state. */
export function PoiFilterChips({ categories, hidden, onToggle }: PoiFilterChipsProps) {
  const { t } = useTranslation()

  return (
    <div role="group" aria-label={t('poi.filterLabel')} className="flex flex-wrap gap-1.5">
      {categories.map(({ category, count }) => {
        const Icon = categoryIcon(category)
        const shown = !hidden.has(category)
        return (
          <button
            key={category}
            type="button"
            aria-pressed={shown}
            onClick={() => onToggle(category)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              shown
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background line-through opacity-70',
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {categoryLabel(t, category)} <span className="tabular-nums">({count})</span>
          </button>
        )
      })}
    </div>
  )
}

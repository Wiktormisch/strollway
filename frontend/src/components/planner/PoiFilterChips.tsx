import { useTranslation } from 'react-i18next'
import { categoryColor, categoryIcon } from '@/constants/poiCategories'
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
    <div role="group" aria-label={t('poi.filterLabel')} className="flex flex-wrap gap-2">
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
              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm outline-none',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              // Shown: a brand outline and a coloured icon. Hidden: muted and crossed out.
              shown
                ? 'border-brand/60 bg-card text-foreground hover:bg-brand-soft'
                : 'bg-muted text-muted-foreground line-through hover:bg-background',
            )}
          >
            <Icon
              aria-hidden
              className="size-4"
              style={shown ? { color: categoryColor(category) } : undefined}
            />
            {categoryLabel(t, category)} <span className="tabular-nums">({count})</span>
          </button>
        )
      })}
    </div>
  )
}

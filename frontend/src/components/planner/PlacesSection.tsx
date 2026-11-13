import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import type { RoutePlan } from '@/api/types'
import { Button } from '@/components/ui/button'
import { categoryColor, categoryIcon } from '@/constants/poiCategories'
import { countCategories, visiblePois } from '@/lib/planner'
import { CollapsibleSection } from './CollapsibleSection'
import { PoiFilterChips } from './PoiFilterChips'
import { usePoiLabel } from '@/lib/poiLabel'

interface PlacesSectionProps {
  plan: RoutePlan
  hidden: ReadonlySet<string>
  onToggle: (category: string) => void
  onReload: () => void
  reloading: boolean
}

export function PlacesSection({ plan, hidden, onToggle, onReload, reloading }: PlacesSectionProps) {
  const { t } = useTranslation()
  const label = usePoiLabel()

  let body
  if (plan.pois_status === 'unavailable') {
    body = (
      <div className="space-y-2">
        <p className="text-sm">{t('poi.unavailable')}</p>
        <Button variant="outline" size="sm" onClick={onReload} disabled={reloading}>
          <RefreshCw aria-hidden className={reloading ? 'animate-spin' : undefined} />
          {t('poi.reload')}
        </Button>
      </div>
    )
  } else if (plan.pois.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t('poi.none')}</p>
  } else {
    const shown = visiblePois(plan.pois, hidden)
    body = (
      <div className="space-y-2">
        <PoiFilterChips
          categories={countCategories(plan.pois)}
          hidden={hidden}
          onToggle={onToggle}
        />
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('poi.allHidden')}</p>
        ) : (
          <ul className="divide-y text-sm">
            {shown.map((poi) => {
              const Icon = categoryIcon(poi.category)
              return (
                <li key={poi.poi_id} className="flex items-center gap-2 py-1.5">
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0"
                    style={{ color: categoryColor(poi.category) }}
                  />
                  <span className="flex-1">{label(poi)}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t('poi.fromStart', { minutes: poi.at_min })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  return (
    // Open by default: places along the way are the useful part during a walk.
    <CollapsibleSection id="places-title" title={t('poi.title')} defaultOpen>
      {body}
    </CollapsibleSection>
  )
}

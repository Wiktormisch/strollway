import { useTranslation } from 'react-i18next'
import { Bus, TramFront } from 'lucide-react'
import type { TransitStop } from '@/api/types'
import { formatDistance } from '@/lib/format'
import { CollapsibleSection } from './CollapsibleSection'

const ENDS = ['start', 'end'] as const

export function TransitStops({ stops }: { stops: TransitStop[] }) {
  const { t, i18n } = useTranslation()

  return (
    // Closed by default: stops matter only for the way there and back.
    <CollapsibleSection id="transit-title" title={t('transit.title')}>
      <div className="space-y-2">
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('transit.none')}</p>
        ) : (
          ENDS.map((near) => {
            const group = stops.filter((stop) => stop.near === near)
            if (group.length === 0) return null
            return (
              <div key={near}>
                <h3 className="text-sm text-muted-foreground">{t(`transit.near.${near}`)}</h3>
                <ul className="text-sm">
                  {group.map((stop, index) => {
                    const Icon = stop.kind === 'tram' ? TramFront : Bus
                    return (
                      <li
                        key={`${stop.name}-${stop.kind}-${index}`}
                        className="flex items-center gap-2 py-0.5"
                      >
                        <Icon aria-hidden className="size-4 text-muted-foreground" />
                        <span className="flex-1">
                          {stop.name ?? t(`transit.kind.${stop.kind}`)}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatDistance(stop.distance_m, i18n.language)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </CollapsibleSection>
  )
}

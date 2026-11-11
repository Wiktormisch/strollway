import { useTranslation } from 'react-i18next'
import type { Poi } from '@/api/types'
import { categoryLabel, usePoiLabel } from '@/lib/poiLabel'

/** Popup content of a place marker. Plain React, so it is tested without Leaflet. */
export function PoiDetails({ poi }: { poi: Poi }) {
  const { t } = useTranslation()
  const label = usePoiLabel()
  const accessibility = poi.accessibility ?? []

  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">{label(poi)}</p>
      {poi.name && (
        <p className="text-xs text-muted-foreground">{categoryLabel(t, poi.category)}</p>
      )}
      <p>{t('poi.fromStart', { minutes: poi.at_min })}</p>
      {poi.opening_hours && <p>{t('poi.openingHours', { hours: poi.opening_hours })}</p>}
      {poi.open_now !== null && <p>{t(poi.open_now ? 'poi.openNow' : 'poi.closedNow')}</p>}
      {accessibility.length > 0 && (
        <ul aria-label={t('poi.accessibilityLabel')} className="flex flex-wrap gap-1">
          {accessibility.map((tag) => (
            <li key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {t(`poi.accessibility.${tag}`, { defaultValue: tag })}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

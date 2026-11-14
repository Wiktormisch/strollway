import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { LatLng, LatLngTuple } from '@/api/types'
import { Button } from '@/components/ui/button'
import { googleMapsLink, MAX_WAYPOINTS } from '@/lib/googleMapsLink'
import { StairsIcon } from './StairsIcon'

interface MapsExportProps {
  geometry: LatLngTuple[]
  stops?: LatLng[]
}

/** "Open in Google Maps" with the warning that Google routes on its own between our points. */
export function MapsExport({ geometry, stops }: MapsExportProps) {
  const { t } = useTranslation()
  const link = googleMapsLink(geometry, stops)
  if (!link) return null

  return (
    <div className="space-y-1.5">
      <Button asChild variant="outline" className="w-full">
        {/* A new tab keeps the plan open here. noopener: Google gets no access to this page. */}
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden />
          {t('mapsExport.open')}
          <span className="sr-only"> {t('mapsExport.newTab')}</span>
        </a>
      </Button>
      <p className="flex gap-1.5 text-xs text-muted-foreground">
        <StairsIcon aria-hidden className="size-4 shrink-0 text-stairs" />
        <span>
          {t('mapsExport.warning')}
          {link.stopsCut && ` ${t('mapsExport.stopsCut', { count: MAX_WAYPOINTS })}`}
        </span>
      </p>
    </div>
  )
}

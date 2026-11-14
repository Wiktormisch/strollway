import { useTranslation } from 'react-i18next'
import { Loader2, LocateFixed } from 'lucide-react'
import type { LatLng } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useCurrentPosition } from '@/lib/useCurrentPosition'

interface LocateButtonProps {
  onLocate: (point: LatLng) => void
}

/** "Use my location": sets the start once. The position is not stored anywhere. */
export function LocateButton({ onLocate }: LocateButtonProps) {
  const { t } = useTranslation()
  const { locate, locating, error } = useCurrentPosition(onLocate)

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
        {locating ? <Loader2 aria-hidden className="animate-spin" /> : <LocateFixed aria-hidden />}
        {locating ? t('location.locating') : t('location.use')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`location.error.${error}`)}
        </p>
      )}
    </div>
  )
}

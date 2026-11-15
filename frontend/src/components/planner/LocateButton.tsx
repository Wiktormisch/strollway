import { useTranslation } from 'react-i18next'
import { Loader2, LocateFixed } from 'lucide-react'
import type { LatLng } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useCurrentPosition } from '@/lib/useCurrentPosition'

interface LocateButtonProps {
  onLocate: (point: LatLng) => void
  /** Stretch the button to the width of its box (used in a two-column row). */
  fullWidth?: boolean
}

/** "Use my location": sets the start once. The position is not stored anywhere. */
export function LocateButton({ onLocate, fullWidth = false }: LocateButtonProps) {
  const { t } = useTranslation()
  const { locate, locating, error } = useCurrentPosition(onLocate)

  return (
    <div className="min-w-0 space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={locate}
        disabled={locating}
        className={fullWidth ? 'h-auto min-h-9 w-full py-1.5 whitespace-normal' : undefined}
      >
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

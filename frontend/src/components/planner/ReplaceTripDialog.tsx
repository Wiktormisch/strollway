import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ReplaceTripDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Asks before a new start removes the current trip (audit idea 12).
 * A dialog, not a note in the panel: on a phone the panel can be folded while the map is tapped.
 */
export function ReplaceTripDialog(props: ReplaceTripDialogProps) {
  const { t } = useTranslation()
  return (
    // Escape, the X and a click outside all mean "keep": the safe choice that loses nothing.
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('trip.replace.title')}</DialogTitle>
          <DialogDescription>{t('trip.replace.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={props.onCancel}>
            {t('trip.replace.cancel')}
          </Button>
          <Button onClick={props.onConfirm}>{t('trip.replace.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

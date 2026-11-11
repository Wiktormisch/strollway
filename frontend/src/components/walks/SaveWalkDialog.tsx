import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { FamilyProfile, LatLng, RoutePlan } from '@/api/types'
import { useCreateWalk } from '@/api/walks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { errorMessage, NO_ERRORS, parseFieldErrors, type FormErrors } from '@/lib/fieldErrors'
import { WALK_FORM_FIELDS } from '@/lib/formRules'
import { buildWalkPayload } from '@/lib/walkPayload'
import { WalkForm, type WalkFormValues } from './WalkForm'

interface SaveWalkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: RoutePlan
  start: LatLng
  end: LatLng
  avoidStairs: boolean
  profiles: FamilyProfile[]
  profileId: number | null
}

export function SaveWalkDialog(props: SaveWalkDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateWalk()
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)

  function changeOpen(open: boolean) {
    // Old errors belong to the last attempt, not to the next opening.
    if (!open) setErrors(NO_ERRORS)
    props.onOpenChange(open)
  }

  function save(values: WalkFormValues) {
    setErrors(NO_ERRORS)
    const payload = buildWalkPayload({
      plan: props.plan,
      start: props.start,
      end: props.end,
      avoidStairs: props.avoidStairs,
      name: values.name,
      profileId: values.profileId,
      pois: props.plan.pois.filter((poi) => values.poiIds.includes(poi.poi_id)),
    })
    create.mutate(payload, {
      onSuccess: (walk) => {
        toast.success(t('walkForm.saved'))
        changeOpen(false)
        navigate(`/walks/${walk.id}`)
      },
      onError: (error) => {
        const parsed = parseFieldErrors(error, WALK_FORM_FIELDS)
        setErrors(parsed)
        toast.error(parsed.general ?? t('walkForm.failed', { reason: errorMessage(t, error) }))
      },
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('walkForm.title')}</DialogTitle>
          <DialogDescription>{t('walkForm.description')}</DialogDescription>
        </DialogHeader>
        {props.open && (
          <WalkForm
            pois={props.plan.pois}
            profiles={props.profiles}
            defaultProfileId={props.profileId}
            submitting={create.isPending}
            serverErrors={errors.fields}
            onSubmit={save}
            onCancel={() => changeOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

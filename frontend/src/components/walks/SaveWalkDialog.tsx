import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRoutePlanForSave } from '@/api/planning'
import type { FamilyProfile, Poi, RoutePlan, RoutePlanRequest, WalkCreate } from '@/api/types'
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
import { WalkForm, type WalkFormValues } from './WalkForm'

interface SaveWalkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Places to pick stops from; null when the plan already has its stops (a trip idea). */
  pois: Poi[] | null
  profiles: FamilyProfile[]
  profileId: number | null
  /**
   * Each planner mode turns the form values into its own POST /api/walks/ body.
   * `plan` is the plan recomputed for the chosen profile (A -> B only).
   */
  buildPayload: (values: WalkFormValues, plan: RoutePlan | undefined) => WalkCreate
  /**
   * A -> B only: the route request for a profile. With it, another profile in the form
   * recomputes the walking time. A trip has none: a new trip would be a paid LLM call.
   */
  routeRequestFor?: (profileId: number | null) => RoutePlanRequest
  description?: string
}

export function SaveWalkDialog(props: SaveWalkDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateWalk()
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [formProfileId, setFormProfileId] = useState(props.profileId)
  // Each opening starts from the planner profile, which may have changed since the last one.
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setFormProfileId(props.profileId)
  }
  const recompute = useRoutePlanForSave(
    props.open && props.routeRequestFor ? props.routeRequestFor(formProfileId) : null,
  )
  // Old data from `keepPreviousData` is still the time of the last profile, so it waits.
  const recomputing = recompute.isFetching || recompute.isPlaceholderData

  function changeOpen(open: boolean) {
    // Old errors belong to the last attempt, not to the next opening.
    if (!open) setErrors(NO_ERRORS)
    props.onOpenChange(open)
  }

  function save(values: WalkFormValues) {
    setErrors(NO_ERRORS)
    create.mutate(props.buildPayload(values, recompute.data), {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('walkForm.title')}</DialogTitle>
          <DialogDescription>{props.description ?? t('walkForm.description')}</DialogDescription>
        </DialogHeader>
        {props.open && (
          <WalkForm
            pois={props.pois}
            profiles={props.profiles}
            defaultProfileId={props.profileId}
            submitting={create.isPending}
            onProfileChange={setFormProfileId}
            recompute={
              props.routeRequestFor
                ? {
                    durationMin: recompute.data?.route.duration_min,
                    loading: recomputing,
                    failed: recompute.isError,
                  }
                : undefined
            }
            serverErrors={errors.fields}
            onSubmit={save}
            onCancel={() => changeOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { FamilyProfile, Poi } from '@/api/types'
import { FieldError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_STOPS } from '@/lib/formRules'
import { usePoiLabel } from '@/lib/poiLabel'
import { ProfileSelect } from './ProfileSelect'

const MAX_NAME_LENGTH = 80

export interface WalkFormValues {
  name: string
  profileId: number | null
  poiIds: string[]
}

interface WalkFormProps {
  /** Places to choose stops from; null hides the choice (a trip idea brings its own stops). */
  pois: Poi[] | null
  profiles: FamilyProfile[]
  /** The profile the route was planned with; the walking time matches its pace. */
  defaultProfileId: number | null
  submitting?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: WalkFormValues) => void
  onCancel: () => void
}

/** The "Save walk" form: a name, a profile and the places to keep as stops. */
export function WalkForm(props: WalkFormProps) {
  const { t } = useTranslation()
  const poiLabel = usePoiLabel()
  const [name, setName] = useState('')
  const [profileId, setProfileId] = useState(props.defaultProfileId)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [nameError, setNameError] = useState('')

  const errors: Record<string, string | undefined> = {
    ...props.serverErrors,
    ...(nameError ? { name: nameError } : {}),
  }
  const sortedPois = [...(props.pois ?? [])].sort((a, b) => a.at_min - b.at_min)

  function toggle(poiId: string) {
    const next = new Set(chosen)
    if (next.has(poiId)) next.delete(poiId)
    else next.add(poiId)
    setChosen(next)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setNameError(t('walkForm.errors.nameRequired'))
      return
    }
    setNameError('')
    props.onSubmit({ name: name.trim(), profileId, poiIds: [...chosen] })
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="walk-name">{t('walkForm.name')}</Label>
        <Input
          id="walk-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t('walkForm.namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="walk-name-error"
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="walk-name-error" message={errors.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="walk-profile">{t('walkForm.profile')}</Label>
        <ProfileSelect
          id="walk-profile"
          profiles={props.profiles}
          value={profileId}
          onChange={setProfileId}
        />
        {profileId !== props.defaultProfileId && (
          <p className="text-sm text-stairs-text">{t('walkForm.paceMismatch')}</p>
        )}
        <FieldError id="walk-profile-error" message={errors.profile} />
      </div>

      {props.pois !== null && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t('walkForm.stops')}</legend>
          {sortedPois.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('walkForm.noPlaces')}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('walkForm.stopsHint', { max: MAX_STOPS })}
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl border p-2">
                {sortedPois.map((poi) => {
                  const checked = chosen.has(poi.poi_id)
                  return (
                    <li key={poi.poi_id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          className="size-5 accent-brand"
                          checked={checked}
                          disabled={!checked && chosen.size >= MAX_STOPS}
                          onChange={() => toggle(poi.poi_id)}
                        />
                        <span className="flex-1">{poiLabel(poi)}</span>
                        <span className="text-sm text-muted-foreground">
                          {t('poi.fromStart', { minutes: poi.at_min })}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <FieldError id="walk-stops-error" message={errors.stops} />
        </fieldset>
      )}
      {props.pois === null && <FieldError id="walk-stops-error" message={errors.stops} />}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={props.submitting}>
          {props.submitting ? t('common.saving') : t('walkForm.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

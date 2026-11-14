import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Repeat, X } from 'lucide-react'
import type { FamilyProfile, ProfileInput, Wheels } from '@/api/types'
import { PaceSlider } from '@/components/common/PaceSlider'
import { FieldError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FormSection } from '@/components/planner/FormSection'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ageError, MAX_CHILD_AGE, MAX_CHILDREN } from '@/lib/formRules'
import { clampPace, PACE_DEFAULT_KMH, paceMax } from '@/lib/pace'
import {
  clampTripMinutes,
  DEFAULT_TRIP_MINUTES,
  MAX_TRIP_MINUTES,
  MIN_TRIP_MINUTES,
} from '@/lib/trip'

const MAX_NAME_LENGTH = 60
const WHEELS: Wheels[] = ['stroller', 'kid_bike', 'none']

interface ProfileFormProps {
  initial?: FamilyProfile
  submitting?: boolean
  /** Messages from the backend, by field name. */
  serverErrors?: Record<string, string>
  onSubmit: (input: ProfileInput) => void
  onCancel: () => void
}

export function ProfileForm(props: ProfileFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.initial?.name ?? '')
  const [ages, setAges] = useState<number[]>(props.initial?.children_ages ?? [])
  const [ageText, setAgeText] = useState('')
  const [wheels, setWheels] = useState<Wheels>(props.initial?.wheels ?? 'stroller')
  const [pace, setPace] = useState(props.initial?.pace_kmh ?? PACE_DEFAULT_KMH)
  const [minutesText, setMinutesText] = useState(
    String(props.initial?.trip_minutes ?? DEFAULT_TRIP_MINUTES),
  )
  const tripMinutes = clampTripMinutes(minutesText === '' ? NaN : Number(minutesText))
  const [roundTrip, setRoundTrip] = useState(props.initial?.round_trip ?? true)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  // A field error typed by the user is newer than the last server answer, so it wins.
  const errors = { ...props.serverErrors, ...clientErrors }

  /** A stroller caps the pace, so a faster pace drops to the cap (audit idea 3). */
  function changeWheels(next: Wheels) {
    setWheels(next)
    setPace((current) => clampPace(current, next))
  }

  function addAge() {
    const key = ageError(ageText, ages.length)
    if (key) {
      setClientErrors({
        ...clientErrors,
        children_ages: t(`profiles.form.errors.${key}`, {
          max: MAX_CHILDREN,
          maxAge: MAX_CHILD_AGE,
        }),
      })
      return
    }
    setAges([...ages, Number(ageText)])
    setAgeText('')
    setClientErrors({ ...clientErrors, children_ages: '' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = t('profiles.form.errors.nameRequired')
    setClientErrors(next)
    if (Object.keys(next).length > 0) return
    props.onSubmit({
      name: name.trim(),
      children_ages: ages,
      wheels,
      pace_kmh: pace,
      trip_minutes: tripMinutes,
      round_trip: roundTrip,
    })
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">{t('profiles.form.name')}</Label>
        <Input
          id="profile-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t('profiles.form.namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="profile-name-error"
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="profile-name-error" message={errors.name} />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t('profiles.form.ages')}</legend>
        <p className="text-sm text-muted-foreground">
          {t('profiles.form.agesHint', { max: MAX_CHILDREN, maxAge: MAX_CHILD_AGE })}
        </p>
        {ages.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {ages.map((age, index) => (
              <li
                key={index}
                className="flex h-9 items-center gap-1 rounded-full bg-muted pr-0.5 pl-3 text-sm"
              >
                {t('profiles.ageChip', { age })}
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={t('profiles.form.removeAge', { age })}
                  onClick={() => setAges(ages.filter((_, i) => i !== index))}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id="profile-age"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_CHILD_AGE}
            className="w-28"
            value={ageText}
            aria-label={t('profiles.form.age')}
            aria-invalid={Boolean(errors.children_ages)}
            aria-describedby="profile-ages-error"
            onChange={(event) => setAgeText(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds the age instead of sending the whole form.
              if (event.key === 'Enter') {
                event.preventDefault()
                addAge()
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addAge}>
            {t('profiles.form.addAge')}
          </Button>
        </div>
        <FieldError id="profile-ages-error" message={errors.children_ages} />
      </fieldset>

      <FormSection>
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t('profiles.form.sections.moving')}
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="profile-wheels">{t('profiles.form.wheels')}</Label>
          <Select value={wheels} onValueChange={(value) => changeWheels(value as Wheels)}>
            <SelectTrigger id="profile-wheels" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WHEELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`profiles.wheels.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="profile-wheels-error" message={errors.wheels} />
        </div>
        <div>
          <PaceSlider id="profile-pace" value={pace} max={paceMax(wheels)} onChange={setPace} />
          <FieldError id="profile-pace-error" message={errors.pace_kmh} />
        </div>
      </FormSection>

      <FormSection>
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t('profiles.form.sections.trip')}
        </h3>
        <div>
          {/* Label left, control right: the same row shape as the switch below. */}
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="profile-minutes">
              <Clock aria-hidden className="size-5 text-brand" />
              {t('profiles.form.tripMinutes')}
            </Label>
            <div className="flex shrink-0 items-center gap-2">
              <Input
                id="profile-minutes"
                type="number"
                inputMode="numeric"
                min={MIN_TRIP_MINUTES}
                max={MAX_TRIP_MINUTES}
                className="w-20 text-center"
                value={minutesText}
                aria-invalid={Boolean(errors.trip_minutes)}
                aria-describedby="profile-minutes-hint profile-minutes-error"
                onChange={(event) => setMinutesText(event.target.value)}
                // Leaving the field shows the value that will be saved.
                onBlur={() => setMinutesText(String(tripMinutes))}
              />
              <span aria-hidden className="text-sm text-muted-foreground">
                {t('profiles.form.minutesUnit')}
              </span>
            </div>
          </div>
          <p id="profile-minutes-hint" className="text-xs text-muted-foreground">
            {t('trip.form.minutesRange', { min: MIN_TRIP_MINUTES, max: MAX_TRIP_MINUTES })}
          </p>
          <FieldError id="profile-minutes-error" message={errors.trip_minutes} />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="profile-round-trip">
            <Repeat aria-hidden className="size-5 text-brand" />
            {t('trip.form.roundTrip')}
          </Label>
          <Switch id="profile-round-trip" checked={roundTrip} onCheckedChange={setRoundTrip} />
        </div>
      </FormSection>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={props.submitting}>
          {props.submitting ? t('common.saving') : t('common.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

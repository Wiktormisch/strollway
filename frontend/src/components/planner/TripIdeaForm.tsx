import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Sparkles } from 'lucide-react'
import type { FamilyProfile, LatLng, TripIdeaRequest } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProfileSelect } from '@/components/walks/ProfileSelect'
import { PointRow } from './PointRow'
import {
  apiLanguage,
  DEFAULT_TRIP_MINUTES,
  DEMO_TRIP_START,
  MAX_WISHES_LENGTH,
  TRIP_MINUTES,
} from '@/lib/trip'
import { cn } from '@/lib/utils'

/** Lets the button on the map (phone, folded panel) submit this form. */
export const TRIP_FORM_ID = 'trip-idea-form'

interface TripIdeaFormProps {
  start: LatLng | null
  profiles: FamilyProfile[]
  profileId: number | null
  planning: boolean
  onProfileChange: (profileId: number | null) => void
  onClearStart: () => void
  onUseMapCenter: () => void
  onDemoStart: () => void
  onSubmit: (request: TripIdeaRequest) => void
}

/** The "Trip idea" form: one request, one result. No chat. */
export function TripIdeaForm(props: TripIdeaFormProps) {
  const { t, i18n } = useTranslation()
  const ids = useId()
  const [maxMinutes, setMaxMinutes] = useState<number>(DEFAULT_TRIP_MINUTES)
  const [roundTrip, setRoundTrip] = useState(true)
  const [wishes, setWishes] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!props.start || props.planning) return
    const request: TripIdeaRequest = {
      start: props.start,
      max_minutes: maxMinutes,
      round_trip: roundTrip,
      language: apiLanguage(i18n.language),
      wishes: wishes.trim(),
    }
    props.onSubmit(props.profileId === null ? request : { ...request, profile_id: props.profileId })
  }

  return (
    <form id={TRIP_FORM_ID} noValidate onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('trip.form.hint')}</p>

      <PointRow
        badge="A"
        name={t('trip.form.start')}
        point={props.start}
        demoName={sameDemoStart(props.start) ? t('trip.form.demoName') : null}
        onChange={props.onUseMapCenter}
        onClear={props.onClearStart}
      />
      <Button type="button" variant="demo" size="sm" onClick={props.onDemoStart}>
        <Play aria-hidden />
        {t('trip.form.demoStart')}
      </Button>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t('trip.form.minutes')}</legend>
        {/* Toggle buttons, not a dropdown: five values fit on one line and are one tap away. */}
        <div className="flex flex-wrap gap-1.5">
          {TRIP_MINUTES.map((minutes) => (
            <Button
              key={minutes}
              type="button"
              size="sm"
              variant={minutes === maxMinutes ? 'default' : 'outline'}
              aria-pressed={minutes === maxMinutes}
              onClick={() => setMaxMinutes(minutes)}
            >
              {t('trip.form.minutesOption', { minutes })}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-profile`}>{t('planner.profile.label')}</Label>
        <ProfileSelect
          id={`${ids}-profile`}
          profiles={props.profiles}
          value={props.profileId}
          onChange={props.onProfileChange}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${ids}-round`}>{t('trip.form.roundTrip')}</Label>
        <Switch id={`${ids}-round`} checked={roundTrip} onCheckedChange={setRoundTrip} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={`${ids}-wishes`}>{t('trip.form.wishes')}</Label>
          <span
            className={cn(
              'text-xs',
              wishes.length >= MAX_WISHES_LENGTH
                ? 'font-medium text-destructive'
                : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {t('trip.form.wishesCount', { count: wishes.length, max: MAX_WISHES_LENGTH })}
          </span>
        </div>
        <Textarea
          id={`${ids}-wishes`}
          value={wishes}
          rows={3}
          maxLength={MAX_WISHES_LENGTH}
          placeholder={t('trip.form.wishesPlaceholder')}
          aria-describedby={`${ids}-wishes-hint`}
          // maxLength stops typing; slice also cuts a longer pasted text.
          onChange={(event) => setWishes(event.target.value.slice(0, MAX_WISHES_LENGTH))}
        />
        <p id={`${ids}-wishes-hint`} className="text-xs text-stairs-text">
          {t('trip.form.privacy')}
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={!props.start || props.planning}>
        {props.planning ? (
          <>
            <Loader2 aria-hidden className="animate-spin" />
            {t('trip.form.planning')}
          </>
        ) : (
          <>
            <Sparkles aria-hidden />
            {t('trip.form.submit')}
          </>
        )}
      </Button>
      {props.planning && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {t('trip.form.planningHint')}
        </p>
      )}
    </form>
  )
}

function sameDemoStart(point: LatLng | null): boolean {
  return point?.lat === DEMO_TRIP_START.lat && point.lng === DEMO_TRIP_START.lng
}

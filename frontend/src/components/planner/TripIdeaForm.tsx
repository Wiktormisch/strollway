import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Repeat, Sparkles } from 'lucide-react'
import type { FamilyProfile, LatLng, TripIdeaRequest } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProfileSelect } from '@/components/walks/ProfileSelect'
import { FormSection } from './FormSection'
import { LocateButton } from './LocateButton'
import { PointRow } from './PointRow'
import { Input } from '@/components/ui/input'
import {
  apiLanguage,
  clampTripMinutes,
  DEFAULT_TRIP_MINUTES,
  DEMO_TRIP_START,
  MAX_TRIP_MINUTES,
  MAX_WISHES_LENGTH,
  MIN_TRIP_MINUTES,
  TRIP_MINUTES_STEP,
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
  onLocate: (point: LatLng) => void
  onSubmit: (request: TripIdeaRequest) => void
}

/** The "Trip idea" form: one request, one result. No chat. */
export function TripIdeaForm(props: TripIdeaFormProps) {
  const { t, i18n } = useTranslation()
  const ids = useId()
  // One source of truth: the text in the number field. The slider and the request read the
  // clamped number, so a half-typed value never reaches the API.
  const [minutesText, setMinutesText] = useState(String(DEFAULT_TRIP_MINUTES))
  const maxMinutes = clampTripMinutes(minutesText === '' ? NaN : Number(minutesText))
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
      {/* Two equal columns: always side by side; a long label breaks into two lines instead. */}
      <div className="grid grid-cols-2 items-start gap-2">
        <LocateButton onLocate={props.onLocate} fullWidth />
        <Button
          type="button"
          variant="demo"
          size="sm"
          onClick={props.onDemoStart}
          className="h-auto min-h-9 w-full py-1.5 whitespace-normal"
        >
          <Play aria-hidden />
          {t('trip.form.demoStart')}
        </Button>
      </div>

      <FormSection>
        <fieldset className="space-y-1.5" aria-describedby={`${ids}-minutes-range`}>
          <legend className="text-sm font-medium">{t('trip.form.minutes')}</legend>
          {/* A native range input: no new dependency, keyboard and screen reader support for free. */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_TRIP_MINUTES}
              max={MAX_TRIP_MINUTES}
              step={TRIP_MINUTES_STEP}
              value={maxMinutes}
              aria-label={t('trip.form.minutesSlider')}
              aria-valuetext={t('trip.form.minutesOption', { minutes: maxMinutes })}
              onChange={(event) => setMinutesText(event.target.value)}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-primary"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_TRIP_MINUTES}
              max={MAX_TRIP_MINUTES}
              value={minutesText}
              aria-label={t('trip.form.minutesField')}
              onChange={(event) => setMinutesText(event.target.value)}
              // While typing, "1" on the way to "120" is allowed; leaving the field fixes the value.
              onBlur={() => setMinutesText(String(maxMinutes))}
              className="w-20 text-center"
            />
          </div>
          <p id={`${ids}-minutes-range`} className="text-xs text-muted-foreground">
            {t('trip.form.minutesRange', { min: MIN_TRIP_MINUTES, max: MAX_TRIP_MINUTES })}
          </p>
        </fieldset>
      </FormSection>

      <FormSection>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-profile`}>{t('planner.profile.label')}</Label>
          <ProfileSelect
            id={`${ids}-profile`}
            profiles={props.profiles}
            value={props.profileId}
            onChange={props.onProfileChange}
          />
        </div>

        <div className="flex min-h-11 items-center justify-between gap-2">
          <Label htmlFor={`${ids}-round`}>
            <Repeat aria-hidden className="size-5 text-brand" />
            {t('trip.form.roundTrip')}
          </Label>
          <Switch id={`${ids}-round`} checked={roundTrip} onCheckedChange={setRoundTrip} />
        </div>
      </FormSection>

      <FormSection>
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
      </FormSection>

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

import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Loader2, Play, Plus, Repeat, Save, ShieldCheck, Sparkles } from 'lucide-react'
import type { FamilyProfile, LatLng, TripIdeaRequest } from '@/api/types'
import { PaceSlider } from '@/components/common/PaceSlider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ProfileSelect } from '@/components/walks/ProfileSelect'
import { FormSection } from './FormSection'
import { LocateButton } from './LocateButton'
import { PlaceSearch } from './PlaceSearch'
import { PointRow } from './PointRow'
import { Input } from '@/components/ui/input'
import {
  apiLanguage,
  clampTripMinutes,
  DEMO_TRIP_START,
  MAX_TRIP_MINUTES,
  MAX_WISHES_LENGTH,
  MIN_TRIP_MINUTES,
  appendWish,
  TRIP_MINUTES_STEP,
} from '@/lib/trip'
import { cn } from '@/lib/utils'

/** Lets the button on the map (phone, folded panel) submit this form. */
export const TRIP_FORM_ID = 'trip-idea-form'

/** Quick ideas for the wishes; the texts are in i18n under trip.form.wishesChips. */
const WISH_CHIPS = ['playground', 'coffee', 'sweets', 'park', 'shortWalk'] as const

/** Show the character counter only when the text gets near the limit. */
const COUNTER_FROM = 150

interface TripIdeaFormProps {
  start: LatLng | null
  profiles: FamilyProfile[]
  profileId: number | null
  planning: boolean
  onProfileChange: (profileId: number | null) => void
  pace: number
  maxPace: number
  onPaceChange: (kmh: number) => void
  /** The limit and "come back to the start" live in the page, so a profile can set them. */
  minutes: number
  onMinutesChange: (minutes: number) => void
  roundTrip: boolean
  onRoundTripChange: (roundTrip: boolean) => void
  /** Shown only with a profile whose saved settings differ from the form (audit idea 4). */
  canSaveSettings: boolean
  savingSettings: boolean
  onSaveSettings: () => void
  onClearStart: () => void
  onUseMapCenter: () => void
  onDemoStart: () => void
  onLocate: (point: LatLng) => void
  /** A place picked in the name search becomes the start. */
  onSearchPick: (point: LatLng) => void
  onSubmit: (request: TripIdeaRequest) => void
}

/** The "Trip idea" form: one request, one result. No chat. */
export function TripIdeaForm(props: TripIdeaFormProps) {
  const { t, i18n } = useTranslation()
  const ids = useId()
  // One source of truth: the text in the number field. The slider and the request read the
  // clamped number, so a half-typed value never reaches the API.
  const [minutesText, setMinutesText] = useState(String(props.minutes))
  const maxMinutes = clampTripMinutes(minutesText === '' ? NaN : Number(minutesText))
  // A new value from the page (a profile was picked) replaces the text. This is React's
  // "adjust state while rendering" pattern: no effect, so no extra render with old text.
  const [shownMinutes, setShownMinutes] = useState(props.minutes)
  if (props.minutes !== shownMinutes) {
    setShownMinutes(props.minutes)
    setMinutesText(String(props.minutes))
  }

  function changeMinutesText(text: string) {
    setMinutesText(text)
    const next = clampTripMinutes(text === '' ? NaN : Number(text))
    setShownMinutes(next)
    props.onMinutesChange(next)
  }
  const [wishes, setWishes] = useState('')
  const chips = WISH_CHIPS.map((key) => t(`trip.form.wishesChips.${key}`))

  function addChip(chip: string) {
    setWishes((current) => appendWish(current, chip))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!props.start || props.planning) return
    const request: TripIdeaRequest = {
      start: props.start,
      max_minutes: maxMinutes,
      round_trip: props.roundTrip,
      language: apiLanguage(i18n.language),
      wishes: wishes.trim(),
      pace_kmh: props.pace,
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
      <PlaceSearch onPick={props.onSearchPick} />
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
          <legend className="flex items-center gap-2 text-sm font-medium">
            <Clock aria-hidden className="size-5 text-brand" />
            {t('trip.form.minutes')}
          </legend>
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
              onChange={(event) => changeMinutesText(event.target.value)}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-primary"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_TRIP_MINUTES}
              max={MAX_TRIP_MINUTES}
              value={minutesText}
              aria-label={t('trip.form.minutesField')}
              onChange={(event) => changeMinutesText(event.target.value)}
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
        <PaceSlider
          id={`${ids}-pace`}
          value={props.pace}
          max={props.maxPace}
          onChange={props.onPaceChange}
        />

        <div className="flex min-h-11 items-center justify-between gap-2">
          <Label htmlFor={`${ids}-round`}>
            <Repeat aria-hidden className="size-5 text-brand" />
            {t('trip.form.roundTrip')}
          </Label>
          <Switch
            id={`${ids}-round`}
            checked={props.roundTrip}
            onCheckedChange={props.onRoundTripChange}
          />
        </div>
        {props.canSaveSettings && (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full py-1.5 whitespace-normal"
            disabled={props.savingSettings}
            onClick={props.onSaveSettings}
          >
            {props.savingSettings ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Save aria-hidden />
            )}
            {t('trip.form.saveSettings')}
          </Button>
        )}
      </FormSection>

      {/* The AI card: the key feature, so wishes and the main button form one block. */}
      <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
        <div className="space-y-1">
          <Label
            htmlFor={`${ids}-wishes`}
            className="flex items-center gap-2 text-base font-semibold"
          >
            <Sparkles aria-hidden className="size-4 text-brand" />
            {t('trip.form.wishes')}
          </Label>
          <p className="text-sm text-muted-foreground">{t('trip.form.wishesIntro')}</p>
        </div>

        <ul aria-label={t('trip.form.wishesChipsLabel')} className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full bg-card px-3"
                onClick={() => addChip(chip)}
              >
                <Plus aria-hidden className="size-3.5" />
                {chip}
              </Button>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <Textarea
            id={`${ids}-wishes`}
            value={wishes}
            rows={3}
            maxLength={MAX_WISHES_LENGTH}
            placeholder={t('trip.form.wishesPlaceholder')}
            aria-describedby={`${ids}-wishes-hint`}
            className="bg-card"
            // maxLength stops typing; slice also cuts a longer pasted text.
            onChange={(event) => setWishes(event.target.value.slice(0, MAX_WISHES_LENGTH))}
          />
          <div className="flex items-start justify-between gap-3">
            <p
              id={`${ids}-wishes-hint`}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
              {t('trip.form.privacy')}
            </p>
            {/* The counter shows only near the limit, so it does not add noise. */}
            {wishes.length >= COUNTER_FROM && (
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums',
                  wishes.length >= MAX_WISHES_LENGTH
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground',
                )}
                aria-live="polite"
              >
                {t('trip.form.wishesCount', { count: wishes.length, max: MAX_WISHES_LENGTH })}
              </span>
            )}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!props.start || props.planning}
        >
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
      </div>
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

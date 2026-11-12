import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LatLng, Stop, StopCategory } from '@/api/types'
import { useCreateStop, useDeleteStop, useUpdateStop } from '@/api/walks'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FieldError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage, parseFieldErrors } from '@/lib/fieldErrors'
import {
  MAX_STOP_MINUTES as MAX_MINUTES,
  MIN_STOP_MINUTES as MIN_MINUTES,
  minutesError,
  STOP_FIELDS,
} from '@/lib/formRules'
import { DEFAULT_STOP_MINUTES, nextStopOrder } from '@/lib/walkPayload'

const MAX_NOTE_LENGTH = 200
const MAX_NAME_LENGTH = 120
const CATEGORIES: StopCategory[] = [
  'playground',
  'toilets',
  'cafe',
  'restaurant',
  'bench',
  'water',
  'park',
  'zoo',
  'museum',
  'beach',
  'shop',
  'other',
]

interface StopEditorProps {
  walkId: number
  stops: Stop[]
  stopLabel: (stop: Stop) => string
  /** The point clicked on the map for a new stop, or null. */
  draft: LatLng | null
  adding: boolean
  onAddingChange: (adding: boolean) => void
}

export function StopEditor(props: StopEditorProps) {
  const { t } = useTranslation()
  const remove = useDeleteStop(props.walkId)
  const [deleting, setDeleting] = useState<Stop | null>(null)

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('stops.toast.deleted'))
        setDeleting(null)
      },
      onError: (error) =>
        toast.error(t('stops.toast.deleteFailed', { reason: errorMessage(t, error) })),
    })
  }

  return (
    <section aria-labelledby="stops-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stops-title" className="text-lg font-semibold">
          {t('stops.title')}
        </h2>
        {!props.adding && (
          <Button size="sm" variant="outline" onClick={() => props.onAddingChange(true)}>
            <Plus aria-hidden />
            {t('stops.add')}
          </Button>
        )}
      </div>

      {props.adding && (
        <NewStopForm
          walkId={props.walkId}
          order={nextStopOrder(props.stops)}
          draft={props.draft}
          onDone={() => props.onAddingChange(false)}
        />
      )}

      {props.stops.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('stops.empty')}</p>
      ) : (
        <ol className="space-y-2">
          {props.stops.map((stop, index) => (
            <li key={stop.id}>
              <StopRow
                // The key includes the saved values, so the row resets after a refresh.
                key={`${stop.id}-${stop.planned_minutes}-${stop.reason}`}
                walkId={props.walkId}
                stop={stop}
                number={index + 1}
                label={props.stopLabel(stop)}
                onDelete={() => setDeleting(stop)}
              />
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('stops.delete.title')}
        text={t('stops.delete.text', { name: deleting ? props.stopLabel(deleting) : '' })}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  )
}

function StopRow(props: {
  walkId: number
  stop: Stop
  number: number
  label: string
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateStop(props.walkId)
  const [minutes, setMinutes] = useState(String(props.stop.planned_minutes))
  const [note, setNote] = useState(props.stop.reason)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = minutes !== String(props.stop.planned_minutes) || note !== props.stop.reason
  const idPrefix = `stop-${props.stop.id}`

  function save(event: FormEvent) {
    event.preventDefault()
    const key = minutesError(minutes)
    if (key) {
      setErrors({
        planned_minutes: t(`stops.errors.${key}`, { min: MIN_MINUTES, max: MAX_MINUTES }),
      })
      return
    }
    setErrors({})
    update.mutate(
      { id: props.stop.id, input: { planned_minutes: Number(minutes), reason: note } },
      {
        onSuccess: () => toast.success(t('stops.toast.saved')),
        onError: (error) => {
          const parsed = parseFieldErrors(error, STOP_FIELDS)
          setErrors(parsed.fields)
          toast.error(
            parsed.general ?? t('stops.toast.saveFailed', { reason: errorMessage(t, error) }),
          )
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={save} className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium break-words">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
            {props.number}
          </span>
          {props.label}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('stops.deleteNamed', { name: props.label })}
          onClick={props.onDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-minutes`}>{t('stops.minutes')}</Label>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            inputMode="numeric"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={minutes}
            aria-invalid={Boolean(errors.planned_minutes)}
            aria-describedby={`${idPrefix}-minutes-error`}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <FieldError id={`${idPrefix}-minutes-error`} message={errors.planned_minutes} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-note`}>{t('stops.note')}</Label>
          <Input
            id={`${idPrefix}-note`}
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={`${idPrefix}-note-error`}
            onChange={(event) => setNote(event.target.value)}
          />
          <FieldError id={`${idPrefix}-note-error`} message={errors.reason} />
        </div>
      </div>
      {dirty && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={update.isPending}>
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </form>
  )
}

function NewStopForm(props: {
  walkId: number
  order: number
  draft: LatLng | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateStop(props.walkId)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StopCategory>('other')
  const [minutes, setMinutes] = useState(String(DEFAULT_STOP_MINUTES))
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!props.draft) next.lat = t('stops.errors.noPoint')
    const key = minutesError(minutes)
    if (key) next.planned_minutes = t(`stops.errors.${key}`, { min: MIN_MINUTES, max: MAX_MINUTES })
    setErrors(next)
    if (Object.keys(next).length > 0 || !props.draft) return
    create.mutate(
      {
        order: props.order,
        name: name.trim(),
        category,
        lat: props.draft.lat,
        lng: props.draft.lng,
        osm_id: '',
        planned_minutes: Number(minutes),
        reason: '',
        source: 'user',
      },
      {
        onSuccess: () => {
          toast.success(t('stops.toast.added'))
          props.onDone()
        },
        onError: (error) => {
          const parsed = parseFieldErrors(error, STOP_FIELDS)
          setErrors(parsed.fields)
          toast.error(
            parsed.general ?? t('stops.toast.addFailed', { reason: errorMessage(t, error) }),
          )
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3 rounded-lg border border-amber-400 p-3">
      <p className="text-sm" aria-live="polite">
        {props.draft ? t('stops.pointSet') : t('stops.addHint')}
      </p>
      <FieldError id="new-stop-point-error" message={errors.lat ?? errors.lng} />
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_8rem]">
        <div className="space-y-1">
          <Label htmlFor="new-stop-name">{t('stops.name')}</Label>
          <Input
            id="new-stop-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('stops.namePlaceholder')}
            aria-describedby="new-stop-name-error"
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError id="new-stop-name-error" message={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-stop-category">{t('stops.category')}</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as StopCategory)}>
            <SelectTrigger id="new-stop-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`poi.categories.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-stop-minutes">{t('stops.minutes')}</Label>
          <Input
            id="new-stop-minutes"
            type="number"
            inputMode="numeric"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={minutes}
            aria-invalid={Boolean(errors.planned_minutes)}
            aria-describedby="new-stop-minutes-error"
            onChange={(event) => setMinutes(event.target.value)}
          />
          <FieldError id="new-stop-minutes-error" message={errors.planned_minutes} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t('stops.addSubmit')}
        </Button>
      </div>
    </form>
  )
}

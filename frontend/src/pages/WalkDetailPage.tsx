import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import type { LatLng, Stop, WalkDetail, WalkUpdate } from '@/api/types'
import { useDeleteWalk, useUpdateWalk, useWalk } from '@/api/walks'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, FieldError, LoadError } from '@/components/common/States'
import { StopEditor } from '@/components/walks/StopEditor'
import { StatusChip } from '@/components/walks/WalkCard'
import { WalkMap } from '@/components/walks/WalkMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage, parseFieldErrors } from '@/lib/fieldErrors'
import { formatDistance, formatDuration } from '@/lib/format'
import { categoryLabel } from '@/lib/poiLabel'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/usePageTitle'

const MAX_NAME_LENGTH = 80
const MAX_NOTES_LENGTH = 1000
const WALK_FIELDS = ['name', 'notes', 'status', 'rating'] as const

export function WalkDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return <WalkNotFound />
  // The key gives every walk a fresh state (edits, the stop draft).
  return <WalkDetailContent key={id} id={id} />
}

function WalkNotFound() {
  const { t } = useTranslation()
  return (
    <EmptyState
      title={t('walkDetail.notFound.title')}
      text={t('walkDetail.notFound.text')}
      action={
        <Button asChild variant="outline">
          <Link to="/walks">{t('walkDetail.back')}</Link>
        </Button>
      }
    />
  )
}

function WalkDetailContent({ id }: { id: number }) {
  const { t } = useTranslation()
  const walk = useWalk(id)

  if (walk.isPending) {
    return (
      <div className="space-y-4" role="status" aria-label={t('common.loading')}>
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl sm:h-96" />
      </div>
    )
  }
  if (walk.isError) {
    if (walk.error instanceof ApiError && walk.error.status === 404) return <WalkNotFound />
    return <LoadError error={walk.error} onRetry={() => walk.refetch()} />
  }
  return <WalkView walk={walk.data} />
}

function WalkView({ walk }: { walk: WalkDetail }) {
  const { t, i18n } = useTranslation()
  usePageTitle(walk.name)
  const navigate = useNavigate()
  const remove = useDeleteWalk(walk.id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<LatLng | null>(null)

  const stopLabel = (stop: Stop) => stop.name || categoryLabel(t, stop.category)
  const stats = [
    {
      key: 'distance',
      label: t('walks.card.distance'),
      value: formatDistance(walk.distance_m, i18n.language),
    },
    { key: 'duration', label: t('walks.card.duration'), value: formatDuration(walk.duration_min) },
    {
      key: 'stairsAvoided',
      label: t('walks.card.stairsAvoided'),
      value: formatDistance(walk.stairs_avoided_m, i18n.language),
    },
    {
      key: 'stairsOnRoute',
      label: t('walkDetail.stairsOnRoute'),
      value: formatDistance(walk.stairs_m, i18n.language),
    },
  ]

  function changeAdding(next: boolean) {
    setAdding(next)
    setDraft(null)
  }

  function confirmDelete() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('walkDetail.toast.deleted'))
        navigate('/walks')
      },
      onError: (error) =>
        toast.error(t('walkDetail.toast.deleteFailed', { reason: errorMessage(t, error) })),
    })
  }

  return (
    <div className="space-y-5">
      <Link
        to="/walks"
        className="-ml-3 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('walkDetail.back')}
      </Link>

      <div className="space-y-2">
        <NameEditor
          // Reset the editor when the saved name changes.
          key={walk.name}
          walk={walk}
        />
        <StatusChip status={walk.status} />
      </div>

      {/* The same stats row as the planner result hero, on a plain card. */}
      <dl
        aria-label={t('walkDetail.statsLabel')}
        className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border bg-card p-5 sm:flex sm:flex-wrap"
      >
        {stats.map((stat) => (
          <div key={stat.key}>
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div
        className={cn(
          'isolate h-72 overflow-hidden rounded-2xl border sm:h-96',
          adding && 'ring-3 ring-brand',
        )}
      >
        <WalkMap
          geometry={walk.geometry}
          start={{ lat: walk.start_lat, lng: walk.start_lng }}
          end={{ lat: walk.end_lat, lng: walk.end_lng }}
          stops={walk.stops}
          stopLabel={stopLabel}
          draft={draft}
          onMapClick={adding ? setDraft : undefined}
        />
      </div>

      <StatusEditor key={`${walk.status}-${walk.rating}`} walk={walk} />

      <StopEditor
        walkId={walk.id}
        stops={walk.stops}
        stopLabel={stopLabel}
        draft={draft}
        adding={adding}
        onAddingChange={changeAdding}
      />

      <NotesEditor key={walk.notes} walk={walk} />

      {/* Destructive and rare, so it sits at the end, away from the everyday controls. */}
      <div className="flex justify-end border-t pt-5">
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 aria-hidden />
          {t('walkDetail.delete.button')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('walkDetail.delete.title')}
        text={t('walkDetail.delete.text', { name: walk.name })}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/** Shared by the name, notes and status editors: PATCH + toasts + field errors. */
function useWalkPatch(walkId: number) {
  const { t } = useTranslation()
  const update = useUpdateWalk(walkId)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function patch(input: WalkUpdate, onSuccess?: () => void) {
    setErrors({})
    update.mutate(input, {
      onSuccess: () => {
        toast.success(t('walkDetail.toast.saved'))
        onSuccess?.()
      },
      onError: (error) => {
        const parsed = parseFieldErrors(error, WALK_FIELDS)
        setErrors(parsed.fields)
        toast.error(
          parsed.general ?? t('walkDetail.toast.saveFailed', { reason: errorMessage(t, error) }),
        )
      },
    })
  }
  return { patch, errors, setErrors, pending: update.isPending }
}

function NameEditor({ walk }: { walk: WalkDetail }) {
  const { t } = useTranslation()
  const { patch, errors, setErrors, pending } = useWalkPatch(walk.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(walk.name)

  if (!editing) {
    return (
      <div className="flex min-w-0 items-start gap-1">
        <h1 className="min-w-0 pt-1.5 text-2xl font-semibold tracking-[-0.01em] break-words">
          {walk.name}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('walkDetail.editName')}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
        </Button>
      </div>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setErrors({ name: t('walkForm.errors.nameRequired') })
      return
    }
    patch({ name: name.trim() }, () => setEditing(false))
  }

  return (
    <form noValidate onSubmit={submit} className="w-full max-w-xl space-y-1.5">
      <Label htmlFor="walk-name-edit">{t('walkForm.name')}</Label>
      {/* On a phone the buttons go under the input; from `sm` they sit next to it. */}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <Input
          id="walk-name-edit"
          autoFocus
          value={name}
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="walk-name-edit-error"
          className="w-full sm:flex-1"
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName(walk.name)
            setErrors({})
            setEditing(false)
          }}
        >
          {t('common.cancel')}
        </Button>
      </div>
      <FieldError id="walk-name-edit-error" message={errors.name} />
    </form>
  )
}

function NotesEditor({ walk }: { walk: WalkDetail }) {
  const { t } = useTranslation()
  const { patch, errors, pending } = useWalkPatch(walk.id)
  const [notes, setNotes] = useState(walk.notes)
  const dirty = notes !== walk.notes

  function submit(event: FormEvent) {
    event.preventDefault()
    patch({ notes })
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-2 rounded-2xl border bg-card p-5">
      <Label htmlFor="walk-notes" className="text-lg font-semibold">
        {t('walkDetail.notes.label')}
      </Label>
      <Textarea
        id="walk-notes"
        rows={4}
        value={notes}
        maxLength={MAX_NOTES_LENGTH}
        placeholder={t('walkDetail.notes.placeholder')}
        aria-invalid={Boolean(errors.notes)}
        aria-describedby="walk-notes-count walk-notes-error"
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <p id="walk-notes-count" className="text-sm text-muted-foreground tabular-nums">
          {t('walkDetail.notes.count', { count: notes.length, max: MAX_NOTES_LENGTH })}
        </p>
        <Button type="submit" variant="secondary" disabled={!dirty || pending}>
          {pending ? t('common.saving') : t('walkDetail.notes.save')}
        </Button>
      </div>
      <FieldError id="walk-notes-error" message={errors.notes} />
    </form>
  )
}

function StatusEditor({ walk }: { walk: WalkDetail }) {
  const { t } = useTranslation()
  const { patch, errors, pending } = useWalkPatch(walk.id)
  const [rating, setRating] = useState<number | null>(walk.rating)
  const done = walk.status === 'done'

  return (
    <section aria-labelledby="status-title" className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 id="status-title" className="text-lg font-semibold">
        {t('walkDetail.status.title')}
      </h2>
      <RatingInput value={rating} onChange={setRating} />
      <FieldError id="walk-rating-error" message={errors.rating ?? errors.status} />
      <div className="flex flex-wrap gap-2">
        {done ? (
          <>
            <Button
              disabled={pending || rating === null || rating === walk.rating}
              onClick={() => patch({ rating })}
            >
              {t('walkDetail.status.saveRating')}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => patch({ status: 'planned' })}
            >
              {t('walkDetail.status.markPlanned')}
            </Button>
          </>
        ) : (
          <Button
            disabled={pending || rating === null}
            onClick={() => patch({ status: 'done', rating })}
          >
            {t('walkDetail.status.markDone')}
          </Button>
        )}
      </div>
      {!done && rating === null && (
        <p className="text-sm text-muted-foreground">{t('walkDetail.status.rateFirst')}</p>
      )}
    </section>
  )
}

function RatingInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={t('walkDetail.status.rating')} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = value !== null && star <= value
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={t('walks.rating.value', { value: star })}
            className="flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => onChange(star)}
          >
            <Star
              aria-hidden
              className={cn(
                'size-7',
                active ? 'fill-sage-500 text-sage-500' : 'text-muted-foreground',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

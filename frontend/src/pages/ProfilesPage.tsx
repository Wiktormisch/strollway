import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateProfile, useDeleteProfile, useProfiles, useUpdateProfile } from '@/api/profiles'
import type { FamilyProfile, ProfileInput } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, LoadError } from '@/components/common/States'
import { ProfileForm } from '@/components/profiles/ProfileForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, NO_ERRORS, parseFieldErrors, type FormErrors } from '@/lib/fieldErrors'
import { PROFILE_FIELDS } from '@/lib/formRules'

/** null = the form is closed, "new" = creating, a profile = editing it. */
type Editing = null | 'new' | FamilyProfile

export function ProfilesPage() {
  const { t } = useTranslation()
  const profiles = useProfiles()
  const create = useCreateProfile()
  const update = useUpdateProfile()
  const remove = useDeleteProfile()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<FamilyProfile | null>(null)
  const [formErrors, setFormErrors] = useState<FormErrors>(NO_ERRORS)

  function openForm(value: Editing) {
    setFormErrors(NO_ERRORS)
    setEditing(value)
  }

  function onSaveError(error: unknown) {
    const parsed = parseFieldErrors(error, PROFILE_FIELDS)
    setFormErrors(parsed)
    toast.error(
      parsed.general ?? t('profiles.toast.saveFailed', { reason: errorMessage(t, error) }),
    )
  }

  function save(input: ProfileInput) {
    setFormErrors(NO_ERRORS)
    const done = {
      onSuccess: () => {
        toast.success(t('profiles.toast.saved'))
        setEditing(null)
      },
      onError: onSaveError,
    }
    if (editing && editing !== 'new') update.mutate({ id: editing.id, input }, done)
    else create.mutate(input, done)
  }

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('profiles.toast.deleted'))
        setDeleting(null)
      },
      onError: (error) =>
        toast.error(t('profiles.toast.deleteFailed', { reason: errorMessage(t, error) })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('pages.profiles.title')}</h1>
        <Button onClick={() => openForm('new')}>
          <Plus aria-hidden />
          {t('profiles.new')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('profiles.intro')}</p>

      {profiles.isPending && (
        <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {profiles.isError && <LoadError error={profiles.error} onRetry={() => profiles.refetch()} />}
      {profiles.data?.length === 0 && (
        <EmptyState title={t('profiles.empty.title')} text={t('profiles.empty.text')} />
      )}
      {profiles.data && profiles.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {profiles.data.map((profile) => (
            <li key={profile.id}>
              <ProfileCard
                profile={profile}
                onEdit={() => openForm(profile)}
                onDelete={() => setDeleting(profile)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('profiles.new') : t('profiles.edit')}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <ProfileForm
              // A new key resets the form state when another profile is opened.
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              submitting={create.isPending || update.isPending}
              serverErrors={formErrors.fields}
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('profiles.delete.title')}
        text={t('profiles.delete.text', { name: deleting?.name ?? '' })}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: FamilyProfile
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium break-words">{profile.name}</h2>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('profiles.editNamed', { name: profile.name })}
              onClick={onEdit}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('profiles.deleteNamed', { name: profile.name })}
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label={t('profiles.form.ages')}>
          {profile.children_ages.map((age, index) => (
            <li key={index} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">
              {t('profiles.ageChip', { age })}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {t(`profiles.wheels.${profile.wheels}`)} · {t(`profiles.pace.${profile.pace}`)}
        </p>
      </CardContent>
    </Card>
  )
}

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { FamilyProfile, Pace, ProfileInput, Wheels } from '@/api/types'
import { FieldError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ageError, MAX_CHILD_AGE, MAX_CHILDREN } from '@/lib/formRules'

const MAX_NAME_LENGTH = 60
const WHEELS: Wheels[] = ['stroller', 'kid_bike', 'none']
const PACES: Pace[] = ['relaxed', 'normal']

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
  const [pace, setPace] = useState<Pace>(props.initial?.pace ?? 'relaxed')
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})

  // A field error typed by the user is newer than the last server answer, so it wins.
  const errors = { ...props.serverErrors, ...clientErrors }

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
    if (ages.length === 0) next.children_ages = t('profiles.form.errors.noChildren')
    setClientErrors(next)
    if (Object.keys(next).length > 0) return
    props.onSubmit({ name: name.trim(), children_ages: ages, wheels, pace })
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="profile-wheels">{t('profiles.form.wheels')}</Label>
          <Select value={wheels} onValueChange={(value) => setWheels(value as Wheels)}>
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
        <div className="space-y-1.5">
          <Label htmlFor="profile-pace">{t('profiles.form.pace')}</Label>
          <Select value={pace} onValueChange={(value) => setPace(value as Pace)}>
            <SelectTrigger id="profile-pace" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PACES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`profiles.pace.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="profile-pace-error" message={errors.pace} />
        </div>
      </div>

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

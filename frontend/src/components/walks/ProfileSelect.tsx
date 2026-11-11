import { useTranslation } from 'react-i18next'
import type { FamilyProfile } from '@/api/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Radix Select does not allow an empty string as a value, so "no profile" has its own value.
const NO_PROFILE = 'none'

interface ProfileSelectProps {
  id: string
  profiles: FamilyProfile[]
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}

export function ProfileSelect(props: ProfileSelectProps) {
  const { t } = useTranslation()
  return (
    <Select
      value={props.value === null ? NO_PROFILE : String(props.value)}
      disabled={props.disabled}
      onValueChange={(value) => props.onChange(value === NO_PROFILE ? null : Number(value))}
    >
      <SelectTrigger id={props.id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_PROFILE}>{t('walkForm.noProfile')}</SelectItem>
        {props.profiles.map((profile) => (
          <SelectItem key={profile.id} value={String(profile.id)}>
            {profile.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

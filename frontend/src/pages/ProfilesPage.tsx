import { useTranslation } from 'react-i18next'
import { Placeholder } from './Placeholder'

export function ProfilesPage() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('pages.profiles.title')}>
      <p className="text-muted-foreground">{t('pages.profiles.placeholder')}</p>
    </Placeholder>
  )
}

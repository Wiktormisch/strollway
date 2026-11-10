import { useTranslation } from 'react-i18next'
import { Placeholder } from './Placeholder'

export function WalksPage() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('pages.walks.title')}>
      <p className="text-muted-foreground">{t('pages.walks.placeholder')}</p>
    </Placeholder>
  )
}

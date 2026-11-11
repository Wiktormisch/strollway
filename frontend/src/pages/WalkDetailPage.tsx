import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Placeholder } from './Placeholder'

export function WalkDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  return (
    <Placeholder title={t('pages.walkDetail.title', { id })}>
      <p className="text-muted-foreground">{t('pages.walkDetail.placeholder')}</p>
    </Placeholder>
  )
}

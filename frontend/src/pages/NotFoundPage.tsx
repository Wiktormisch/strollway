import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Placeholder } from './Placeholder'
import { usePageTitle } from '@/lib/usePageTitle'

export function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.notFound.title'))
  return (
    <Placeholder title={t('pages.notFound.title')}>
      <Link to="/" className="underline">
        {t('pages.notFound.back')}
      </Link>
    </Placeholder>
  )
}

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

export function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.notFound.title'))
  return (
    <EmptyState
      title={t('pages.notFound.title')}
      titleAs="h1"
      action={
        <Button asChild variant="secondary">
          <Link to="/">{t('pages.notFound.back')}</Link>
        </Button>
      }
    />
  )
}

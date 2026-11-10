import { useTranslation } from 'react-i18next'
import { HealthStatus } from '@/components/HealthStatus'
import { Placeholder } from './Placeholder'

export function PlannerPage() {
  const { t } = useTranslation()
  return (
    <Placeholder title={t('pages.planner.title')}>
      <p className="text-muted-foreground">{t('pages.planner.placeholder')}</p>
      <HealthStatus />
    </Placeholder>
  )
}

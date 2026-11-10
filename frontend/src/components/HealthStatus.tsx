import { useTranslation } from 'react-i18next'
import { useHealth } from '@/api/health'

export function HealthStatus() {
  const { t } = useTranslation()
  const { data, error, isPending } = useHealth()

  let text: string
  if (isPending) text = t('health.loading')
  else if (error) text = t('health.error', { message: error.message })
  else text = data.status === 'ok' ? t('health.ok') : data.status

  return (
    <section aria-labelledby="health-title" className="rounded-lg border p-4">
      <h2 id="health-title" className="text-sm font-medium text-muted-foreground">
        {t('health.title')}
      </h2>
      <p role="status" className={error ? 'text-destructive' : undefined}>
        {text}
      </p>
    </section>
  )
}

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets the browser tab title to "<page> · StrollWay". An empty title shows the app name only. */
export function usePageTitle(title: string) {
  const { t } = useTranslation()
  const app = t('app.name')
  useEffect(() => {
    document.title = title ? `${title} · ${app}` : app
  }, [title, app])
}

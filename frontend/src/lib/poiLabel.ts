import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { Poi } from '@/api/types'

export function categoryLabel(t: TFunction, category: string): string {
  return t(`poi.categories.${category}`, { defaultValue: t('poi.categories.other') })
}

/** The name, or the category label when OSM has no name (benches, playgrounds). */
export function usePoiLabel() {
  const { t } = useTranslation()
  return (poi: Pick<Poi, 'name' | 'category'>) => poi.name ?? categoryLabel(t, poi.category)
}

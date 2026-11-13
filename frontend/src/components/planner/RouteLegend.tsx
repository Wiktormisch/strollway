import { useTranslation } from 'react-i18next'
// The samples use the same colours as the lines on the map. A CSS style (not the SVG
// attribute) can read var(), so the legend follows the theme without JavaScript.
const ITEMS = [
  { key: 'route', stroke: 'var(--route)', width: 5, dash: undefined },
  { key: 'baseline', stroke: 'var(--muted-foreground)', width: 3, dash: '5 5' },
  { key: 'stairs', stroke: 'var(--stairs)', width: 6, dash: undefined },
] as const

export function RouteLegend() {
  const { t } = useTranslation()
  return (
    <ul aria-label={t('planner.legend.title')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {ITEMS.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <svg aria-hidden width="28" height="8">
            <line
              x1="0"
              y1="4"
              x2="28"
              y2="4"
              style={{ stroke: item.stroke }}
              strokeWidth={item.width}
              strokeDasharray={item.dash}
            />
          </svg>
          {t(`planner.legend.${item.key}`)}
        </li>
      ))}
    </ul>
  )
}

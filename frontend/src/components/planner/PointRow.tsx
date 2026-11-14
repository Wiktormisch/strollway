import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { LatLng } from '@/api/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PointRowProps {
  badge: 'A' | 'B'
  /** "Start", "End": the name of the point. */
  name: string
  point: LatLng | null
  /** A demo name to show instead of "Point on the map". */
  demoName?: string | null
  onChange: () => void
  onClear: () => void
}

/**
 * One route point (DESIGN.md section 5). It never shows raw coordinates in the label:
 * they are in a "Details" line that is closed by default. No reverse geocoding (AGENTS.md rule 5).
 */
export function PointRow({ badge, name, point, demoName, onChange, onClear }: PointRowProps) {
  const { t } = useTranslation()
  const value = point ? (demoName ?? t('planner.point.onMap')) : t('planner.point.notSet')

  return (
    <div className="rounded-lg border bg-card p-2 pl-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            badge === 'A' ? 'bg-brand text-brand-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{name}</p>
          <p className={cn('truncate font-medium', !point && 'text-muted-foreground')}>{value}</p>
        </div>
        {/* The visible word is "Change"; the hidden part names the point for screen readers. */}
        <Button type="button" variant="ghost" className="px-3 text-brand" onClick={onChange}>
          {t('planner.point.change')}
          <span className="sr-only">: {name}</span>
        </Button>
        {point && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('planner.form.clear', { point: name })}
            title={t('planner.form.clear', { point: name })}
            onClick={onClear}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      {point && (
        // <details> opens and closes with the keyboard and needs no state.
        <details className="mt-1 ml-10 text-sm text-muted-foreground">
          <summary className="cursor-pointer rounded-sm py-1 hover:text-foreground">
            {t('planner.point.details')}
          </summary>
          <p className="tabular-nums">
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
        </details>
      )}
    </div>
  )
}

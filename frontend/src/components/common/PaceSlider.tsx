import { useTranslation } from 'react-i18next'
import { Footprints } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { formatKmh } from '@/lib/format'
import { PACE_MAX_KMH, PACE_MIN_KMH, PACE_STEP_KMH } from '@/lib/pace'

interface PaceSliderProps {
  id: string
  value: number
  /** Lower than PACE_MAX_KMH for a stroller. */
  max: number
  onChange: (kmh: number) => void
}

/** "Slow - fast" pace slider with the km/h value next to it (audit idea 3). */
export function PaceSlider({ id, value, max, onChange }: PaceSliderProps) {
  const { t, i18n } = useTranslation()
  const text = formatKmh(value, i18n.language)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          <Footprints aria-hidden className="size-5 text-brand" />
          {t('pace.label')}
        </Label>
        <span className="text-sm font-medium tabular-nums">{text}</span>
      </div>
      {/* A native range input, like the trip time slider: keyboard and screen reader support. */}
      <input
        id={id}
        type="range"
        min={PACE_MIN_KMH}
        max={max}
        step={PACE_STEP_KMH}
        value={value}
        aria-valuetext={text}
        aria-describedby={max < PACE_MAX_KMH ? `${id}-hint` : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-primary"
      />
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
        <span>{t('pace.slow')}</span>
        <span>{t('pace.fast')}</span>
      </div>
      {max < PACE_MAX_KMH && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t('pace.strollerLimit', { max: formatKmh(max, i18n.language) })}
        </p>
      )}
    </div>
  )
}

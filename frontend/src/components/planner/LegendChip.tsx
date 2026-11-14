import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RouteLegend } from './RouteLegend'

/**
 * The map legend as a chip (DESIGN.md section 8). Phones: a small "i" button that opens it,
 * because an open chip covers route points. 768 px and more: always open.
 */
export function LegendChip() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const label = t(open ? 'planner.legend.hide' : 'planner.legend.show')

  return (
    <div className="absolute top-[9.25rem] left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] items-start gap-2 md:top-auto md:bottom-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="map-legend"
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-float-edge bg-card text-foreground shadow-float hover:bg-muted md:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Info aria-hidden className="size-5" />}
      </button>
      <div
        id="map-legend"
        className={cn(
          'pointer-events-none rounded-2xl border border-float-edge bg-card px-3 py-2 shadow-float md:block',
          !open && 'hidden',
        )}
      >
        <RouteLegend />
      </div>
    </div>
  )
}

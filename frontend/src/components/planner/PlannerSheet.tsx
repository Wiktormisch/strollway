import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlannerSheetProps {
  open: boolean
  onToggle: () => void
  /** Lets the page measure the sheet, so the map can fit routes above it. */
  sheetRef?: Ref<HTMLElement>
  children: ReactNode
}

/**
 * The planner panel (DESIGN.md section 6). Phones: a bottom sheet over the map with a visual
 * handle; the whole header opens and closes it (no dragging). 768 px and more: a 400 px side
 * panel that is always open.
 */
export function PlannerSheet({ open, onToggle, sheetRef, children }: PlannerSheetProps) {
  const { t } = useTranslation()
  return (
    <section
      ref={sheetRef}
      aria-labelledby="planner-title"
      className={cn(
        'absolute inset-x-0 bottom-0 z-10 flex max-h-[65%] flex-col rounded-t-3xl border-t bg-card shadow-[0_-8px_24px_rgb(0_0_0/0.12)]',
        'md:static md:z-auto md:h-full md:max-h-none md:w-100 md:shrink-0 md:rounded-none md:border-t-0 md:border-r md:shadow-[8px_0_24px_rgb(0_0_0/0.08)]',
      )}
    >
      {/* Phones: one big button (the handle and the title). The h1 stays outside the button,
          so it is still a heading for screen readers. */}
      <div className="relative px-4 pt-2 pb-2 md:pt-4">
        <span
          aria-hidden
          className="mx-auto mb-1 block h-1.5 w-10 rounded-full bg-border md:hidden"
        />
        <div className="flex min-h-11 items-center justify-between gap-2">
          <h1 id="planner-title" className="text-xl font-semibold tracking-tight">
            {t('pages.planner.title')}
          </h1>
          <button
            type="button"
            // `after:absolute after:inset-0` stretches the click area over the whole header.
            className="flex size-11 items-center justify-center rounded-full after:absolute after:inset-0 after:content-[''] hover:bg-muted md:hidden"
            aria-expanded={open}
            aria-controls="planner-panel-body"
            aria-label={t(open ? 'planner.sheet.collapse' : 'planner.sheet.expand')}
            onClick={onToggle}
          >
            {open ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="planner-panel-body"
        className={cn('min-h-0 flex-1 overflow-y-auto px-4 pb-4', !open && 'hidden md:block')}
      >
        {children}
        <p className="mt-4 text-xs text-muted-foreground">{t('planner.dataArea')}</p>
      </div>
    </section>
  )
}

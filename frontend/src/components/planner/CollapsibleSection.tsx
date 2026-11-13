import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  id: string
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A card that opens and closes (DESIGN.md section 8: places and transit stops).
 * The disclosure pattern: a button inside the heading. Unlike <summary>, it keeps the heading
 * a heading for screen readers, and `aria-expanded` says if the section is open.
 */
export function CollapsibleSection({ id, title, defaultOpen, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const bodyId = useId()
  return (
    <section aria-labelledby={id} className="rounded-2xl border bg-card">
      <h2 id={id} className="font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left hover:bg-muted"
        >
          {title}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-5 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  )
}

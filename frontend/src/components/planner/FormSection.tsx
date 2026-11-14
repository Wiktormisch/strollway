import type { ReactNode } from 'react'

/** One group of planner form fields, split from the group above by a thin line. */
export function FormSection({ children }: { children: ReactNode }) {
  return <div className="space-y-3 border-t border-border pt-4">{children}</div>
}

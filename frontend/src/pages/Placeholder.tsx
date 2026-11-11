import type { ReactNode } from 'react'

type Props = { title: string; children?: ReactNode }

/** A simple page frame used until the real pages are built. */
export function Placeholder({ title, children }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  )
}

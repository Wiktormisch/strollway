// The app logo: the same drawing as public/favicon.svg, with theme colours instead of hex.
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7', className)}>
      <rect width="32" height="32" rx="7" className="fill-brand" />
      <path
        d="M7 21c4-1 5-8 9-8s4 6 9 5"
        fill="none"
        className="stroke-white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.1 4.5"
      />
      <circle cx="7" cy="21" r="2.5" className="fill-white" />
      <circle cx="25" cy="18" r="2.5" className="fill-brand-soft" />
    </svg>
  )
}

import type { SVGProps } from 'react'

/** Steps in the Lucide style (24 px grid, 2 px stroke); Lucide has no stairs icon. */
export function StairsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 21h5v-5h5v-5h5V6h3" />
    </svg>
  )
}

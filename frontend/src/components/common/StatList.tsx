import {
  Clock,
  Flame,
  MapPin,
  Route,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** One icon per kind of number, so the same stat looks the same on every screen. */
const ICONS = {
  distance: Route,
  time: Clock,
  kcal: Flame,
  places: MapPin,
  stairsAvoided: ShieldCheck,
  stairsOnRoute: TriangleAlert,
} satisfies Record<string, LucideIcon>

export type StatKind = keyof typeof ICONS

export interface Stat {
  kind: StatKind
  label: string
  value: string
}

interface StatListProps {
  stats: Stat[]
  label?: string
  size?: 'md' | 'lg'
  className?: string
}

/** A row of route numbers as a description list: each stat has a name (dt) and a value (dd). */
export function StatList({ stats, label, size = 'lg', className }: StatListProps) {
  return (
    <dl aria-label={label} className={cn('grid grid-cols-2 gap-x-4 gap-y-3', className)}>
      {stats.map((stat) => {
        const Icon = ICONS[stat.kind]
        return (
          <div key={stat.kind} className="min-w-0">
            <dt className="flex items-start gap-1.5 text-sm text-muted-foreground">
              {/* Decorative: the label next to it already says what the number is. */}
              {/* mt-0.5 centres the 16px icon on the first 20px text line, also when it wraps. */}
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              {stat.label}
            </dt>
            <dd
              className={cn(
                'pl-5.5 font-semibold tabular-nums',
                size === 'lg' ? 'text-lg' : 'text-base',
              )}
            >
              {stat.value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

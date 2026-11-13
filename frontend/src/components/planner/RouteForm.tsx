import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import type { LatLng } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DEMO_ROUTES, type DemoRoute } from '@/constants/demoRoutes'
import { demoRouteOf } from '@/lib/planner'
import { PointRow } from './PointRow'

interface RouteFormProps {
  start: LatLng | null
  end: LatLng | null
  avoidStairs: boolean
  planning: boolean
  /** Profile select, placed under the points (DESIGN.md section 8). */
  profileField: ReactNode
  onAvoidStairsChange: (value: boolean) => void
  onClear: (which: 'start' | 'end') => void
  onUseMapCenter: (which: 'start' | 'end') => void
  onDemo: (route: DemoRoute) => void
  onPlan: () => void
}

export function RouteForm(props: RouteFormProps) {
  const { t } = useTranslation()
  const switchId = useId() // a unique id that links the <label> to the switch

  function row(which: 'start' | 'end') {
    const demo = demoRouteOf(props[which], which)
    return (
      <PointRow
        badge={which === 'start' ? 'A' : 'B'}
        name={t(`planner.form.${which}`)}
        point={props[which]}
        demoName={demo && t(`planner.demo.${demo}`)}
        onChange={() => props.onUseMapCenter(which)}
        onClear={() => props.onClear(which)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('planner.form.hint')}</p>
      <div className="space-y-2">
        {row('start')}
        {row('end')}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('planner.form.demoTitle')}</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ROUTES.map((route) => (
            <Button key={route.id} variant="demo" size="sm" onClick={() => props.onDemo(route)}>
              <Play aria-hidden />
              {t(`planner.demo.${route.id}`)}
            </Button>
          ))}
        </div>
      </div>

      {props.profileField}

      <div className="flex min-h-11 items-center justify-between gap-2">
        <label htmlFor={switchId} className="text-sm font-medium">
          {t('planner.form.avoidStairs')}
        </label>
        <Switch
          id={switchId}
          checked={props.avoidStairs}
          onCheckedChange={props.onAvoidStairsChange}
        />
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={props.onPlan}
        disabled={!props.start || !props.end || props.planning}
      >
        {props.planning ? t('planner.form.planning') : t('planner.form.plan')}
      </Button>
    </div>
  )
}

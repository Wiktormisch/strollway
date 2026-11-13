import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Crosshair, X } from 'lucide-react'
import type { LatLng } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DEMO_ROUTES, type DemoRoute } from '@/constants/demoRoutes'

interface RouteFormProps {
  start: LatLng | null
  end: LatLng | null
  avoidStairs: boolean
  planning: boolean
  onAvoidStairsChange: (value: boolean) => void
  onClear: (which: 'start' | 'end') => void
  onUseMapCenter: (which: 'start' | 'end') => void
  onDemo: (route: DemoRoute) => void
  onPlan: () => void
}

export function RouteForm(props: RouteFormProps) {
  const { t } = useTranslation()
  const switchId = useId() // a unique id that links the <label> to the switch

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('planner.form.hint')}</p>
      <PointRow which="start" point={props.start} {...props} />
      <PointRow which="end" point={props.end} {...props} />

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t('planner.form.demoTitle')}</p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ROUTES.map((route) => (
            <Button
              key={route.id}
              variant="secondary"
              size="sm"
              onClick={() => props.onDemo(route)}
            >
              {t(`planner.demo.${route.id}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
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

function PointRow({
  which,
  point,
  onClear,
  onUseMapCenter,
}: { which: 'start' | 'end'; point: LatLng | null } & Pick<
  RouteFormProps,
  'onClear' | 'onUseMapCenter'
>) {
  const { t } = useTranslation()
  const name = t(`planner.form.${which}`)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={
          'flex size-6 items-center justify-center rounded-full text-xs font-bold ' +
          (which === 'start'
            ? 'bg-brand text-brand-foreground'
            : 'bg-primary text-primary-foreground')
        }
      >
        {which === 'start' ? 'A' : 'B'}
      </span>
      <span className="flex-1">
        {name}:{' '}
        {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : t('planner.form.notSet')}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('planner.form.useCenter', { point: name })}
        title={t('planner.form.useCenter', { point: name })}
        onClick={() => onUseMapCenter(which)}
      >
        <Crosshair aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('planner.form.clear', { point: name })}
        title={t('planner.form.clear', { point: name })}
        onClick={() => onClear(which)}
        disabled={!point}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}

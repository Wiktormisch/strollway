import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRoutePlan, useRoutePlan } from '@/api/planning'
import type { LatLng, RoutePlanRequest } from '@/api/types'
import { HealthStatus } from '@/components/HealthStatus'
import { DemoModeBanner, ErrorBanner } from '@/components/planner/Banners'
import { DetourCard, DetourCardSkeleton } from '@/components/planner/DetourCard'
import { MapView } from '@/components/planner/MapView'
import { PlacesSection } from '@/components/planner/PlacesSection'
import { RouteForm } from '@/components/planner/RouteForm'
import { RouteLegend } from '@/components/planner/RouteLegend'
import { TransitStops } from '@/components/planner/TransitStops'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_MAP_CENTER, type DemoRoute } from '@/constants/demoRoutes'
import { usePoiLabel } from '@/lib/poiLabel'
import { nextPoints, visiblePois, type PlannerPoints } from '@/lib/planner'
import { cn } from '@/lib/utils'

export function PlannerPage() {
  const { t } = useTranslation()
  const poiLabel = usePoiLabel()
  const queryClient = useQueryClient()

  const [points, setPoints] = useState<PlannerPoints>({ start: null, end: null })
  const [avoidStairs, setAvoidStairs] = useState(true)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(true)
  // A ref, not state: the map centre changes often and nothing needs to re-render for it.
  const mapCenter = useRef<LatLng>(DEFAULT_MAP_CENTER)

  // The request is derived from the inputs, and the query reads the cache by it.
  // So a changed input hides an old result, and going back shows it again with no request.
  const request: RoutePlanRequest | null =
    points.start && points.end
      ? { start: points.start, end: points.end, avoid_stairs: avoidStairs }
      : null
  const query = useRoutePlan(request)
  const result = query.data
  const fetching = query.isFetching

  function plan() {
    if (request) fetchRoutePlan(queryClient, request)
  }

  /** "Try again" and "Load places again": always ask the server, even with a fresh cache. */
  function refetchPlan() {
    if (request) fetchRoutePlan(queryClient, request, { force: true })
  }

  function toggleCategory(category: string) {
    setHidden((previous) => {
      const next = new Set(previous)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function pickDemo(route: DemoRoute) {
    setPoints({ start: route.start, end: route.end })
    fetchRoutePlan(queryClient, { start: route.start, end: route.end, avoid_stairs: avoidStairs })
  }

  return (
    <div className="relative h-full md:flex">
      <section
        aria-labelledby="planner-title"
        className={cn(
          'absolute inset-x-0 bottom-0 z-1000 flex max-h-[65%] flex-col rounded-t-2xl border-t bg-background shadow-2xl',
          'md:static md:z-auto md:h-full md:max-h-none md:w-100 md:shrink-0 md:rounded-none md:border-t-0 md:border-r md:shadow-none',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h1 id="planner-title" className="text-lg font-semibold">
            {t('pages.planner.title')}
          </h1>
          <button
            type="button"
            className="rounded-md p-1 hover:bg-muted md:hidden"
            aria-expanded={sheetOpen}
            aria-controls="planner-panel-body"
            aria-label={t(sheetOpen ? 'planner.sheet.collapse' : 'planner.sheet.expand')}
            onClick={() => setSheetOpen((open) => !open)}
          >
            {sheetOpen ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          </button>
        </div>

        <div
          id="planner-panel-body"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-4 pb-4',
            !sheetOpen && 'hidden md:block',
          )}
        >
          <Tabs defaultValue="route">
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="route">{t('planner.tabs.route')}</TabsTrigger>
              {/* Stage 7 adds the trip idea mode. */}
              <TabsTrigger value="trip" disabled>
                {t('planner.tabs.trip')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="route" className="space-y-4">
              <RouteForm
                start={points.start}
                end={points.end}
                avoidStairs={avoidStairs}
                planning={fetching}
                onAvoidStairsChange={setAvoidStairs}
                onClear={(which) => setPoints({ ...points, [which]: null })}
                onUseMapCenter={(which) => setPoints({ ...points, [which]: mapCenter.current })}
                onDemo={pickDemo}
                onPlan={plan}
              />

              {/* Only the short status is a live region, so screen readers skip the lists. */}
              <div aria-live="polite" className="space-y-4">
                {fetching && !result && <DetourCardSkeleton />}
                {query.isError && !fetching && (
                  <ErrorBanner error={query.error} onRetry={refetchPlan} />
                )}
                {!fetching && !result && !query.isError && (
                  <p className="text-sm text-muted-foreground">{t('planner.empty')}</p>
                )}
                {result && request && (
                  <>
                    <DemoModeBanner source={result.source} />
                    <DetourCard plan={result} avoidStairs={request.avoid_stairs} />
                  </>
                )}
              </div>
              {result && (
                <>
                  <RouteLegend />
                  <PlacesSection
                    plan={result}
                    hidden={hidden}
                    onToggle={toggleCategory}
                    onReload={refetchPlan}
                    reloading={fetching}
                  />
                  <TransitStops stops={result.transit_stops} />
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <HealthStatus />
          </div>
        </div>
      </section>

      {/* `isolate` keeps the Leaflet z-indexes inside the map, under the bottom sheet. */}
      <div className="isolate h-full md:flex-1">
        <MapView
          start={points.start}
          end={points.end}
          plan={result}
          pois={result ? visiblePois(result.pois, hidden) : []}
          poiLabel={poiLabel}
          pointLabels={{ start: t('planner.form.start'), end: t('planner.form.end') }}
          onMapClick={(click) => setPoints(nextPoints(points, click))}
          onCenterChange={(center) => {
            mapCenter.current = center
          }}
        />
      </div>
    </div>
  )
}

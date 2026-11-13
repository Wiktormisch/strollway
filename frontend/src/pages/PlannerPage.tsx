import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRoutePlan, useRoutePlan, useTripIdea } from '@/api/planning'
import { useProfiles } from '@/api/profiles'
import type { LatLng, RoutePlanRequest, TripIdeaRequest } from '@/api/types'
import { StopsTimeline } from '@/components/planner/StopsTimeline'
import { TRIP_FORM_ID, TripIdeaForm } from '@/components/planner/TripIdeaForm'
import { TripSummary } from '@/components/planner/TripSummary'
import { DEMO_TRIP_START, remainingStops, tripTotals } from '@/lib/trip'
import { buildTripWalkPayload, buildWalkPayload } from '@/lib/walkPayload'
import { HealthStatus } from '@/components/HealthStatus'
import { DemoModeBanner, ErrorBanner } from '@/components/planner/Banners'
import { DetourCard, DetourCardSkeleton } from '@/components/planner/DetourCard'
import { MapView } from '@/components/planner/MapView'
import { PlacesSection } from '@/components/planner/PlacesSection'
import { RouteForm } from '@/components/planner/RouteForm'
import { RouteLegend } from '@/components/planner/RouteLegend'
import { TransitStops } from '@/components/planner/TransitStops'
import { Label } from '@/components/ui/label'
import { ProfileSelect } from '@/components/walks/ProfileSelect'
import { SaveWalkDialog } from '@/components/walks/SaveWalkDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_MAP_CENTER, type DemoRoute } from '@/constants/demoRoutes'
import { usePoiLabel } from '@/lib/poiLabel'
import { nextPoints, visiblePois, type PlannerPoints } from '@/lib/planner'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/usePageTitle'

export function PlannerPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.planner.title'))
  const poiLabel = usePoiLabel()
  const queryClient = useQueryClient()

  const [points, setPoints] = useState<PlannerPoints>({ start: null, end: null })
  const [avoidStairs, setAvoidStairs] = useState(true)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(true)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const profiles = useProfiles()
  // A ref, not state: the map centre changes often and nothing needs to re-render for it.
  const mapCenter = useRef<LatLng>(DEFAULT_MAP_CENTER)
  const [mode, setMode] = useState<Mode>('route')

  // Trip idea mode. The result lives in the mutation; `sent` keeps the request it answers.
  const tripIdea = useTripIdea()
  const [tripStart, setTripStart] = useState<LatLng | null>(null)
  const [sent, setSent] = useState<TripIdeaRequest | null>(null)
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const trip = tripIdea.data
  const tripStops = trip ? remainingStops(trip, removed) : []

  const startIsFinish = mode === 'trip' && Boolean(trip) && sent?.round_trip === true

  function suggestTrip(request: TripIdeaRequest) {
    setSent(request)
    setRemoved(new Set())
    tripIdea.mutate(request)
  }

  /** A new start makes the old result wrong, so it is hidden. */
  function changeTripStart(start: LatLng | null) {
    setTripStart(start)
    tripIdea.reset()
  }

  function removeStop(poiId: string) {
    setRemoved((previous) => new Set(previous).add(poiId))
  }

  // The request is derived from the inputs, and the query reads the cache by it.
  // So a changed input hides an old result, and going back shows it again with no request.
  const request: RoutePlanRequest | null =
    points.start && points.end
      ? withProfile({ start: points.start, end: points.end, avoid_stairs: avoidStairs }, profileId)
      : null
  // Consts, so TypeScript keeps them non-null inside the save callback below.
  const routeStart = points.start
  const routeEnd = points.end
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
    fetchRoutePlan(
      queryClient,
      withProfile({ start: route.start, end: route.end, avoid_stairs: avoidStairs }, profileId),
    )
  }

  /** The profile changes the pace, so a route on the map is planned again right away. */
  function changeProfile(next: number | null) {
    setProfileId(next)
    if (points.start && points.end) {
      fetchRoutePlan(
        queryClient,
        withProfile({ start: points.start, end: points.end, avoid_stairs: avoidStairs }, next),
      )
    }
  }

  return (
    <div className="relative h-full md:flex">
      <section
        aria-labelledby="planner-title"
        className={cn(
          'absolute inset-x-0 bottom-0 z-10 flex max-h-[65%] flex-col rounded-t-2xl border-t bg-background shadow-2xl',
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
          {/* Controlled tabs: the map outside the panel must know the mode too. */}
          <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="route">{t('planner.tabs.route')}</TabsTrigger>
              <TabsTrigger value="trip">{t('planner.tabs.trip')}</TabsTrigger>
            </TabsList>

            <TabsContent value="trip" className="space-y-4">
              <TripIdeaForm
                start={tripStart}
                profiles={profiles.data ?? []}
                profileId={profileId}
                planning={tripIdea.isPending}
                onProfileChange={setProfileId}
                onClearStart={() => changeTripStart(null)}
                onUseMapCenter={() => changeTripStart(mapCenter.current)}
                onDemoStart={() => changeTripStart(DEMO_TRIP_START)}
                onSubmit={suggestTrip}
              />
              <div aria-live="polite" className="space-y-4">
                {tripIdea.isPending && <DetourCardSkeleton />}
                {tripIdea.isError && (
                  <ErrorBanner
                    mode="trip"
                    error={tripIdea.error}
                    onRetry={() => sent && suggestTrip(sent)}
                  />
                )}
                {tripIdea.isIdle && (
                  <p className="text-sm text-muted-foreground">{t('trip.empty')}</p>
                )}
              </div>
              {trip && (
                <>
                  <DemoModeBanner source={trip.source} />
                  <StopsTimeline
                    engine={trip.engine}
                    stops={tripStops}
                    totals={tripTotals(trip, tripStops)}
                    onRemove={removeStop}
                  />
                  <TripSummary trip={trip} />
                  <DetourCard plan={trip} avoidStairs />
                  <Button className="w-full" onClick={() => setSaveOpen(true)}>
                    {t('planner.save')}
                  </Button>
                  <RouteLegend />
                  <TransitStops stops={trip.transit_stops} />
                </>
              )}
            </TabsContent>

            <TabsContent value="route" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="planner-profile">{t('planner.profile.label')}</Label>
                <ProfileSelect
                  id="planner-profile"
                  profiles={profiles.data ?? []}
                  value={profileId}
                  disabled={!profiles.data}
                  onChange={changeProfile}
                />
              </div>
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
                  <Button className="w-full" onClick={() => setSaveOpen(true)}>
                    {t('planner.save')}
                  </Button>
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

      {mode === 'route' && result && request && routeStart && routeEnd && (
        <SaveWalkDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          pois={result.pois}
          profiles={profiles.data ?? []}
          profileId={profileId}
          buildPayload={(values) =>
            buildWalkPayload({
              plan: result,
              start: routeStart,
              end: routeEnd,
              avoidStairs: request.avoid_stairs,
              name: values.name,
              profileId: values.profileId,
              pois: result.pois.filter((poi) => values.poiIds.includes(poi.poi_id)),
            })
          }
        />
      )}

      {mode === 'trip' && trip && sent && (
        <SaveWalkDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          pois={null}
          profiles={profiles.data ?? []}
          profileId={sent.profile_id ?? null}
          description={t('trip.saveDescription', { count: tripStops.length })}
          buildPayload={(values) =>
            buildTripWalkPayload({
              trip,
              stops: tripStops,
              start: sent.start,
              roundTrip: sent.round_trip,
              name: values.name,
              profileId: values.profileId,
            })
          }
        />
      )}

      {/* Phone only: with the panel folded, the next step is a button on the map. */}
      {!sheetOpen && mode === 'trip' && tripStart && (
        <Button
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 shadow-lg md:hidden"
          disabled={tripIdea.isPending}
          // Without a result it submits the folded form (the `form` attribute), so the
          // request has the same limit and wishes as the panel shows.
          {...(trip
            ? { type: 'button' as const, onClick: () => setSaveOpen(true) }
            : { type: 'submit' as const, form: TRIP_FORM_ID })}
        >
          {trip
            ? t('planner.save')
            : tripIdea.isPending
              ? t('trip.form.planning')
              : t('trip.form.submit')}
        </Button>
      )}
      {!sheetOpen && mode === 'route' && request && (
        <Button
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 shadow-lg md:hidden"
          disabled={fetching}
          onClick={result ? () => setSaveOpen(true) : plan}
        >
          {result
            ? t('planner.save')
            : fetching
              ? t('planner.form.planning')
              : t('planner.form.plan')}
        </Button>
      )}

      {/* `isolate` keeps the Leaflet z-indexes inside the map, under the bottom sheet. */}
      <div className="isolate h-full md:flex-1">
        {/* One map for both modes: it shows and edits the points of the open tab. */}
        <MapView
          start={mode === 'route' ? points.start : tripStart}
          startIsFinish={startIsFinish}
          end={mode === 'route' ? points.end : null}
          plan={mode === 'route' ? result : trip}
          pois={mode === 'route' && result ? visiblePois(result.pois, hidden) : []}
          stops={
            mode === 'trip'
              ? tripStops.map((stop) => ({ id: stop.poi_id, ...stop, title: poiLabel(stop) }))
              : undefined
          }
          poiLabel={poiLabel}
          pointLabels={{
            start: t(startIsFinish ? 'trip.map.startFinish' : 'planner.form.start'),
            end: t('planner.form.end'),
          }}
          onMapClick={(click) =>
            mode === 'route' ? setPoints(nextPoints(points, click)) : changeTripStart(click)
          }
          onCenterChange={(center) => {
            mapCenter.current = center
          }}
        />
      </div>
    </div>
  )
}

type Mode = 'route' | 'trip'

/** profile_id is sent only when a profile is chosen. */
function withProfile(request: RoutePlanRequest, profileId: number | null): RoutePlanRequest {
  return profileId === null ? request : { ...request, profile_id: profileId }
}

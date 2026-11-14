import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRoutePlan, useRoutePlan, useTripIdea } from '@/api/planning'
import { toast } from 'sonner'
import { usePatchProfile, useProfiles } from '@/api/profiles'
import type { LatLng, RoutePlanRequest, TripIdeaRequest } from '@/api/types'
import { StopsTimeline } from '@/components/planner/StopsTimeline'
import { PaceSlider } from '@/components/common/PaceSlider'
import { TRIP_FORM_ID, TripIdeaForm } from '@/components/planner/TripIdeaForm'
import { TripSummary, WeatherChip } from '@/components/planner/TripSummary'
import { DEFAULT_TRIP_MINUTES, DEMO_TRIP_START, remainingStops, tripTotals } from '@/lib/trip'
import { buildTripWalkPayload, buildWalkPayload } from '@/lib/walkPayload'
import { HealthStatus } from '@/components/HealthStatus'
import { DemoModeBanner, ErrorBanner } from '@/components/planner/Banners'
import { DetourCard, DetourCardSkeleton } from '@/components/planner/DetourCard'
import { MapView, type MapFocus } from '@/components/planner/MapView'
import { MapsExport } from '@/components/planner/MapsExport'
import { PlacesSection } from '@/components/planner/PlacesSection'
import { PlannerSheet } from '@/components/planner/PlannerSheet'
import { ReplaceTripDialog } from '@/components/planner/ReplaceTripDialog'
import { RouteForm } from '@/components/planner/RouteForm'
import { LegendChip } from '@/components/planner/LegendChip'
import { TransitStops } from '@/components/planner/TransitStops'
import { Label } from '@/components/ui/label'
import { ProfileSelect } from '@/components/walks/ProfileSelect'
import { SaveWalkDialog } from '@/components/walks/SaveWalkDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_MAP_CENTER, type DemoRoute } from '@/constants/demoRoutes'
import { usePoiLabel } from '@/lib/poiLabel'
import { nextPoints, visiblePois, type PlannerPoints } from '@/lib/planner'
import { paceMax, profilePace } from '@/lib/pace'
import { usePageTitle } from '@/lib/usePageTitle'
import { useSheetInset } from '@/lib/useSheetInset'

export function PlannerPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.planner.title'))
  const poiLabel = usePoiLabel()
  const queryClient = useQueryClient()

  const [points, setPoints] = useState<PlannerPoints>({ start: null, end: null })
  const [avoidStairs, setAvoidStairs] = useState(true)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(true)
  const sheetRef = useRef<HTMLElement>(null)
  const sheetInset = useSheetInset(sheetRef)
  // A demo click shows its points at once (audit idea 6); the id makes a repeated click count.
  const [focus, setFocus] = useState<MapFocus | null>(null)
  function focusOn(points: LatLng[]) {
    setFocus((previous) => ({
      id: (previous?.id ?? 0) + 1,
      points: points.map((point) => [point.lat, point.lng]),
    }))
  }
  const [profileId, setProfileId] = useState<number | null>(null)
  // The pace starts from the profile; the slider changes it for this plan only (audit idea 3).
  const [pace, setPace] = useState(profilePace(undefined))
  const [saveOpen, setSaveOpen] = useState(false)
  const profiles = useProfiles()
  const selectedProfile = profiles.data?.find((item) => item.id === profileId)
  const maxPace = paceMax(selectedProfile?.wheels)

  /** Both tabs share the profile. A new profile also resets the pace slider. */
  function selectProfile(next: number | null) {
    setProfileId(next)
    const profile = profiles.data?.find((item) => item.id === next)
    setPace(profilePace(profile))
    // Saved trip settings (audit idea 4). No profile keeps what the user set.
    if (profile) {
      setTripMinutes(profile.trip_minutes)
      setRoundTrip(profile.round_trip)
    }
  }

  // Trip settings live here, so a profile can set them and the user can save them back.
  const [tripMinutes, setTripMinutes] = useState(DEFAULT_TRIP_MINUTES)
  const [roundTrip, setRoundTrip] = useState(true)
  const updateProfile = usePatchProfile()
  const settingsChanged =
    selectedProfile !== undefined &&
    (selectedProfile.pace_kmh !== pace ||
      selectedProfile.trip_minutes !== tripMinutes ||
      selectedProfile.round_trip !== roundTrip)

  function saveSettings() {
    if (!selectedProfile) return
    const { name } = selectedProfile
    updateProfile.mutate(
      {
        id: selectedProfile.id,
        input: {
          pace_kmh: pace,
          trip_minutes: tripMinutes,
          round_trip: roundTrip,
        },
      },
      {
        onSuccess: () => toast.success(t('trip.form.settingsSaved', { name })),
        onError: () => toast.error(t('trip.form.settingsFailed')),
      },
    )
  }
  // A ref, not state: the map centre changes often and nothing needs to re-render for it.
  const mapCenter = useRef<LatLng>(DEFAULT_MAP_CENTER)
  // The trip idea is the main feature, so it opens first (audit idea 7).
  const [mode, setMode] = useState<Mode>('trip')

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

  // A new start makes the old result wrong. With a trip on screen we ask first (audit idea 12),
  // so the choice waits here until the user answers.
  const [pendingStart, setPendingStart] = useState<StartChange | null>(null)

  function changeTripStart(start: LatLng | null, focus = false) {
    if (trip) setPendingStart({ start, focus })
    else applyTripStart({ start, focus })
  }

  function applyTripStart({ start, focus }: StartChange) {
    setTripStart(start)
    tripIdea.reset()
    if (focus && start) focusOn([start])
  }

  function removeStop(poiId: string) {
    setRemoved((previous) => new Set(previous).add(poiId))
  }

  // The request is derived from the inputs, and the query reads the cache by it.
  // So a changed input hides an old result, and going back shows it again with no request.
  const request: RoutePlanRequest | null =
    points.start && points.end
      ? withProfile(
          { start: points.start, end: points.end, avoid_stairs: avoidStairs },
          profileId,
          pace,
        )
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
    focusOn([route.start, route.end])
    fetchRoutePlan(
      queryClient,
      withProfile(
        { start: route.start, end: route.end, avoid_stairs: avoidStairs },
        profileId,
        pace,
      ),
    )
  }

  /**
   * The profile changes the pace, so a route on the map is planned again right away.
   * It also sets "Avoid stairs": on for a stroller or a balance bike, off on foot. It is only
   * a default; the switch stays usable (DECISIONS.md section 12).
   */
  function changeProfile(next: number | null) {
    selectProfile(next)
    const profile = profiles.data?.find((item) => item.id === next)
    const nextAvoidStairs = profile ? profile.wheels !== 'none' : avoidStairs
    setAvoidStairs(nextAvoidStairs)
    if (points.start && points.end) {
      fetchRoutePlan(
        queryClient,
        withProfile(
          { start: points.start, end: points.end, avoid_stairs: nextAvoidStairs },
          next,
          profilePace(profile),
        ),
      )
    }
  }

  return (
    <div className="relative h-full md:flex">
      <PlannerSheet
        open={sheetOpen}
        onToggle={() => setSheetOpen((open) => !open)}
        sheetRef={sheetRef}
      >
        {/* Controlled tabs: the map outside the panel must know the mode too. */}
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="mb-3 w-full">
            <TabsTrigger value="trip">{t('planner.tabs.trip')}</TabsTrigger>
            <TabsTrigger value="route">{t('planner.tabs.route')}</TabsTrigger>
          </TabsList>

          <TabsContent value="trip" className="space-y-4">
            <TripIdeaForm
              start={tripStart}
              profiles={profiles.data ?? []}
              profileId={profileId}
              planning={tripIdea.isPending}
              onProfileChange={selectProfile}
              pace={pace}
              maxPace={maxPace}
              onPaceChange={setPace}
              minutes={tripMinutes}
              onMinutesChange={setTripMinutes}
              roundTrip={roundTrip}
              onRoundTripChange={setRoundTrip}
              canSaveSettings={settingsChanged}
              savingSettings={updateProfile.isPending}
              onSaveSettings={saveSettings}
              onClearStart={() => changeTripStart(null)}
              onUseMapCenter={() => changeTripStart(mapCenter.current)}
              onDemoStart={() => changeTripStart(DEMO_TRIP_START, true)}
              onLocate={(point) => changeTripStart(point, true)}
              onSubmit={suggestTrip}
            />
            <ResultsDivider />
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
                <WeatherChip weather={trip.weather} />
                <StopsTimeline
                  engine={trip.engine}
                  stops={tripStops}
                  totals={tripTotals(trip, tripStops)}
                  onRemove={removeStop}
                />
                <TripSummary trip={trip} />
                <DetourCard plan={trip} avoidStairs places={tripStops.length} />
                <Button className="w-full" onClick={() => setSaveOpen(true)}>
                  {t('planner.save')}
                </Button>
                {/* The remaining stops only: a removed stop must not be in the link. */}
                <MapsExport geometry={trip.route.geometry} stops={tripStops} />
                <TransitStops stops={trip.transit_stops} />
              </>
            )}
          </TabsContent>

          <TabsContent value="route" className="space-y-4">
            <RouteForm
              start={points.start}
              end={points.end}
              avoidStairs={avoidStairs}
              planning={fetching}
              profileField={
                <div className="space-y-1.5">
                  <Label htmlFor="planner-profile">{t('planner.profile.label')}</Label>
                  <ProfileSelect
                    id="planner-profile"
                    profiles={profiles.data ?? []}
                    value={profileId}
                    disabled={!profiles.data}
                    onChange={changeProfile}
                  />
                  <PaceSlider id="planner-pace" value={pace} max={maxPace} onChange={setPace} />
                </div>
              }
              onAvoidStairsChange={setAvoidStairs}
              onClear={(which) => setPoints({ ...points, [which]: null })}
              onUseMapCenter={(which) => setPoints({ ...points, [which]: mapCenter.current })}
              onLocate={(point) => {
                // The position comes later (async): read the current points, not this render's.
                setPoints((current) => ({ ...current, start: point }))
                focusOn([point])
              }}
              onDemo={pickDemo}
              onPlan={plan}
            />

            <ResultsDivider />
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
                  <DetourCard
                    plan={result}
                    avoidStairs={request.avoid_stairs}
                    places={visiblePois(result.pois, hidden).length}
                  />
                </>
              )}
            </div>
            {result && (
              <>
                <Button className="w-full" onClick={() => setSaveOpen(true)}>
                  {t('planner.save')}
                </Button>
                <MapsExport geometry={result.route.geometry} />
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
      </PlannerSheet>

      {mode === 'route' && result && request && routeStart && routeEnd && (
        <SaveWalkDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          pois={result.pois}
          profiles={profiles.data ?? []}
          profileId={profileId}
          routeRequestFor={(id) =>
            id === profileId
              ? request
              : withProfile(
                  { start: request.start, end: request.end, avoid_stairs: request.avoid_stairs },
                  id,
                  profilePace(profiles.data?.find((item) => item.id === id)),
                )
          }
          buildPayload={(values, plan) =>
            buildWalkPayload({
              plan: plan ?? result,
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

      <ReplaceTripDialog
        open={pendingStart !== null}
        onConfirm={() => {
          if (pendingStart) applyTripStart(pendingStart)
          setPendingStart(null)
        }}
        onCancel={() => setPendingStart(null)}
      />

      {/* Phone only: with the panel folded, the next step is a button on the map. */}
      {!sheetOpen && mode === 'trip' && tripStart && (
        <Button
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 shadow-float md:hidden"
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
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 shadow-float md:hidden"
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
      <div className="sw-under-topbar relative isolate h-full md:flex-1">
        {/* Only with a route on the map. z-[1000] in LegendChip puts it over the Leaflet panes. */}
        {((mode === 'route' && result) || (mode === 'trip' && trip)) && <LegendChip />}
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
          bottomInset={sheetInset}
          focus={focus}
        />
      </div>
    </div>
  )
}

type Mode = 'route' | 'trip'

/** A trip start the user picked; `focus` also moves the map to it (demo start, my location). */
interface StartChange {
  start: LatLng | null
  focus: boolean
}

/** A clear break between the form and the result (developer feedback, session 3). */
function ResultsDivider() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 pt-2" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-[13px] leading-4 font-medium tracking-wide text-muted-foreground uppercase">
        {t('planner.results')}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** profile_id is sent only when a profile is chosen. */
/** Adds the profile (if any) and the pace. The pace is always sent, so it wins on the server. */
function withProfile(
  request: RoutePlanRequest,
  profileId: number | null,
  pace: number,
): RoutePlanRequest {
  const withPace = { ...request, pace_kmh: pace }
  return profileId === null ? withPace : { ...withPace, profile_id: profileId }
}

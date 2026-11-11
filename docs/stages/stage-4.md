# Stage 4: Frontend, the planner with a map

**Status:** done (2026-11-11). Merged to `dev` in PR #9 and released to `main` in PR #10.
**Spec:** `docs/PLAN.md`, section E, "Stage 4".

## Goal

The planner screen in "Route A -> B" mode. The user sets a start and an end on a map, or picks a
demo route, and sees both routes and the stairs. A card says in plain words what avoiding the
stairs costs. This is where the twist of the app becomes visible.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Showed a component tree, the data flow, a test list and one combined package question. Found one contract gap: the API sends no accessibility tags for places. |
| Plan review | agent | On request, reviewed its own plan and found 10 gaps. It had invented a "tiny detour" threshold. It missed that `step_free_available: null` has two meanings, and that `stairs_m: null` (mock) is not "no stairs". A stale result could stay after the points changed. It also missed fitting the map to the route, keyboard access to the map, 400 errors and two Leaflet + Vite traps. All were fixed in the plan. |
| Decisions | developer | Approved the plan and the packages. Chose a frontend-only `accessibility?` field. Asked for an integration test of the whole page. |
| Build | agent | Types, API hook, plain logic functions, components, the page, i18n and tests. Lint rejected helpers exported from component files, so they moved to `lib/` and `constants/`. |
| Contract check | agent | Called the three demo pairs on the local backend. All three matched their cases (big, no stair-free route, tiny). |
| Self-check 1 | agent | On request, reviewed the diff. Found a real bug: each `mutate()` cleared the result, so "Load places again" removed the route from the screen. On phones, the panel also covered the OSM credit and shared a z-index with the Leaflet controls. All were fixed, one with a regression test. |
| Manual test | developer | Went through a list of 40 manual checks. All passed, except the place checks: Overpass did not answer. Asked for a route cache and a compact phone header. Reported three things that were not bugs: requests without a key, a Firefox CORS message with the backend off, and the A/B pins having no popup. |
| Cache and header | agent | Checked the TanStack Query source first (`fetchQuery` respects `staleTime` and does not retry). Moved route plans from a mutation to a query cache, and made the header one row on phones. |
| Release | developer | Merged PR #9 to `dev`, tested `dev` by hand, then merged release PR #10 to `main`. |

## What was built (`frontend/src/`)

- `api/types.ts`: hand-written types that match `planning/serializers.py`, plus `accessibility?`,
  which the backend does not send yet.
- `api/planning.ts`: `useRoutePlan` (`useQuery`, key = the whole request, `enabled: false`) and
  `fetchRoutePlan` (`queryClient.fetchQuery`, 10 min cache, `force` skips the cache).
- `lib/format.ts`: `formatDistance` (m / km, locale decimal comma) and `formatDuration` ("1 h 05 min").
- `lib/planner.ts`: plain logic, tested without Leaflet. `detourCase` returns 7 variants; the
  others are `nextPoints`, `visiblePois`, `countCategories`, `planErrorKey` and `planBounds`.
- `lib/poiLabel.ts`: the name, or the category label when OSM has no name.
- `constants/`: demo routes (from `DECISIONS.md`, swapped to lat/lng), category icons and order,
  and line styles shared by the map and the legend.
- `components/planner/`:
  - `MapView`: thin. OSM tiles, credit at the top right, lines, `divIcon` markers and `FitBounds`.
  - `DetourCard`: uses `<Trans>`, so the stairs metres are a red `<strong>` inside a translated sentence.
  - `PoiFilterChips` (`aria-pressed`), `PoiDetails` (popup content), `PlacesSection`, `TransitStops`.
  - `RouteForm`, `RouteLegend`, and `Banners` (demo mode and errors).
- `pages/PlannerPage.tsx`: state for the points, the switch, hidden categories and the panel. A side
  panel on desktop, a bottom sheet on phones. The "Trip idea" tab is disabled until stage 7.
- `components/AppLayout.tsx`: the planner is full screen. The header fits in one row on phones
  (logo icon, "PL"/"EN"), and the accessible names stay the same.
- `i18n/en.json`, `pl.json`: all new texts in both languages.
- New packages: `leaflet` 1.9.4, `react-leaflet` 5.0.0, `@types/leaflet` 1.9.22, and shadcn
  `switch` and `tabs`.

## The card: cases and texts

| Case | When | What the user sees |
|---|---|---|
| Big detour | stair-free route, detour > 25 m and > 3% | "The shortest route has 16 m of stairs. Stair-free route: +288 m, +4 min." |
| Tiny detour | detour <= 25 m or <= 3% | "You can avoid the stairs with almost no extra distance." |
| No stair-free route | `step_free_available: false` | "There is no stair-free route between these points." Stairs are highlighted. |
| No stairs | `baseline.stairs_m: 0` | "No stairs on this route." |
| Not searched | `null`, and the switch was off | "Stairs are not avoided." |
| Check failed | `null`, and the switch was on | "We could not check for a stair-free route." |
| Stairs unknown | `stairs_m: null` (mock line) | "This is a straight line, not a real route." |

## Tests and checks

| Area | Tests |
|---|---|
| format | metres, km with the locale decimal sign, minutes, hours with zero padding, negative time |
| planner logic | the 7 card cases and the tiny threshold borders; point clicks; filters; category order; error mapping (422 codes, 400, 429, network) |
| DetourCard | the four D.4 cases (exact texts, stairs in `<strong>`), plus "not searched" and "stairs unknown" |
| PoiFilterChips | state with `aria-pressed`, click and keyboard |
| PoiDetails | a place without a name shows its category, unknown category, opening hours, accessibility tags only when present |
| Banners | its own message for each 422 code, retry, demo banner only for `fixture` and `mock` |
| PlannerPage (integration) | demo route to card, places and stops; map clicks, switch value, clearing a point; 422 and retry; the route stays during "Load places again" (regression); the cache gives no new request for the same input |

Leaflet does not render in jsdom. `MapView` is replaced by a fake in `test/setup.ts`, so the page
test checks the real page without the map.

Vitest: 49 passed. ESLint, Prettier, `tsc` and `vite build` are green. Backend `pytest` is green
too; the backend did not change. CI on PR #9 was green (backend, frontend, GitGuardian).

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, section 8.

- **The tiny detour threshold** is 25 m or 3%. D.4 gives no number.
- **`step_free_available: null`** has two meanings. The UI tells them apart by its own request flag.
- **A mutation clears its result on each new call.** The first fix kept the result in extra state.
  The final version uses a query cache, which removed that state and also stopped repeat requests.
  This changes D.7 ("planning results as mutations").
- **The OSM credit** moved to the top right, because the phone panel covered it.
- **Shell heredocs failed** in Git Bash on Windows for large files. Files were written with the
  editor tool or a script file instead.
- **Known limits, accepted:**
  - The bundle is about 816 kB (Leaflet, plus `react-dom/server` for the marker icons).
  - The bottom sheet opens and closes with a button only; it cannot be dragged.
  - Polish nav labels may scroll sideways at 360 px.

## Open points

- Check by hand when Overpass answers: place markers, chips, popups, and opening a popup with the
  keyboard.
- Backend: send `wheelchair` / `changing_table` as `accessibility` in `pois.py` (small).
- Lazy-load `MapView` to cut the first bundle (small).
- Stage 7: a draggable bottom sheet, and a clearer collapse button (in a circle).

## Next stage

Stage 5: frontend, CRUD of walks, stops and profiles (`docs/PLAN.md`, section E, "Stage 5").

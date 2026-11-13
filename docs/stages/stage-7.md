# Stage 7: Trip ideas in the UI and UX polish

**Status:** done (2026-11-13). Merged to `dev` in PR #16 and released to `main` in PR #17.
Feature freeze after this stage.
**Spec:** `docs/PLAN.md`, sections D.6, D.7 and section E, "Stage 7".

## Goal

The second planner mode, "Trip idea": a form, the result on the map and in a timeline, removing
stops and saving the trip as a walk. Then a UX pass over the whole app and a full set of
translations.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Read the spec, the page, the types and the trip-ideas serializers. Found that the contract has everything the UI needs, and that `ai_summary` can be written on create. |
| Plan review | developer, agent | The developer asked whether the global rules were used and for a critical review. The agent admitted it wrote in English instead of Polish and gave no score. The review (5/10) found a hidden contract gap: after removing a stop the route, arrival times and totals are out of date, and the browser cannot route through waypoints. The spec says "stop and tell me" in such a case. Also: the engine label and over-limit warning were planned in the wrong component for the required tests, and edge cases were missing (removing the last stop, the end of a one-way trip, `pl-PL` as a language, `null` weather). |
| Decision | developer | Option A: keep the planned route, recompute only the stop minutes, and say so in the UI. No contract change. |
| Build | agent | New types and a mutation hook, `TripIdeaForm`, `StopsTimeline`, `TripSummary`, numbered map markers, a trip save payload. `SaveWalkDialog` now takes a payload builder, so both modes share it. |
| Self-check 1 | agent | On request, found three bugs: a 400 in trip mode showed the route message ("Put the end closer to the start"), list keys came from LLM text (duplicates possible), and the weather chip hid everything when only the temperature was missing. All fixed, with a regression test for the 400. |
| Manual test | developer | Went through a checklist of about 45 points (A-G). Found: no map button for trips on a phone, the browser kept the Vite favicon (cache), the app ignored the dark system theme, 429 from the hourly limit during testing. Suggested a counter colour at 200/200, a finish flag for round trips, a slider for the time limit, and a dialog before replacing an unsaved trip. |
| Fixes | agent | Map button (suggest, then save; it submits the folded form with the `form` attribute), red counter, finish flag, system dark theme and Leaflet popups in dark. The slider, the replace dialog and "at least one stop on the walk page" went to README, "Possible next steps". The 429 is set by `TRIP_IDEAS_RATE`. |
| Theme switch | developer, agent | The developer asked for a theme button. The saved choice wins; without one the system decides. |
| Self-check 2 | agent | Found: a light flash before JavaScript loads (a small script in `index.html` now sets the class), native controls stayed light (`color-scheme: dark`), the flag marker was still called "Start", and the map button had no explicit `type="button"` when saving. |
| Release | developer, agent | The agent first proposed `release:` as the merge commit prefix. When the developer asked what to type in the GitHub merge fields, the agent corrected it (not a Conventional Commits type) to `feat: release stage 7 - ...`, like the earlier releases. |

## What was built (`frontend/src/`)

- `api/types.ts`: `RouteComparison` (shared by route plans and trip ideas), `TripIdeaRequest`,
  `TripIdea`, `TripStop`, `Weather`, the engine and error codes; `ai_summary` on walk create.
- `api/planning.ts`: `useTripIdea()`, a mutation with no retry and no client timeout (the backend
  ends the LLM call after 60 s and answers with rules).
- `lib/trip.ts`: time limits, the demo start, `apiLanguage`, `isLlmEngine`, `remainingStops`,
  `tripTotals` (recomputes the stop minutes and the over-limit flag after a removal).
- `lib/walkPayload.ts`: `buildTripWalkPayload` (order 1..n, `source` `ai` or `rules`, `reason`,
  `ai_summary`; a round trip ends at the start, a one-way trip at the last kept stop).
- `lib/planner.ts`: error keys for `no_places_nearby` and `places_unavailable`.
- `components/planner/`: `TripIdeaForm`, `StopsTimeline`, `TripSummary`; `MapView` draws
  numbered stops and a finish flag; `ErrorBanner` has a trip mode.
- `components/ThemeSwitch.tsx`, `lib/theme.ts`: system theme and a light / dark switch.
- `lib/usePageTitle.ts`: a tab title on every page.
- `index.css`: a visible keyboard focus for plain elements, dark Leaflet popups,
  `color-scheme: dark`.
- `public/favicon.svg`: own icon instead of the Vite logo.
- `i18n/en.json`, `pl.json`: all new texts in both languages.
- No new packages.

## Tests and checks

| Area | Tests |
|---|---|
| TripIdeaForm | submitted payload (limit, round trip, language, trimmed wishes, `profile_id` only when chosen); 200 character limit, counter turns red, privacy hint; disabled without a start; in-progress state |
| StopsTimeline | order with arrival, minutes and reason; engine label for `rules` and for `claude_cli`; over-limit warning; remove a stop, but never the last one |
| Save payload | remaining stops after removing one: order, `source`, `reason`, `ai_summary`; one-way end point |
| PlannerPage, trip | the whole flow: suggest -> remove a stop -> save -> `/walks/:id`; 422 `no_places_nearby`; 400 in trip words; the phone map button sends the chosen limit, then saves |
| Theme | follows the system and its changes; a saved choice wins; the switch saves it |
| Translations | `i18n/keys.test.ts` fails when `pl.json` and `en.json` have different keys |

Vitest: 99 passed (23 files). ESLint, Prettier and `vite build` are green. Backend `pytest` and
`ruff` pass; the backend did not change.

Manual: checklist A-G passed with `LLM_BACKEND=mock` and with `claude_cli`, including a wishes
text that tried to change the rules (G4).

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, "Trip ideas in the UI".

- **Removing a stop does not recalculate the route.** The UI says so; a recalculation endpoint is
  a next step.
- **Radix Switch inside a `<form>`** needs `ResizeObserver`, which jsdom does not have. A stub is in
  `test/setup.ts`.
- **Vitest does not start from Git Bash** on this machine ("failed to find the runner"); it works
  from PowerShell.
- **Python on Windows wrote CRLF** line endings in one edit; Prettier fixed them, and
  `git ls-files --eol` confirmed LF before the commits.
- **Plural keys:** Polish needs `_few` and `_many`, English does not, so the key parity test would
  fail. Texts were written without plural forms.
- **Known limits, accepted:** a short theme flash can still happen on reload; there is no
  "follow the system" option once a theme is chosen; the bundle size warning (over 500 kB) is
  still there.

## Open points

See `README.md`, "Possible next steps": any time limit with a slider, keep the old trip when a
new start is picked, at least one stop on a saved trip, recalculate the route after removing a
stop.

## Next stage

Stage 8: deploy, optional (`docs/PLAN.md`, section E, "Stage 8").

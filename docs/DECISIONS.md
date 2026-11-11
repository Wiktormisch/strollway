# Decisions

A short log of verified facts and decisions. Facts marked "verified" were checked by hand on 2026-11-10 (stage 0), before any application code was written. Claims that a source did not confirm are listed as such.

## 1. Project decisions

- **Name: StrollWay.** Written "StrollWay" in text and UI, `strollway` in the folder, the repository and the subdomain (`strollway.wiktormischker.dev`). Other names were considered (Pramway, Little Loop, Flatroute, Tiny Trails, Spacerownik); "stroller" and "stroll" both fit the target users. Not checked yet: whether another project already uses the name (search GitHub and the app stores before the repository goes public).
- **Repository root is `strollway/`.** The plan and this file live in `strollway/docs/`.
- **The AI feature is "trip ideas", not "stop suggestions".** The user gives a start point, a time limit and wishes in plain words (for example "playground, then coffee, then pizza"). The LLM picks and orders places from candidates found by code. Code builds the route and checks the time limit. Why: places along one A-to-B route are mostly benches, so choosing stops there is weak work for an LLM. Spec: `docs/PLAN.md` D.6.
- **`route-plans` and `trip-ideas` are calculations, not resources.** They create nothing, so `POST` with `200` is more honest than a made-up `201`.
- **POI data comes from OpenStreetMap only (Overpass).** We compared OSM with Google Maps by hand in several places and the difference was small. Why not Google Maps Platform (from memory, not re-checked in the current terms):
  - Its terms limit storing API data, so a cache or database of Google POI is not allowed (roughly: `place_id` may be stored, other fields only for a short time).
  - Its data should be shown on a Google map; we use Leaflet with OSM tiles.
  - It needs a billing account and a key, which breaks "clone and run with no keys".
  - Google Directions has no "avoid steps" option for walking, so it cannot replace ORS.
  - Ideas for later: an optional `POI_PROVIDER=google` fetched on demand and not stored, with the user's own key; adding missing places to OSM directly; the open Overture Maps dataset (licence and quality for Poland not checked).
- **Overpass errors: no waiting inside a request.** On 429, 504 or a timeout the backend returns the route at once with `pois_status: "unavailable"`, and the UI shows a "Load places again" button. Why: a 30 s sleep blocks one of two gunicorn workers and the user stares at a spinner.
- **No invented places.** Mock place data exists only for the recorded demo routes.
- **Opening hours: a small own parser** for common patterns only (`24/7`, `Mo-Fr 08:00-18:00`, rules separated by `;`, `off`). Anything else is "unknown". It is the first thing to cut if time is short.
- **Stairs are reported in metres** everywhere (API, database, UI), never as a number of steps. ORS gives the length of "steps" segments, not the number of steps.
- **ORS response format:** we use `/json`. Its geometry is an encoded polyline, so the backend needs a small decoder. We do not request `elevation` (it changes the encoding).
- **The first commit went to `main` without a PR** (stage 1). An empty branch cannot take a PR, and the commit holds only the plan and agent rules. Every later change goes through a PR to `dev`.
- **Versions (stage 1):** Python 3.14, Node 24.12, Django 6.1. **TypeScript is pinned to 6.0**, not 7: `typescript-eslint` 8.x supports only TypeScript `<6.1`. Try 7 again when `typescript-eslint` supports it.
- **ESLint, not oxlint.** The current Vite template ships oxlint; the plan asks for ESLint + `typescript-eslint` (more rules for React hooks, better known), so the template was changed.
- **shadcn/ui preset "Nova"** (Radix, Lucide icons, Geist font). It uses the `cn` package from the shadcn team instead of `clsx` + `tailwind-merge`.
- **No LangGraph (or LangChain) for trip ideas.** The flow is linear with one LLM call: code collects candidates, the LLM picks and orders them, code validates the answer and builds the route, and a rule-based engine is the fallback. There is no loop, no tool calls and no state between steps, so a graph framework adds a heavy dependency and its own concepts for no gain. The small `LLMClient` protocol is enough and stays easy to test with a mock. Look again if the LLM ever needs to call tools in a loop (for example "search wider if too few places") or keep a multi-step chat; even then, try a plain tool-use loop in the Anthropic SDK first.
- **No i18next language detector package.** Detection is about 15 lines in `src/i18n/index.ts`: saved choice, then the browser language, then Polish.

## 2. OpenRouteService (verified)

### What works

- `POST /v2/directions/foot-walking/json` accepts `options.avoid_features: ["steps"]` (HTTP 200). The GET variant has no `options`, so we use POST.
- `extra_info: ["waytype"]` works. The code for **steps is `8`**. Other codes seen: 0 unknown, 1 state road, 2 road, 3 street, 4 path, 6 cycleway, 7 footway.
- Plan B (`wheelchair` profile or GraphHopper) is **not needed**.
- Values arrive as floats (`8.0`). Cast them to `int`.
- ORS wants `[lon, lat]`. The wrong order gives error 2010. Our API uses `[lat, lng]`; the swap happens only in `routing.py`.

### Base URL

- Use `https://api.heigit.org/openrouteservice`. Pattern: `{base}/v2/directions/{profile}/json`. Keep it in `.env` as `ORS_BASE_URL`.
- Responses contain a message that `api.openrouteservice.org` is deprecated. The same `system_message` also appears on the heigit.org host, so it is harmless text and code ignores it.
- The warning `roadaccessrestrictions not available` appears in every response. We do not request it, so we ignore it.

### Free plan limits ("Standard" plan; daily / per minute)

- Directions V2: **2000 / 40**. Geocoding: 3000 / 100. POIs: 500 / 60 (not needed, we use Overpass).
- A "Collaborative" plan (10000 / 60) exists for non-profit or academic use. Not needed.
- One stroll uses 2 Directions calls (normal and avoid steps), so about 1000 strolls per day. The backend caches results and respects the 40/min limit.

### "No step-free route" (HTTP 404, ORS code 2009)

```json
{"error": {"code": 2009, "message": "Route could not be found - Unable to find a route between points 1 (...) and 2 (...)."}}
```

- Detect it by **both** the HTTP status 404 and `error.code == 2009`. The code is the stable part; the message text may change.
- It is **not** an application error. Never return 500 to the frontend.
- Flow: send the normal request first, then the avoid-steps request. If the second returns 2009, return the normal route with `step_free_available: false`. The UI shows "No step-free route for these points" and highlights the step segments (`waytype` 8) on the normal route.
- Other errors stay errors. Code 2010 ("Could not find routable point within a radius of 350 m") means bad coordinates: return a 4xx with a clear message.
- On a multi-point request 2009 can come from any leg.

### Demo pairs (`[lon, lat]`)

| Pair | Points | Normal route | Avoid steps |
|---|---|---|---|
| 1. Big detour (Gdansk, near Kartuska) | `[18.618119, 54.347791]` -> `[18.618458, 54.34874]` | 132.4 m, 95 s, stairs 16 m | 420.1 m, 302 s, no stairs (3.2x longer) |
| 2. No step-free route (Gdansk Glowny -> Hevelianum) | `[18.6437, 54.3561]` -> `[18.6405, 54.3580]` | 402.4 m, 290 s, stairs 39.9 m | **404, code 2009** |
| 3. Tiny detour (Oliwa SKM -> Pachołek) | `[18.5655, 54.4097]` -> `[18.5745, 54.4115]` | 826.6 m, 595 s, stairs 12.6 m | 832.8 m (+6.2 m, under 1%), no stairs |

Rejected: Brzezno -> beach (`[18.6385, 54.4085]` -> `[18.6330, 54.4110]`): both routes are identical (534.1 m, no stairs).

### Waypoints (four coordinates) with `avoid_features: ["steps"]`

Request: start `[18.6200, 54.3385]`, a playground `[18.6156, 54.3362]`, Pizza Hut `[18.6261, 54.3382]`, back to start.

- **One route** with **3 segments**, one per leg: 756.6 m, 1183.3 m, 438.3 m. The sum equals `summary.distance` (2378.2 m); durations add up too.
- No `waytype` 8 on any leg, so the option applies to every leg.
- `routes[0].way_points` is `[0, 54, 122, 147]`: indexes in the decoded geometry where each waypoint lies. Use them to split the polyline per leg and to draw the stops.
- ORS time is about 5 km/h (2378 m in 1712 s). The plan uses a family pace (stroller 4 km/h, relaxed 3.5 km/h, normal 4.5 km/h), so code computes time from `distance` and ignores ORS `duration`.
- Legs are not symmetric. Check the time limit of a trip against the real route total, not against straight-line distances.

## 3. Overpass and OSM data (verified)

### Data quality

| Area | Result |
|---|---|
| City centre (near Wały Jagiellońskie, 150 m around a short line) | 16 benches + 1 cafe. No playgrounds, toilets or drinking water |
| Park Oliwski (200 m) | 45 benches, 4 cafes, 2 toilets. No playgrounds, no drinking water |
| Gdansk Chelm (1000 m) | about 36 playground elements (some are the same playground as a point and an outline), 2 pizza restaurants, 2 ice cream shops, 2 fast food places, many benches and bus stops. **No cafe, no toilets** |

- Tags are mixed. Cafes in the park have good `opening_hours`, `outdoor_seating` and a recent `check_date`. One toilet building has `wheelchair: yes` and `fee: yes`; the other toilet has no tags. Benches have no names and stand in tight groups. Restaurants in Chelm have no `opening_hours`.
- Consequences for the app:
  - The backend must handle "0 candidates" and "only benches". The LLM may only choose from candidates the code gives it.
  - Group nearby benches (one per about 30 m) and merge a playground that appears both as a node and as an outline.
  - Show benches with a generic label ("Bench"). Do not rely on accessibility tags in the UI.
  - Parse `opening_hours` in code; if it cannot be parsed, it is "unknown".
  - Use `way` elements too (`out center tags`).
  - Do not promise playgrounds in the UI.

### Demo trip start

- **Lat 54.3385, lon 18.6200** (ORS order `[18.6200, 54.3385]`), Chelm, near the bus stop "Sikorskiego 04". Distances are rough: a playground about 70 m, a pizza place and an ice cream shop about 250 m, Pizza Hut about 400 m.
- There is no cafe here, so the demo wishes are "playground, ice cream, pizza", not "playground, coffee, pizza". For a cafe in the demo, test Park Oliwski with a 1000 m radius.

### Limits

Source: the Overpass "Commons" page (https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) and the OSM wiki ("Overpass API"), read on 2026-11-10.

| Limit | Value |
|---|---|
| Requests per day | about 10,000 |
| Download volume per day | about 1 GB |
| Default query timeout | 180 s |
| Default memory per query (`maxsize`) | 512 MiB |
| HTTP 429 | rate limit, no free slot; the wiki says to wait 30 s before the next request |
| HTTP 504 | query rejected (resource mismatch) |

- These are expected fair-use values, not hard technical limits. About 30,000 daily users share the public instances. A request may wait up to 15 s for a free slot.
- Database lag: changes in OSM can take a couple of minutes to show up (`osm3s.timestamp_osm_base` in every result).
- A second AI's summary of these limits was checked against the sources. Two of its numbers are **not confirmed**: "2 parallel slots per IP" (the Commons page only says the number of slots is in the status response; the one number on the wiki, 4, is for a different instance) and "10 minutes of total query time per day" (the wiki says "no more than 10 minutes" in sum, without "per day"). The values "1 GiB maximum declared memory" and the list of alternative servers were not found either.
- Rules for the app: one combined query per stroll; a small area; `[timeout:20]`; cache by area; on 429, 504 or a timeout do not wait, return the route with `pois_status: "unavailable"`. Our use is far below 10,000 requests per day.

## 4. `claude -p` flags (read from `claude --help`, not tested)

- `-p` / `--print`: non-interactive, prints the answer and exits.
- `--output-format json`: one JSON result (other values: `text`, `stream-json`).
- `--json-schema '<schema>'`: validates the output against a JSON Schema.
- `--tools ""`: disables all tools (`default` = all, or a list such as `Bash,Edit,Read`).
- `--no-session-persistence`: does not save the session to disk (only with `-p`).
- `--model <name>`, `--system-prompt <text>`, `--max-budget-usd <n>`, `--fallback-model <list>` (only with `-p`).
- `--disable-slash-commands` turns off skills. `--setting-sources` limits which settings are loaded.
- **Do not use `--bare`** for local dev: it reads only `ANTHROPIC_API_KEY`, never the subscription login. It also skips `CLAUDE.md`, hooks and auto-memory.
- Open question for stage 6: `-p` loads `CLAUDE.md` and settings from the working directory, which can change the answer. Run the CLI in an empty temporary directory and test it.
- First test to run: `claude -p "Return JSON: {\"ok\": true}" --output-format json --tools "" --no-session-persistence`

## 5. Plan review: errors of the first version, corrected in version 2

| # | Error | Fix |
|---|---|---|
| 1 | Stairs counted in "segments" and called "number of steps"; ORS gives metres | Metres everywhere (`stairs_m`, `stairs_avoided_m`); segments only for drawing |
| 2 | No "no step-free route" case (code 2009); the plan returned 422, an error | `step_free_available: false` + four variants of the comparison card |
| 3 | Wrong ORS address and format (`api.openrouteservice.org`, `/geojson`, field `waytypes`) | `ORS_BASE_URL` in `.env`, `/json`, `extras.waytype`, a polyline decoder in `geo.py` |
| 4 | Requesting `elevation` would change the geometry encoding | Removed, together with `ascent_m` |
| 5 | Promises the data cannot keep: playgrounds, changing tables, accessibility info of stops | Softer texts, `changing_table` category removed, tags shown only when present |
| 6 | "At most 10 benches" without grouping; benches with names | Grouping about every 30 m, a generic label, `name` may be empty |
| 7 | A "second Overpass mirror" never verified; fake places in mock mode | Removed. Mock places only for recorded demo routes |
| 8 | Waiting 30 s for Overpass inside a request | No waiting: `pois_status: "unavailable"` + a retry button |
| 9 | The frontend sent the candidate list that the backend passed to the LLM | Only the backend collects candidates |
| 10 | No protection of the budget on a public demo beyond a per-IP limit | A daily LLM call limit and an answer length limit |
| 11 | `claude -p` in the repo folder would load the project's `CLAUDE.md` | Runs in an empty temporary directory |
| 12 | `TextField(max_length=...)` is not enforced by Django in the database | The limit is in the serializer |
| 13 | Wrong cross-reference "details in D.4" for data sources | Corrected to D.5 |
| 14 | Unclear which folder holds the repo; the stage 1 prompt created a `DECISIONS.md` that already existed | The repo is in `strollway/`; the stage 1 prompt keeps existing files |
| 15 | Stage 4 had too much at once (app shell + map + planner) | The shell moved to stage 1 |
| 16 | Demo routes too short (130-830 m) to give the AI anything to plan | The AI plans a loop from a start point within a time limit |
| 17 | Activating a venv in PowerShell can be blocked on a reviewer's machine | A note and a command in D.9 and the README |
| 18 | Messy risk numbering; self-assessment out of date after stage 0 | Cleaned up |

## 6. Stage 2: walks CRUD API

- **Stops are written with a walk only on create.** `PUT`/`PATCH /api/walks/{id}/` ignores `stops`; stops change through `/api/stops/`. Simpler, and a `PATCH` cannot delete stops by accident.
- **A stop cannot move to another walk.** `walk` is checked on update and must stay the same.
- **Bad filter values give 400** (`?status=don`, `?walk=abc`), so typos do not hide behind a full list. A foreign walk id in `?walk=` gives an empty list, as if it did not exist.
- **`X-Client-Id` is checked before any action** (in `initial()`), so a bad header gives 400 before a possible 404. UUIDs are stored in lower case.
- **Size limits** in the serializers: `geometry` 2-5000 points, `ai_summary` 2000 characters, up to 20 nested stops.
- **Known limits (accepted):**
  - The shared `demo` client (no header) can be changed by anyone with curl or Swagger. `seed_demo` restores it.
  - Demo data is matched by fixed names. A renamed demo walk is created again by `POST /api/demo-data/`.
  - `distance_m`, `stairs_m` and `detour_m` come from the client and are not recalculated. They only affect the client's own data; stage 3 computes them in `route-plans`.
- **Stop categories for short walks and full-day trips:** `park`, `zoo`, `museum` and `beach` were added (well tagged in OSM: `leisure=park`, `tourism=zoo`, `tourism=museum`, `natural=beach`). `indoor_play` (`leisure=indoor_play`) waits until stage 3 checks in Overpass how many exist in Gdansk. "Paid" is not a category; OSM has a rarely filled `fee` tag.

## 7. Stage 3: route plans

- **Pace.** The profile model has `relaxed` (3.5 km/h) and `normal` (4.5 km/h). A stroller is a limit of 4 km/h, so `normal` + stroller gives 4 km/h. No profile means 4 km/h. ORS `duration` is ignored.
- **The avoid-steps request is skipped** when the shortest route has 0 m of stairs: the answer is `step_free_available: true`, `detour_m: 0`. This saves one ORS call.
- **Avoid-steps request fails** (timeout, 429, 5xx) after a good normal route: we return the normal route with `step_free_available: null` instead of a fixture or a straight line. A real route is better than a fake one.
- **Cache:** one entry per ORS request (rounded coordinates + avoid flag), 24 h. Routes and the stable errors 2009 and 2010 are cached; temporary failures are not. Overpass: one entry per query, only successful answers. Django file cache in `backend/.cache/` (git-ignored).
- **Fixtures hold raw answers** (trimmed ORS bodies and Overpass elements) and go through the same parsers as live data. They were recorded on 2026-11-11; Overpass answered 502 that day, so no fixture has places yet (`"overpass": null`). Run `record_fixtures` again to add them. Tests use fixed copies in `planning/tests/data/fixtures/`, so a new recording never breaks them.
- **Stage 0 file:** its third route ("C") is the rejected Brzezno pair, not Kartuska. It is kept as the test sample for "no stairs on the route".
- **Mock line and places:** for a straight-line route, live Overpass places near the line are still returned (they are real). Without Overpass, the list is empty. Recorded places are used only for a fixture route.
- **Duplicates:** places with the same category and name within 30 m are one place (a playground as a point and an outline; groups of benches). Then at most 10 benches, the closest to the route.
- **Transit stops:** one entry per name, kind and end (a stop has one platform per direction), at most 3 per end.
- **Overpass (checked 2026-11-11):** the public server answers **406 without a `User-Agent`**, so the client sends `StrollWay/0.1`. It also answered **502** "at capacity" with a text body. Any status other than 200, and a 200 with `remark: runtime error`, mean `pois_status: "unavailable"`.
- **`indoor_play` not checked yet:** Overpass was at capacity during stage 3. Not a category for now; check again in stage 6.
- **Input limit:** start and end must be at most 20 km apart (straight line). It is a stroller walk, and it protects the ORS daily limit.

## 8. Stage 4: planner UI

- **"Almost free" detour:** `detour_m <= 25 m` or `<= 3%` of the shortest route. D.4 gives no number; demo pair 3 is +6.2 m (under 1%). One place: `TINY_DETOUR_MAX_*` in `frontend/src/lib/planner.ts`.
- **`step_free_available: null` has two meanings.** The UI tells them apart by the `avoid_stairs` flag of its own request: `false` means "stairs not avoided", `true` means "the stair-free check failed" (see stage 3 above).
- **`stairs_m: null` (straight mock line)** is shown as "stairs unknown", never as "no stairs".
- **Accessibility tags:** `Poi.accessibility?: string[]` exists only in the frontend type. The backend does not send it yet; the popup shows it only when present. Follow-up: add `wheelchair` / `changing_table` to `pois.py`.
- **"Load places again"** sends the same route request again. There is no places-only endpoint; ORS answers come from the 24 h cache, and failed Overpass answers are not cached.
- **The map is thin:** Leaflet code lives only in `MapView.tsx`. Tests replace it with a fake (`src/test/setup.ts`), because jsdom cannot draw maps.
- **Route plans are cached in the browser** (TanStack `useQuery`, key = the whole request, 10 min). This changes D.7 ("planning results as mutations"): a mutation keeps only the last answer, so going back to the same points or switch value sent the same request again. The query is `enabled: false`, so clicking the map sends nothing; only "Plan route" or a demo button fetches. "Try again" and "Load places again" skip the cache.

## 9. Stage 5: walks, stops and profiles UI

- **Saving a plan as a walk:** `buildWalkPayload` (`frontend/src/lib/walkPayload.ts`) saves unknown values as 0: `stairs_m: null` (mock line) and `detour_m: null` (no stair-free route). `stairs_avoided_m = max(0, baseline.stairs_m - route.stairs_m)`. A POI category the `Stop` model does not know becomes `other`; a place without a name is saved with `name: ""`.
- **A stop's note is the `reason` field.** The API has no separate note field.
- **Profile and pace:** the backend computes the walking time from the profile in `/api/route-plans/`. Choosing a profile in the planner plans the route again at once. In the save dialog, a different profile only links the walk to it; a hint says that the saved time stays as planned. Recomputing there was left for later (it needs `keepPreviousData`, so the dialog does not close while loading).
- **Field errors:** `parseFieldErrors` puts DRF 400 messages under the fields the form shows; other messages go to a toast. Backend messages are English only.
- **Retries:** app-wide `retry: 1`, because the default 3 retries with growing delays kept a stopped backend "loading" for about 7 s. Route plans set `retry: false` themselves: `fetchQuery` turns retries off only when no default is set, and a 422 or 429 will not change.
- **Planner panel z-index** went from `z-1000` to `z-10`, so dialogs and selects (`z-50`) open above it. The map is in an `isolate` box, so Leaflet stays under the panel.
- **No `next-themes`:** the shadcn Sonner wrapper is replaced by a small `Toaster` with `theme="system"`.

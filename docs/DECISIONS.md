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
- Rules for the app: one combined query per stroll; a small area; a short `[timeout:10]` (was 20, changed on 2026-11-14, see section 10); cache by area; on 429, 504 or a timeout do not wait, return the route with `pois_status: "unavailable"`. Our use is far below 10,000 requests per day.

## 4. `claude -p` flags (read from `claude --help`; tested in stage 6, see section 10)

- `-p` / `--print`: non-interactive, prints the answer and exits.
- `--output-format json`: one JSON result (other values: `text`, `stream-json`).
- `--json-schema '<schema>'`: validates the output against a JSON Schema.
- `--tools ""`: disables all tools (`default` = all, or a list such as `Bash,Edit,Read`).
- `--no-session-persistence`: does not save the session to disk (only with `-p`).
- `--model <name>`, `--system-prompt <text>`, `--max-budget-usd <n>`, `--fallback-model <list>` (only with `-p`).
- `--disable-slash-commands` turns off skills. `--setting-sources` limits which settings are loaded.
- **Do not use `--bare`** for local dev: it reads only `ANTHROPIC_API_KEY`, never the subscription login. It also skips `CLAUDE.md`, hooks and auto-memory.
- Answered in stage 6: an empty temporary directory is not enough, because the CLI also loads the user's global `~/.claude/CLAUDE.md`. `--safe-mode` stops that (section 10).
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

- **Pace.** The profile model has `relaxed` (3.5 km/h) and `normal` (4.5 km/h). A stroller is a limit of 4 km/h, so `normal` + stroller gives 4 km/h. No profile means 4 km/h. ORS `duration` is ignored. (Changed in phase D: the pace is now a number in km/h, see section 12.)
- **The avoid-steps request is skipped** when the shortest route has 0 m of stairs: the answer is `step_free_available: true`, `detour_m: 0`. This saves one ORS call.
- **Avoid-steps request fails** (timeout, 429, 5xx) after a good normal route: we return the normal route with `step_free_available: null` instead of a fixture or a straight line. A real route is better than a fake one.
- **Cache:** one entry per ORS request (rounded coordinates + avoid flag), 24 h. Routes and the stable errors 2009 and 2010 are cached; temporary failures are not. Overpass: one entry per query, only successful answers. Django file cache in `backend/.cache/` (git-ignored).
- **Fixtures hold raw answers** (trimmed ORS bodies and Overpass elements) and go through the same parsers as live data. They were recorded on 2026-11-11; Overpass answered 502 that day, so the pairs had no places (`"overpass": null`). On 2026-11-14 the places were added from Overpass Turbo exports with `record_fixtures --pair N --overpass-file <file>`, which keeps the recorded ORS routes. Tests use fixed copies in `planning/tests/data/fixtures/`, so a new recording never breaks them.
- **Stage 0 file:** its third route ("C") is the rejected Brzezno pair, not Kartuska. It is kept as the test sample for "no stairs on the route".
- **Mock line and places:** for a straight-line route, live Overpass places near the line are still returned (they are real). Without Overpass, the list is empty. Recorded places are used only for a demo pair (since 2026-11-14 also when ORS gave the route, see section 10).
- **Duplicates:** places with the same category and name within 30 m are one place (a playground as a point and an outline; groups of benches). Then at most 10 benches, the closest to the route.
- **Transit stops:** one entry per name, kind and end (a stop has one platform per direction), at most 3 per end.
- **Overpass (checked 2026-11-11):** the public server answers **406 without a `User-Agent`**, so the client sends `StrollWay/0.1`. It also answered **502** "at capacity" with a text body. Any status other than 200, and a 200 with `remark: runtime error`, mean `pois_status: "unavailable"`.
- **`indoor_play` not checked yet:** Overpass was at capacity during stage 3. Not a category for now; check again in stage 6. (Checked in phase B: 16 in the Tricity, now a category, see section 11.)
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
- **Profile and pace:** the backend computes the walking time from the profile in `/api/route-plans/`. Choosing a profile in the planner plans the route again at once. In the save dialog, a different profile only links the walk to it; a hint says that the saved time stays as planned. Recomputing there was left for later (it needs `keepPreviousData`, so the dialog does not close while loading). (Done in phase D for A -> B, see section 12.)
- **Field errors:** `parseFieldErrors` puts DRF 400 messages under the fields the form shows; other messages go to a toast. Backend messages are English only.
- **Retries:** app-wide `retry: 1`, because the default 3 retries with growing delays kept a stopped backend "loading" for about 7 s. Route plans set `retry: false` themselves: `fetchQuery` turns retries off only when no default is set, and a 422 or 429 will not change.
- **Planner panel z-index** went from `z-1000` to `z-10`, so dialogs and selects (`z-50`) open above it. The map is in an `isolate` box, so Leaflet stays under the panel.
- **No `next-themes`:** the shadcn Sonner wrapper is replaced by a small `Toaster` with `theme="system"`.

## 10. Stage 6: trip ideas (backend)

Checked by hand on 2026-11-12.

### Overpass is overloaded; the demo uses recorded places

- From the developer's machine, `overpass-api.de`, `overpass.private.coffee`, `maps.mail.ru` and `overpass.kumi.systems` all failed, even for `[out:json];node(1);out;`: DNS, TCP and TLS took under 0.4 s, then no answer for 20-30 s, or a 502 at once. IPv4 and IPv6 behaved the same. So the network and our query were fine; the servers were full.
- The `overpass-api.de` page says: "Nowadays this server is overloaded ... do not expect high reliability. Use alternatives if possible." For regular use it asks for fewer than 100 queries per day, a User-Agent that names the app, caching, and no use from AI app platforms.
- Decision: **the demo must work on recorded data; live Overpass is a bonus.** `record_fixtures --trip --overpass-file <file>` takes places exported from Overpass Turbo (raw data, same JSON as the API) and records only the ORS routes. The trip search waits at most 12 s. Since 2026-11-14 route plans wait 12 s too (`TIMEOUT_S`; it was 25 s), and the query declares `[timeout:10]`, so the server gives up before the client: a live check on that day showed four public servers that did not answer even `/api/status` (`docs/AUDIT.md`, part 2).
- **Demo places first (2026-11-14).** A demo pair or the demo trip start with recorded places never calls Overpass; other points still do. Why: the public servers almost never answer, so asking first only made the demo wait 12 s before it used the same recorded places. Cost: the demo does not show fresher OSM data even when Overpass works; for three fixed routes this does not matter. To refresh, record again (`record_fixtures --pair N --overpass-file <file>`).
- Later (medium): a list of servers (`OVERPASS_URLS`) or a self-hosted Overpass for the public deploy.

### Demo trip recording

- `planning/fixtures/trip_demo.json` holds the Overpass answer around the demo start and the ORS routes of every rule-based plan prefix, keyed like the live cache (`routing.cache_key`).
- Opening hours change which places the rules pick, so plans are computed for every hour of a week. A route that is not recorded (for example a plan from an LLM) falls back to straight lines x 1.3 (`source: "mock"`).
- Only stable ORS answers are recorded (200, 2009, 2010); a 429 or 5xx stops the command.

### Trip planning in code

- **Radius:** pace x time limit / 2, between 300 and 1500 m.
- **Candidates:** at most 40, taken round-robin per category, closest first, so 30 playground parts cannot push out the only cafe. `amenity=ice_cream` is a cafe with `cuisine=ice_cream`.
- **New categories:** park, zoo, museum, beach and `shop` (supermarket, convenience, bakery). `shop` was added to `Stop.Category` (migration `0002`) and to the frontend lists. A place out of range goes to `unmet_wishes`; there is no public transport routing (later, large). Transit stops near the start are in the answer. For big areas (park, beach) the distance is to the centre, not to the entrance.
- **Time budget:** the plan may be 10% over `max_minutes`. Before routing, code drops the last stops while the straight-line estimate (x 1.3) is too long. After routing, it drops the last stop and routes again, at most twice, keeping at least one stop; then `over_limit` is set. Each dropped stop gets a tip ("skipped to fit the time limit") and is listed in `dropped_stops`, because the LLM summary may still mention it. Each re-route asks ORS for both routes; this is simpler than the planned "baseline only at the end", and the pre-trim makes re-routes rare.
- **No route to a stop is not an error.** In route plans, ORS 2009/2010 give 422, because the user chose the points. In trips the stops come from map data (a park or a beach is its centre point, often more than 350 m from a path), so the trip falls back to straight lines x 1.3 (`source: "mock"`) and logs a warning.
- **Errors:** 422 `no_places_nearby` (Overpass answered with nothing, or every place is closed) and 422 `places_unavailable` (Overpass failed). In both cases no LLM is called.
- **Rules engine:** keywords in PL and EN, in the order of the text. A keyword matches at a word start; a final `$` means the whole word ("kawa$" is coffee, "kawałek" is not). Unknown wishes use the default list by age. Toilets and water are never a trip on their own.
- **Weather:** Open-Meteo, coordinates rounded to 0.01 degree (about 1 km) before sending, cached 1 h per cell, 5 s timeout, `None` on any failure.
- **Opening hours:** own parser for `24/7`, day ranges and lists, several time ranges, `off`, and rules separated by `;` (a later rule wins for its days). Months, holidays, times past midnight and anything else give `null`. `open_now` is now set in route plans too.

### LLM backends

- **Anthropic (production):** official SDK `anthropic==2.8.0`, default model `claude-opus-5-5` (from the `claude-api` skill). JSON is forced with `output_config.format` (`json_schema`). Thinking is always on for this model and counts toward `max_tokens` (cap 4000). Timeout 30 s, one retry. The server-side refusal fallback is on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Not tested against the real API yet (no key used in stage 6).
- **`claude -p` (local):** tested from Python on Windows (`claude.EXE`). Without `--safe-mode` the answer followed the global `CLAUDE.md` (it printed the triage block). With `--safe-mode --system-prompt ... --json-schema ...` the answer object is in `structured_output`. Flags used: `-p --output-format json --tools "" --no-session-persistence --safe-mode --system-prompt --json-schema` (+ `--model` when `CLAUDE_CLI_MODEL` is set). A `.cmd`/`.bat` launcher is refused, because `cmd.exe` would parse the arguments again. PowerShell 5.1 itself breaks quotes and drops `""` when you type such commands by hand; Python is not affected.
- **NVIDIA (spare):** `/v1/models` lists the whole catalogue, not what the account can use: most models answer 404 "Function ... Not found for account". Working free models: `nvidia/nemotron-3.5-lightning-30b-a3b` (default; reasons first, about 230 tokens even for `{"ok": true}`, so `max_tokens` 2000) and `nvidia/nemotron-3.5-bolt-e4b` (small and fast). `response_format: json_object` works; `nvext.guided_json` returns 400 on both. `llama-3.1-nemotron-safety-guard-8b-v3` is a safety classifier, not a planner.
- **Chain:** `LLM_BACKEND`, then `LLM_FALLBACKS`, then always the rules. No new backend is tried after 60 s. Every attempt counts toward `LLM_DAILY_LIMIT` (cache key per day, kept 25 h; the file cache is not atomic, so two requests at the edge can both pass; accepted for a demo).
- **Logs:** a warning with the backend name and a short reason (our own text or the names of invalid fields). Never the prompt, the wishes or the model answer.
- **Display note:** `Invoke-RestMethod` in PowerShell 5.1 shows Polish letters broken, because DRF sends `application/json` without `charset` (JSON is UTF-8 by definition). Browsers and the frontend read it correctly.


### Trip ideas in the UI (stage 7)

- **Removing a stop does not recalculate the route.** `route-plans` takes only A -> B, and the trip-ideas contract has no "recalculate with these stops" call. So after a removal the UI keeps the planned geometry, subtracts the stop minutes from the total, and says plainly that the route and the arrival times are still the planned ones. The saved walk keeps that geometry. A recalculation endpoint is a possible next step.
- **The last stop cannot be removed:** a trip walk always has at least one stop.
- **Saved data:** stops get `order` 1..n in the trip order, `source` `"rules"` for the rule engine and `"ai"` for any LLM engine, the LLM `reason`, and the trip `summary` as `ai_summary`. A round trip ends at the start; a one-way trip ends at the last kept stop.
- **One request, no cache:** trip ideas are a TanStack Query mutation. Every "Suggest" is a new call, and the client sets no timeout, because the backend ends the LLM call after 60 s and answers with rules.
- **Language:** the UI language is sent as `pl` or `en` (`en-GB` becomes `en`).

### Visual redesign "Nordic Sage" (stage 7b)

- **Why a redesign:** an audit of the code (2026-11-13) found that all colour tokens were the
  default grey shadcn palette, about 40 raw colours lived in components and map code, the stairs
  result was a small alert in a long list, and most text was 12-14 px.
- **Direction:** three directions were compared (warm natural, calm tool-like, playful). The
  developer chose the warm natural one with a Scandinavian, minimal style and a deep navy
  (`#12334A`) from an earlier idea. Spec: `docs/DESIGN.md`.
- **No reverse geocoding.** The mock-up showed a place name for a clicked point. Getting it would
  send the user's coordinates to a new outside service (AGENTS.md rule 5). The UI shows
  "Point on the map" instead; demo routes keep their names.
- **No dragging of the bottom sheet.** It needs gestures, keyboard access, tests and maybe a new
  package. The handle is visual only and the sheet opens and closes as before.
- **Figma:** Light and Dark are two variable collections, because the free Figma plan allows one
  mode per collection. The Figma MCP Starter plan has a monthly call limit, so `docs/DESIGN.md`,
  not Figma, is the source of truth for agents.
- **Map colours follow the theme (stage 7b, session 2).** Leaflet draws lines as SVG with a
  colour attribute, and an attribute cannot read `var(--brand)`. `src/lib/cssColors.ts` reads the
  CSS variables from `<html>` and a `MutationObserver` on its `class` re-reads them when the theme
  changes (button or system setting), so `lib/theme.ts` did not need to change. Markers are HTML,
  so they use `var(--...)` directly and need no JavaScript. Missing variables fall back to the
  light theme values.
- **Success card text stays navy.** With the first sage `brand`, its text on `brand-soft` was only
  about 4.3:1 (under 4.5:1). The success card uses `foreground` text with a `brand` icon and
  border; with the later forest green this is kept for calm, readable text. Stars in the rating use `sage-500` (graphics only).
- **Removed tokens:** the shadcn `sidebar-*` and `chart-*` tokens; nothing in the app used them.
- **Readable route on OSM tiles.** Sage green is close to the parks and grey streets on the tiles.
  Routes and stairs get a casing (a wider line in the `card` colour underneath), and the tile pane
  gets a CSS filter: softer colours in the light theme (saturate 0.7), inverted brightness with `hue-rotate` in
  the dark theme. The tiles stay OpenStreetMap; only the browser recolours them.
- **More colour: forest green actions, turquoise route (2026-11-13).** The first Nordic Sage
  version looked calm but grey. The developer chose a forest green `brand` for the main button,
  switches and selected states, a turquoise `route` line with a white casing and a glow (a wide,
  transparent line, because CSS filters on SVG paths are not reliable in every browser), A = green,
  B = navy. Orange stays for stairs and warnings only, never for markers or actions, so it
  always means "be careful".
- **Category colours: five groups, not eleven colours (stage 7b, session 3).** New tokens
  `cat-play` (playground, zoo, beach), `cat-food` (cafe, restaurant, shop) and `cat-care`
  (toilets, water); parks and benches use `sage-500`, museums and unknown places
  `muted-foreground`. Each has at least 5:1 on white and 6:1 on the dark card (graphics need 3:1).
  No orange or yellow, because terracotta means stairs. `categoryColor()` returns `var(--...)`,
  because Tailwind cannot see class names built at runtime; the map markers use the same value.
- **Touch sizes in the shared components.** Buttons, inputs, selects and tabs are 44-48 px high,
  so every page gets larger targets, not only the planner. Dense chips (`size="sm"`, demo routes,
  time limits, place filters) are 36 px with an 8 px gap.
- **Phone menu as a popover.** Language and theme are toggles, not commands, so the "more" button
  opens a Radix Popover (already in `radix-ui`, no new package). From 768 px they sit in the bar.
- **Point rows never show coordinates.** The label is "Point on the map" or the demo name; the
  coordinates are in a closed `<details>`. The demo name is derived from the point (a point equal
  to a demo point), so a map click removes it with no extra state.
- **Result title is 20 px, not 24 px.** Polish result titles are long full sentences; at 24 px they
  wrap to three or four lines on a phone.
- **Legend chip.** Phones: an "i" button under the zoom buttons opens it, because an open chip
  covered point B (developer check). From 768 px: always open, bottom left of the map.
- **Marker outline is `card`, not white.** In the dark theme point B is light, so a white outline
  disappeared. `card` is white in the light theme (as in the mock-up) and navy in the dark one.
- **Collapsible sections use a button inside the heading**, not `<details>`: a heading inside
  `<summary>` is lost for some screen readers, because `<summary>` acts as a button.
- **Other pages: a 960 px column (stage 7b, session 4).** Walks, walk detail and profiles use
  `max-w-240` with cards on `background`; the top bar uses the same width, so both edges line up.
- **One warning banner for every load error.** `WarningBanner` (`stairs-text` on an 8% `stairs`
  tint) replaces the red `destructive` boxes on all pages and in the planner. 8%, not 10%: at 10%
  the text is 4.42:1 on the light background (under 4.5:1); at 8% it is 4.52:1 on `background`,
  4.87:1 on `card` and over 7:1 in the dark theme (checked with a script).
- **Empty states have one action.** A dashed card with a `muted-foreground/40` outline (the plain
  `border` colour was almost invisible on white, developer check). When the page header already
  has the primary button, the empty state action is `secondary`, so there is one primary per screen.
- **Walk cards: a stretched link.** Only the name is a link; its `::after` layer covers the card.
  The whole card is clickable and the heading stays a heading for screen readers.
- **Walk filters look like tabs but are toggle buttons** (`aria-pressed`). They filter one list;
  tabs (`role="tab"`) would promise separate panels.
- **Saved stops: number + category colour.** On the walk map a stop is its number on a `card` circle
  with a category-coloured outline. The order matters on a saved walk, so the number stays; the
  colour matches the icon in the stop list. Marker helpers moved from `MapView` to `lib/mapIcons.tsx`
  so both maps share them.
- **"Delete walk" sits at the end of the page,** under a line, as a red outline button. It is rare
  and cannot be undone, so it is not next to the title.
- **Dialogs scroll and keep their actions visible.** The base dialog is `card`, `rounded-2xl`,
  `max-h-[calc(100dvh-2rem)]` with its own scroll (`dvh` shrinks with the on-screen keyboard), and
  `DialogFooter` sticks to the bottom. Its negative margins match the dialog padding (20/24 px); change
  both together. The overlay is `foreground/25` (light) and `background/70` (dark) instead of black.
- **Shadows use plain black with low alpha** (`rgb(0 0 0 / 0.12)`). They are not palette colours,
  and both themes need the same dark shadow, so there is no token for them.

### Write limits on the walks API (audit S2, S3, W1)

- **Writes are limited per IP, not per client:** `WRITES_RATE` (default `120/hour`) counts POST,
  PUT, PATCH and DELETE on walks, stops, profiles and demo data. A new random `X-Client-Id` is free,
  so a per-client limit is easy to skip. Reads are not counted. Known cost: people behind one
  carrier IP (CGNAT) share the limit; raise it in `.env` if that becomes a problem.
- **At most `MAX_WALKS_PER_CLIENT` walks per client** (default 200); a new walk over the limit
  gives 400. Edits are allowed. Profiles have no own limit: they are small templates, and the
  per-IP limit covers them.
- **The shared `demo` client is read-only.** A write without `X-Client-Id` gives 400 (not 403:
  the client can fix it by sending the header, like a bad header gives 400). The frontend always
  sends the header, and `seed_demo` writes through the ORM, so neither is affected.
- **`/api/stops/` checks what the nested create checks:** at most 20 stops per walk and a different
  `order` for each stop. No database constraint yet: it needs a migration, and old databases may
  already have duplicate orders.

### LLM time budget and Anthropic effort (audit L1, L2)

- **One deadline for the LLM chain:** it ends 50 s after the request starts. Each backend gets
  only the time that is left as its timeout, and none starts with less than 5 s. The Anthropic
  client does not retry. With up to 60 s of ORS calls after it, a request stays under the planned
  120 s gunicorn timeout. Known gap: the httpx and SDK timeouts limit each network step, not the
  whole call, so a very slow stream can go a little over.
- **`effort: medium`, `max_tokens: 8000`.** Measured on 2026-11-14 with `claude-opus-5-5`, the
  demo trip (40 candidates, about 4,170 input tokens), 3 fake wishes per level:
  - `low`: 4.7-5.5 s, 292-333 output tokens, 2 of 3 answers valid (one `unmet_wishes` text over
    80 characters).
  - `medium`: 8.2-8.5 s, 672-706 output tokens, 3 of 3 valid.
  An invalid answer is paid for and then replaced by the rules, so `medium` wins for now. The
  sample is small. Try `low` again after audit L3 (cutting too-long texts in code). Every call
  ended with `end_turn`, far below 8,000 tokens.
- **`ANTHROPIC_MODEL` takes an API model id** (`claude-opus-5-5`), not a CLI alias like `opus`:
  the API answers 404, and every trip falls back to the rules. Leave it empty for the default.

## 11. Phase A decisions (2026-11-14)

Decisions taken before the remaining backlog (`docs/AUDIT.md`, "Updated order", phase A).

- **Places come from our own `Place` table (audit task 10, option A1).** A one-time export from
  Overpass Turbo (our tags, Tricity) goes through the existing parsers into SQLite with an
  `import_places <file>` command. `pois.py` reads by bounding box and filters by distance in
  code. Live Overpass stays as an optional provider (`POI_PROVIDER=overpass`) for points outside
  the import. This replaces "Overpass only" in section 1: the data is still OSM, but imported.
  Why: the public Overpass servers are overloaded (section 10, audit part 2); a local table is
  fast, works offline and in CI, and needs no new dependency. A Geofabrik extract with `osmium`
  (option A2) was rejected for now: a heavy dependency and a file too big for the repo.
- **The app and the README say plainly that place data covers the Tricity only.** The note
  explains why (the public Overpass API is often overloaded) and what we considered for a
  production version: a self-hosted Overpass service in Docker, or regular imports of more
  regions on the server. Why: a reviewer should see that we know the limit and how to lift it.
- **"Use my location" is a one-time browser position (idea 8, D9).** A button calls
  `navigator.geolocation` once, sets point A or the trip start and centres the map. Nothing is
  stored. The position goes only to our backend, like a map click; never to the LLM or a new
  outside service. No live tracking (`watchPosition`): that would be navigation, which
  `docs/PLAN.md` section C still excludes. A point outside the Tricity gets a clear message.
- **Export to Google Maps is a directions link with up to 9 waypoints (idea 9, D9).** Code builds
  a `google.com/maps/dir/?api=1` link with `travelmode=walking`: the stops first, then points
  picked from our own geometry (mainly on the stair-free detour), at most 9 waypoints in total,
  so Google stays close to our route. No key, no Google API, no Google data stored, so the
  "OSM only" rule for our data holds. Google still routes by itself between the points, so the
  UI warns that it may choose a way with stairs. This is a key feature, so it moved up the
  backlog. Considered for later: a GPX file of our exact route, and a public share link to a
  saved walk (needs an API change).
  Update (2026-11-14, built): **at most 3 waypoints**, not 9. The Google Maps URLs docs say
  mobile browsers accept only 3, and the app is mobile first. A trip uses its remaining stops
  (the first 3; the UI says when stops are cut). A route uses 3 points sampled evenly from our
  stair-free line. Points only on the parts that differ from the baseline were left for later.
- **TypeScript types are generated from the OpenAPI schema (idea 18).** `openapi-typescript`
  (dev dependency, pinned) turns the `drf-spectacular` schema into `src/api/schema.d.ts`;
  `src/api/types.ts` becomes aliases of the generated types. The generated file is committed
  and a CI check fails when it is out of date. Why: types only, no runtime code, and the API
  layer in `src/api/` stays as it is. Rejected: client generators (`orval`, `@hey-api`), because
  they replace our tested API layer; a schema snapshot test alone, because it does not check
  the frontend types. Views with hand-built answers may need `@extend_schema` first.
- **Stops are reordered with up/down buttons (idea 16).** No drag library. Why: a trip has a few
  stops, the list lives in a bottom sheet over the map on a phone, and buttons are accessible by
  default and easy to test. The same reason as for the bottom sheet in stage 7b. Drag and drop
  (`@dnd-kit`, maybe from 768 px) is a possible extra later.

### Generated API types (phase B, idea 18)

- **Two committed generated files:** `backend/openapi.yml` (drf-spectacular) and
  `frontend/src/api/schema.d.ts` (`npm run gen:api`). Each language checks its own file: a
  pytest test compares the schema with a fresh one, and a CI step in the frontend job runs
  `gen:api` and fails on a diff. So no CI job needs both Python and Node.
- **`COMPONENT_SPLIT_REQUEST: True`.** Without it, one `Walk` component is used for reading and
  writing, and the generated type would require `id` and `created_at` in a POST body.
- **npm `overrides` for TypeScript.** `openapi-typescript` 7.13.0 declares the peer
  `typescript: ^5.x`; we pin 6.0 (section 1). The override makes it use our version. It only
  uses TypeScript to print the output, and the generated file passes `tsc`. Remove the override
  when a release supports TypeScript 6.
- **`types.ts` keeps three hand-written fixes:** `[lat, lng]` tuples (OpenAPI has no tuples),
  `Required<...>` for saved data (fields with a model default are optional in the schema but
  always sent), and the frontend-only `Poi.accessibility`.
- **JSON fields get a schema shape** with two schema-only subclasses in `walks/serializers.py`
  (`IntListJSONField`, `LatLngListJSONField`); validation stays in the `validate_*` methods.

### Place table (phase B, audit task 10)

- **Data:** `backend/data/places_tricity.json.gz`, an Overpass Turbo export from 2026-11-14, gzipped (21 061
  elements, 5.4 MB raw, 0.5 MB gzipped; re-exported in phase D with skateparks). It is committed, so a fresh clone works after `migrate` and `import_places`.
  The query (export as raw OSM data, JSON):

  ```
  [out:json][timeout:180][bbox:54.27,18.43,54.62,18.80];
  (
    nwr["leisure"~"^(playground|park|indoor_play)$"];
    nwr["sport"="skateboard"];
    nwr["amenity"~"^(toilets|cafe|ice_cream|restaurant|fast_food|bench|drinking_water)$"];
    nwr["tourism"~"^(zoo|museum)$"];
    nwr["natural"="beach"];
    nwr["shop"~"^(supermarket|convenience|bakery)$"];
    node["highway"="bus_stop"];
    node["railway"="tram_stop"];
  );
  out center tags;
  ```
- **Rows keep raw OSM tags** (only our keys plus `name`, `opening_hours`, `cuisine`, `wheelchair`,
  `changing_table`). The `db` provider turns rows back into an Overpass-like body, so the same
  parsers and rules in `pois.py` serve both providers.
- **Reading:** a bounding box query (index on `lat`, `lng`), then distances in code. Route places
  are kept within 150 m of the *segments* of the same simplified line the Overpass query uses
  (`geo.distance_to_polyline_m`), not only of its vertices. Both routes and trips answer in
  under 50 ms on the full import.
- **Area:** `PlaceImport` stores the bounding box of the last import. A route end or a trip start
  outside it gives `pois_status: "outside_area"` (route plans, still 200) or a 422 with code
  `outside_area` (trip ideas). An empty table gives the usual `unavailable` and a log hint to run
  `import_places`. Recorded demo places in fixtures still come first.
- **`POI_PROVIDER`:** `db` (default) | `overpass` | `mock`. The old `auto` still means `overpass`.
- **`indoor_play` checked (closes D7 and audit O7):** 16 elements with `leisure=indoor_play` in
  the Tricity export. Added as a category (stop model, both tag tables, trip rules with 60 min and
  the wishes "sala zabaw" / "indoor play", icon and pl/en labels).

## 12. Phase D: the profile as a template (2026-11-14)

- **The profile is a template for both planner modes.** It sets the defaults; the user can still
  change them in the planner.
- **Children are optional (audit idea 5).** A profile can have 0-6 children. A profile without
  children is only a pace and a way of moving.
- **"Wheels" stays in the API, only the UI changes.** The field is shown as "How do you get
  around?" with "On foot", "With a stroller" and "With a balance bike". Renaming the field would
  need a migration and an API change and gives the user nothing.
- **A stroller or a balance bike turns on "Avoid stairs" by default.** It is a default, not a
  lock: the switch stays usable.
- **Age picks the places** (rules in code, not the LLM): 0-1 park and cafe, 2-8 playground and
  cafe, 9-12 playground or park and ice cream or cafe, 13-17 park and skatepark. No children:
  park and cafe. With several children, the bands are joined, youngest first. A missing default
  place is not reported as an unmet wish, because the user did not ask for it.
- **Skatepark is a category:** matched by `sport=skateboard` (mostly on `leisure=pitch`). The
  re-export found 25 in the Tricity. Wishes: "skatepark", "deskorolka", "rolki", "hulajnoga".
- **No age filters in the A -> B mode:** the route shows all places; the user filters them.
- **Ideas 13 and 22:** idea 13 (at least one stop on a saved trip walk) is dropped. Idea 22
  (recompute the time in the save dialog) moves to phase D, after the profile changes.
- **The pace is a slider in km/h (audit idea 3, W4).** `FamilyProfile.pace_kmh` is a number from
  2.5 to 5.5 in steps of 0.5 (default 3.5). It replaces `relaxed` / `normal`. Migration 0005 keeps
  today's times: relaxed = 3.5, normal = 4.5, normal with a stroller = 4.0. The migration can be
  reversed. A float, not a Decimal: DRF sends a Decimal as a string.
- **A stroller is capped at 4 km/h in two places.** The UI slider stops at 4.0 for a stroller
  (and a faster pace drops to 4.0 when the user picks a stroller). The backend keeps
  `min(pace, 4)` as a safety net for other clients.
- **The planner sends the pace.** `route-plans` and `trip-ideas` take an optional `pace_kmh`. When
  sent, it wins over the profile pace. The planner slider starts from the profile (no profile:
  4 km/h) and resets when the profile changes. A changed pace in the A -> B mode hides the old
  result until the user plans again, like the "Avoid stairs" switch. Trip ideas have no result
  cache, so a new pace never returns an old answer.
- **Saved planner settings (audit idea 4).** The profile keeps `trip_minutes` (15-180, default 60)
  and `round_trip` (default true) as plain fields, not JSON: they get validation and real types in
  OpenAPI and TypeScript. Picking a profile in the planner sets the pace, the time limit and
  "come back to the start". A "Save to the profile" button appears when these differ from the
  profile; the profile form edits them too. "Avoid stairs" is not saved: it still follows the way
  of moving. Wishes and the start point are never saved (free text and coordinates, rule 5).
- **The save dialog recomputes the time (audit idea 22).** A -> B: another profile in the dialog
  sends `route-plans` again with that profile and its pace (the cache answers a known request).
  `keepPreviousData` keeps the last time on screen while loading, and "Save" waits for the new
  time, so the walk is never saved with the time of the wrong profile. If the request fails,
  the planned time is saved and a hint says so. A trip keeps the hint only: a new trip would be
  a paid LLM call.

## 13. Phase F: extras (2026-11-14)

Decided with the developer before the code. Order: calories (idea 1), place search (idea 15),
best time for a walk (idea 2 with the X1 credit). Each is its own branch from `dev`.

- **Calories (idea 1).** Fixed formula in `planning/calories.py`, no LLM:
  `kcal = MET x 70 kg x hours`, MET interpolated from the pace (Compendium of Physical
  Activities, level walking). A fixed adult weight of 70 kg, so the app stores no body data.
  A stroller adds 5% (a stroller profile, or no profile, because the app assumes a stroller).
  Only the walking part counts, not the time at stops. `route.kcal` is in both `route-plans`
  and `trip-ideas`; the UI shows "about N kcal", because it is a rough estimate.
- **Place search (idea 15).** Searches our own `Place` table only, no outside geocoder. It sets
  the start point only.
- **Best time for a walk (idea 2).** Its own card in the planner, for the chosen start point.

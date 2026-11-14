# Repository audit

A read-only review of the whole repository after the MVP (stages 1-7b), before deploy (stage 8)
and the final README (stage 9). The audit changes no code. Every finding goes to the backlog in
part 5, and fixes are done later as separate tasks, each on its own branch.

Started: 2026-11-14. Branch: `docs/repo-audit`.

## How to read this file

Each finding has an id, a priority and a size:

- **P1**: a bug, a security risk, or something that blocks the deploy or spoils the first
  impression of a reviewer.
- **P2**: technical debt, a missing test, an inconsistency.
- **P3**: cosmetic, a small improvement.
- Size of the fix: **S** (under 1 h), **M** (a few hours), **L** (a session or more).

Format: `ID [P?/size] where - problem. Why it matters. Proposed fix.`

## Plan and progress

| Part | Scope | Status |
|---|---|---|
| 0 | Baseline: tests, linters, build, dependency audit | Done |
| 1 | Documentation | Done |
| 2 | Overpass and place data: diagnosis and alternatives | Done |
| 3a | Backend: `config/`, `walks/`, security, deploy readiness | To do |
| 3b | Backend: `planning/` and `planning/llm/` | To do |
| 4a | Frontend: architecture, TanStack Query, TypeScript, tests, bundle | To do |
| 4b | Frontend: UI/UX, accessibility, i18n, mobile | To do |
| 5 | Cross-cutting checks and the prioritized backlog | To do |

## Part 0: Baseline

Run on 2026-11-14 on `dev` at `a2b9275`.

| Check | Result |
|---|---|
| `pytest` (backend) | 353 passed, 2.9 s |
| `ruff check .`, `ruff format --check .` | Clean (72 files) |
| `manage.py check --deploy` (local `.env`, `DEBUG=1`) | 6 warnings: W004, W008, W009, W012, W016, W018 |
| `pip-audit -r requirements-dev.txt` | No known vulnerabilities |
| `npm run test` (Vitest) | 130 passed in 33 files, 18.8 s |
| `npm run lint`, `format:check`, `typecheck` | Clean |
| `npm run build` | OK, but one JS chunk of 1,011 kB (311 kB gzip), over the 500 kB warning |
| `npm audit` | 14 (2 low, 12 moderate), 0 high, 0 critical |
| `npm audit --omit=dev` | 6 (2 low, 4 moderate) |
| CI (`.github/workflows/ci.yml`) | Runs the same checks as above, except the audits |

### Findings

- **B1 [P2/S] `frontend/package.json`** - `shadcn` (a CLI that copies component code into the
  repo) is in `dependencies`. It is not needed at run time, and it brings 6 audit warnings into
  the production tree (`deepmerge`, `minimatch`). Move it to `devDependencies`.
- **B2 [P2/S] dev tooling** - the other 8 warnings come from `minimatch` through `eslint` and
  `typescript-eslint`. This code never reaches the browser. Update these tools on purpose in a
  separate task; do not run `npm audit fix --force` (it jumps major versions).
- **B3 [P2/M] bundle size** - the whole app is one 1 MB chunk. On a phone during a walk this is
  slow on mobile data. Look at lazy loading of pages (`React.lazy`) and of Leaflet in part 4a.
- **B4 [P2/S] `check --deploy`** - the warnings come from the local dev `.env`, so they are
  expected here. Part 3a checks that production settings (`SECURE_*`, HSTS, secure cookies,
  `SECRET_KEY`) can be turned on by environment variables before stage 8.
- **B5 [P3/S] no coverage report** - neither `pytest-cov` nor Vitest coverage is set up, so the
  audit cannot show numbers. Optional: add them (new dev dependencies, ask first).
- **B6 [P3/S] `backend/pyproject.toml:13`** - `addopts = "-q"`, so `pytest -q` becomes `-qq` and
  hides the summary line ("353 passed"). Minor, but confusing when reading CI logs.
- **B7 [P3/S] Vitest speed** - jsdom is created 33 times (55 % of the run time). Vitest suggests
  `pool: 'vmThreads'`. Only worth it if the suite grows.

## Part 1: Documentation

Files read: `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/PLAN.md` (sections C, D.2, D.4, E),
`docs/DECISIONS.md`, `docs/AI_USAGE.md`, both `.env.example` files, `ci.yml`.

Checked against code: environment variables (all 23 variables read by the code are in
`.env.example`, and none is extra), endpoints in D.4 against `urls.py`, npm scripts named in the
README against `package.json`. These all match.

### Findings

- **D1 [P1/M] `README.md`** - the README still describes stage 1:
  - `README.md:3` says "Work in progress ... the code follows stage by stage".
  - `README.md:11-15` marks the features as not done.
  - `README.md:59` says the home page shows "The server works"; the planner is the home page now.
  - Missing: what the app does with a screenshot, demo mode and `seed_demo`, optional keys (ORS,
    LLM backends), the known Overpass limits, architecture, API, how the AI feature works, tests.

  It is the first file a reviewer reads. Stage 9 already plans the full README (outline in
  `docs/PLAN.md`, section H). Until then, at least remove the false status lines.
- **D2 [P1/S] `README.md`, `docs/DECISIONS.md:213-218`** - the documentation does not say clearly
  that live places from Overpass almost never load, and that the demo depends on recorded data.
  A reviewer who runs the app with a fresh clone sees empty place lists and does not know why.
  Depends on the result of part 2.
- **D3 [P2/S] `README.md:73`** - says `docs/PLAN.md` is "in Polish". It is in English.
- **D4 [P2/S] `docs/PLAN.md`, section E** - only stages 0 and 7b are marked "DONE"; stages 1-7
  are done but not marked.
- **D5 [P2/S] `docs/PLAN.md:452`, `:1371`** - two `[TO VERIFY]` notes are still open (the list of
  free NVIDIA models, the syntax of the permission rules). Close them or write the result.
- **D6 [P3/S] `docs/PLAN.md:95-160` (D.2)** - the planned tree names `clientId.ts` and
  `config.ts`, which do not exist. Update the tree to the real structure, or add a note that D.2
  was the plan and the code is the source of truth.
- **D7 [P2/S] `docs/DECISIONS.md:186`** - "`indoor_play` not checked yet ... check again in stage
  6" was never closed. Close it in part 2 (it needs working place data).
- **D8 [P3/S] `docs/AI_USAGE.md:21`** - says the stage logs go from `stage-1.md` to `stage-7.md`;
  `stage-7b.md` exists too.
- **D9 [P2/S] `docs/PLAN.md`, section C "Explicitly NOT doing"** - some new feature ideas
  (location of the user, export to Google Maps) touch items on this list ("GPS", "Google Maps
  data"). If they are accepted, record the change of scope in `DECISIONS.md` with the reason.
  Note: a one-time location and a Google Maps link are not navigation and use no Google data, so
  they likely fit; this needs a short decision, not a rewrite.

### What is good

- `DECISIONS.md` is a strong document: verified facts with dates and sources, and the reasons for
  each choice. It also records failures honestly (Overpass, plan errors).
- `.env.example` matches the code exactly.
- `AGENTS.md` and `CLAUDE.md` are short, concrete and consistent with each other.
- CI runs the same checks as the README lists.

## Part 2: Overpass and place data

Files read: `backend/planning/pois.py`, `services.py` (`_pois`), `trip_planner.py`
(`_candidates`), `management/commands/record_fixtures.py`, `config/settings.py:140-141`, the four
files in `planning/fixtures/`, `docs/DECISIONS.md` sections 1, 3, 7 and 10.

### Live check (2026-11-14, about 13 requests, demo point in Chelm only)

| Server | `/api/status` | Small query (playgrounds, 300 m) |
|---|---|---|
| `overpass-api.de` | no answer in 25 s | no answer in 25 s |
| `overpass.private.coffee` | no answer in 25 s | no answer in 25 s |
| `maps.mail.ru` | 200 after 19 s | no answer in 25 s; a second try: 504 at once |
| `overpass.kumi.systems` | no answer in 25 s | no answer in 25 s |

Control: `api.open-meteo.com`, `www.openstreetmap.org` and the static home page of
`overpass-api.de` all answered in under 0.5 s. DNS, TCP and TLS to the API took under 0.15 s, then
nothing. So the network is fine and the API itself does not answer, even for `/api/status`, which
does no database work. This is the same picture as on 2026-11-11 (`DECISIONS.md:215`).

### Diagnosis

1. **The main cause is outside our code.** The public Overpass servers are overloaded. Our query
   is not the reason: a trivial status call hangs too. No change to the query will make live
   places reliable.
2. **What the user sees today:**
   - Trip ideas: the demo start works from `planning/fixtures/trip_demo.json` (268 elements).
     Any other start gets 422 `places_unavailable` after up to 12 s.
   - Route plans: the three demo pairs have `"overpass": null`, so **no place is ever shown on a
     demo route**. Any other route waits up to 25 s, then shows "Load places again", which
     usually fails again.
3. **The code handles the failure correctly:** no sleep, no retry, no invented places, honest
   status, only successful answers cached (`pois.py:108-135`). This part needs no fix.

### Findings

- **O1 [P1/S] `planning/fixtures/pair_*.json`** - the demo routes have no recorded places (see
  diagnosis 2). The first thing a reviewer clicks shows an empty list. `record_fixtures` accepts
  `--overpass-file` only with `--trip` (`record_fixtures.py:136`). Fix: allow
  `--overpass-file` per pair (or record them when a server answers), export the three route
  queries from Overpass Turbo in the browser, and record them.
- **O2 [P1/S] 25 s wait on route plans** - `TIMEOUT_S = 25` (`pois.py:22`) holds a gunicorn worker
  and the user for 25 s for an answer that almost never comes. Trip ideas already use 12 s. Fix:
  use the same short timeout for both (10-12 s). The route itself is ready at once, so the user
  loses nothing.
- **O3 [P2/S] no short negative cache** - failed answers are not cached, so every "Load places
  again" and every new request hits a server that has just failed. Fix: remember "Overpass down"
  for about 60 s (one cache key) and return `unavailable` at once. This is kinder to the server
  and faster for the user. It is not a sleep and not a retry, so it fits `DECISIONS.md:17`.
- **O4 [P2/M] one server only** (`settings.py:141`) - `OVERPASS_URLS` with failover is already an
  idea (`DECISIONS.md:218`). Today's check shows it does not help: all four servers failed
  together. Worth it only with a total time budget (for example 12 s for all servers), and only
  as a small extra. Do not spend a session on it.
- **O5 [P3/S] query cost** - each query has 2 x 7 statements (`node` and `way` for every key,
  `pois.py:96-101`) and value regexes. `nwr[...]` would halve the statements, and the dispatcher
  admits queries that declare less memory more easily (a `[maxsize:...]` lower than the 512 MiB
  default). Not verified on a working server; small gain, because the servers hang even for
  `/api/status`.
- **O6 [P3/S] cache key** - the key is the query hash with coordinates at 6 decimals
  (`pois.py:79`), so two clicks a few metres apart never share a cache entry. For trip ideas the
  start could be rounded to about 50 m before the query. Small gain; the radius is 300-1500 m.
- **O7 [P2/S] `DECISIONS.md:186`, D7** - `indoor_play` is still unchecked: no server answered
  today. Fix: the developer counts `nwr["leisure"="indoor_play"]` in Gdansk in Overpass Turbo (it
  worked in the browser in stage 6) and writes the result to `DECISIONS.md`.

### Alternatives for place data

The app needs a few thousand places in one region (Tricity), read-only, refreshed rarely. Live
queries to a shared public server are the wrong tool for that.

| Option | What it is | Pros | Cons | Size |
|---|---|---|---|---|
| **A. Own place table from an OSM extract** (recommended) | A management command reads the Geofabrik `pomorskie` extract once, keeps only our tags, and saves them in a `Place` model in SQLite. `pois.py` reads places by bounding box, then filters by distance in code, as today. | Fast (milliseconds), works offline and in CI, no rate limits, same OSM data and licence (ODbL, attribution already needed). The parsers and rules stay the same. Removes the fixtures problem. | A new model, a migration and an import command; a parser dependency (for example `osmium`, ask first) or a one-time Overpass Turbo export. Data is as fresh as the last import (fine for parks and playgrounds). Only the imported region works. | L (one session) |
| B. Self-hosted Overpass (Docker) | Run Overpass with the `pomorskie` extract next to the app. | The code does not change, only `OVERPASS_URL`. | A heavy service (several GB of disk, updates, memory) for a small portfolio deploy; free hosting will not run it. | L, plus running costs |
| C. Server list with failover (O4) | Try 2-4 public servers in turn within one time budget. | Small change. | Today all servers failed together. It treats the symptom. | M |
| D. Overture Maps places | Open dataset (GeoParquet), read with DuckDB. | Many POI, partly from other sources than OSM. | Licence and quality for Poland not checked; categories differ (no `playground`, `bench`); new heavy tools. | L, research first |
| E. Google Places with the user's key | On demand, not stored. | Good coverage. | Terms forbid storing, costs money, needs a key, against "OSM only" (`DECISIONS.md:11`). | M, not recommended |

**Recommendation:** first O1 and O2 (small, they fix what a reviewer sees), then option A as its
own stage before the deploy (stage 8). Keep live Overpass as an optional provider
(`POI_PROVIDER=overpass`) for regions outside the import. Option A changes a decision in
`DECISIONS.md:11` (from "Overpass only" to "OSM data, imported"), so record it there first. It
also unblocks feature idea 10 (place search): a local table can be searched by name.

## Feature ideas (input for part 5)

Collected now, so the audit can mark which findings block which idea. They are not planned or
estimated yet; part 5 sorts them into the backlog.

### From the developer (2026-11-14)

Planner:
1. **Calorie estimate** for a walk. Simple fixed formula on the backend (deterministic, no LLM).
2. **Best time for a walk:** from the weather forecast, show the best day and hour from today up
   to 3 days ahead. (Open-Meteo is already used in `planning/weather.py`.)
3. **Pace slider:** slow to fast, used in the request. (Today the profile has two paces,
   `relaxed` and `normal`, see `docs/DECISIONS.md:176`.)
4. **Saved planner settings:** the user can save a set of settings, and it is kept in the profile.

Profile:
5. **A child is not required** to save a profile.

Look:
6. **Demo click centres the map** on the marker.
7. **"Trip idea" first:** change the order, so the trip idea mode is the first tab.

Location and Google:
8. **Use the user's location** as the start of a trip (browser geolocation).
9. **Export a trip to Google Maps** (a directions link with the stops).
10. **Place search**, for example "Park Oliwski" (least important).

### Earlier ideas already in the repo

From `README.md` "Possible next steps":

11. Any time limit: a slider with a number field (15-180 min) instead of five buttons.
12. Keep the old trip when a new start is picked, and ask before replacing it.
13. At least one stop on a saved trip.
14. Recalculate the route after removing a stop.

From `docs/PLAN.md`, MVP "NICE":

15. Address search (Nominatim). Same need as idea 10.
16. Reordering stops by drag and drop.
17. "Strict" mode (ORS `wheelchair` profile: surface, kerbs).
18. TypeScript types generated from OpenAPI.
19. A "How it works" page.

From `docs/DECISIONS.md`:

20. A list of Overpass servers or a self-hosted Overpass (`DECISIONS.md:218`). Covered by part 2.
21. Other place sources: on-demand Google with the user's own key, Overture Maps
    (`DECISIONS.md:16`). Covered by part 2.
22. Recompute the walking time when the profile changes in the save dialog
    (`DECISIONS.md:203`).

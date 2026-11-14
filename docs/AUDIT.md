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
| 3a | Backend: `config/`, `walks/`, security, deploy readiness | Done |
| 3b | Backend: `planning/` and `planning/llm/` | Done |
| 4a | Frontend: architecture, TanStack Query, TypeScript, tests, bundle | Done |
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

## Part 3a: Backend core, security and deploy readiness

Run on 2026-11-14 on `dev` at `9656488` (after the fixes for O1 and O2).

Files read: `config/settings.py`, `config/urls.py`, `walks/` (`models.py`, `serializers.py`,
`views.py`, `scoping.py`, `urls.py`, `demo_data.py`, `seed_demo`), `requirements*.txt`,
`backend/.env.example`, `docs/PLAN.md` D.10 and "Stage 8". The deploy target is a small VPS with
Docker Compose (Django on gunicorn, nginx, cloudflared).

### Findings

- **S1 [P1/M] `config/settings.py`** - there are no production security settings, and none of
  them can be turned on by an environment variable: `SECURE_PROXY_SSL_HEADER`,
  `SECURE_SSL_REDIRECT`, HSTS, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`,
  `CSRF_TRUSTED_ORIGINS`. This confirms B4. Checked: with `DEBUG=0`, a strong random key and a
  real host, `check --deploy` still gives W004, W008, W012 and W016. Stage 8 already plans this. Fix there, with the planned
  production settings test.
- **S2 [P1/S] write endpoints have no rate limit** - only `route-plans` and `trip-ideas` are
  throttled (`planning/views.py:103`, `:210`). `/api/walks/`, `/api/stops/`, `/api/profiles/`
  and `/api/demo-data/` accept any number of writes, and every random UUID is a new client.
  Checked: 150 walk POSTs in a row all gave 201, and 30 `demo-data` POSTs with new UUIDs created
  60 more walks. One walk at the limits (5,000 points, 20 stops, full texts) is 138 kB of JSON.
  A simple script could fill the disk of the VPS with SQLite rows. Fix: a per-IP throttle for unsafe methods (for example
  `120/hour`), and optionally a limit of walks per client (for example 200).
- **S3 [P2/S] the shared `demo` client can be changed by anyone** - a request without
  `X-Client-Id` uses the `demo` client (`walks/scoping.py:32-33`). On a public deploy, Swagger
  "Try it out" can rename, delete or add walks for every visitor who looks at the demo data.
  `seed_demo` matches items by name (`walks/demo_data.py:96-105`). Checked: a PATCH without a
  header renamed a demo walk (200); after `seed_demo` the renamed walk stayed and a new copy was
  added next to it (2 demo walks became 3). Fix: make `demo` read-only (only safe methods; writes without a
  header give 400 with a clear message).
- **S4 [P2/S] fixed paths for the database and the cache** - `db.sqlite3` and `.cache/` live in
  `BASE_DIR` (`settings.py:80`, `:131`). In a container these must be on a volume, not next to the
  code. Fix: `SQLITE_PATH` and `CACHE_DIR` variables with the current values as defaults. Do this in
  stage 8.
- **S5 [P3/S] no `LOGGING` setting** - Django configures only its own `django` loggers. For our
  loggers (`planning.*`) Python prints only WARNING and higher, with no time and no logger name.
  Checked: `info()` printed nothing, `warning()` printed the bare message. In `docker logs`, "Overpass unavailable" or an invalid LLM answer has no
  context. Fix: a small `LOGGING` dict (console, level from `LOG_LEVEL`, a format with the time and
  the logger).
- **S6 [P3/S] `settings.py:124`, `:149`** - `int(os.getenv(...))` fails with a bare `ValueError`
  when the variable is present but empty (`LLM_DAILY_LIMIT=`). Fix: an `env_int` helper next to
  `env_list` with a clear message.
- **S7 [P3/S] `/admin/` is on** - nobody uses it (there is no superuser and no admin task in the
  plan), but on a public deploy it is a login page open to guessing. Fix: turn it on only with
  `DEBUG=1` or an `ADMIN_ENABLED` variable. It also removes one reason for `collectstatic`.
- **W1 [P2/S] `walks/serializers.py:83-96`** - `/api/stops/` does not check what the nested
  create checks (`:200-206`): there is no limit of stops per walk, and two stops can have the same
  `order`. Checked: 25 stops with `order: 1` on one walk all gave 201; the nested create with the
  same order twice gives 400. Fix: the same two checks in `StopSerializer.validate`.
- **W2 [P3/S] no pagination** - the list endpoints return all rows. Fine with the limit from S2;
  without it, a client with thousands of walks gets one large answer.
- **W3 [P3/S] `walks/serializers.py:42`** - a profile needs 1-6 child ages. Feature idea 5 ("a
  child is not required") needs 0-6 here; the planner rules must then handle an empty list (check
  in part 3b).
- **W4 [P3/M] `walks/models.py:192-194`** - the pace has two values (`relaxed`, `normal`). Feature
  idea 3 (a pace slider) needs a model change and a migration, and the speeds in
  `planning/services.py` must follow.

### What is good

- Scoping by client is careful. A foreign object gives 404, not 403. A foreign profile or walk in
  a payload gives "not found", with no hint that it exists. UUIDs are normalized, and a bad
  header gives 400 before any lookup.
- All validation is in the serializers, with clear limits (geometry 2-5,000 points, 20 nested
  stops, text lengths, ranges for coordinates, `bool` is not accepted as a number).
- No N+1 queries: the list uses a light serializer with `Count("stops")`, the detail uses
  `prefetch_related`. A walk and its stops are created in one transaction with `bulk_create`.
- `SECRET_KEY` is required when `DEBUG` is off. CORS is an explicit list with explicit headers.
  `NUM_PROXIES` is documented, and forged `X-Forwarded-For` is ignored (#20).
- `/api/health/` exists, and `seed_demo` is idempotent and works offline.
- 66 tests in `walks/` and 5 in `tests/` (CORS, health).

## Part 3b: Backend planning and LLM

Run on 2026-11-14 on `dev` at `9656488`. `pois.py` and the place flow in `services.py` were
covered in part 2.

Files read: `planning/llm/` (all 7 modules), `trip_planner.py`, `trip_rules.py` (outline and
defaults), `opening_hours.py`, `routing.py` (fetch and comparison), `weather.py`, `views.py`,
`serializers.py`, and the test names in `planning/tests/` (174 tests). `anthropic_api.py` was
checked against the `claude-api` skill and against the installed SDK (`anthropic==2.8.0`).

### Findings

- **L1 [P2/S] `trip_planner.py:107-111`** - the LLM time budget (`LLM_CHAIN_BUDGET_S = 60`) is
  checked only *before* each backend. A call that has started is not limited. Worst case from
  the timeouts in the code: Anthropic 30 s x 2 tries (`max_retries=1`) = 60 s, `claude_cli`
  60 s, NVIDIA 60 s. With two backends, the LLM part alone can take about 120 s. A trip also
  waits for Overpass (12 s, not for the demo start), weather (5 s) and up to 3 route attempts with
  2 ORS calls of 10 s each (60 s). Stage 8 plans gunicorn with a 120 s timeout, so in the worst
  case the worker is killed and the user gets a 502 instead of the rules answer. This needs every
  service to be slow at once, so it is rare. Fix: give each backend the time that is left as its
  timeout, and one deadline for the whole request. There is no test for `LLM_CHAIN_BUDGET_S`
  yet; add one.
- **L2 [P2/S] `llm/anthropic_api.py:34-42`** - no `effort` is set. On `claude-opus-5-5` thinking
  is always on, the default effort is `medium`, and thinking counts toward
  `max_tokens = 4000`. If thinking uses most of it, the answer stops with `max_tokens`: we pay
  for the call and then use the rules anyway. The `claude-api` skill says to set effort
  explicitly on this model and not to set `max_tokens` too low. Fix: set
  `output_config.effort` (picking 1-4 stops from a list is a simple task; try `low` and compare
  with `medium` on a few demo requests), raise `max_tokens` (for example 8,000), and log
  `usage.output_tokens`. Not measured here, because every call costs money.
- **L3 [P3/S] `llm/validation.py:21-33`** - one text that is a little too long (a `reason` of 161
  characters, a `summary` of 301) rejects the whole answer, and the trip falls back to the rules.
  The call is still paid. Fix: cut too-long texts in code (at a word), and reject only real
  errors (unknown, repeated or closed place, minutes out of range, wrong types).
- **L4 [P3/S] `trip_planner.py:81-83`, `:259-261`** - when code drops stops to fit the time
  limit, the LLM `summary` stays as it was. It can name a dropped stop, while a tip says the same
  stop was skipped. Fix: add the dropped stops to `unmet_wishes`, or show a short note in the UI
  that the summary is the plan before trimming.
- **L5 [P3/S] `tests/test_llm_backends.py:223`** - the Anthropic test checks `max_tokens` and
  the JSON format, but not `betas` and `fallbacks="default"`. A refactor could drop the refusal
  fallback without a failing test.
- **P1 [P3/S] `opening_hours.py`** - checked on the recorded OSM data: 6 of 51 unique values (12 %)
  are not supported and become "unknown". Four of them could be supported with small changes:
  `PH` inside a day list (`Mo-Sa 07:00-15:00; Su,PH off`) and a comma between rules
  (`Mo-Sa 10:00-24:00, Su 11:00-23:00`). The other two use months (`May-Sep ...`). "Unknown" is
  handled honestly (the place may be chosen and shows no "open" label), so the impact is small.
  Option: a maintained parser library instead of our own (new dependency, ask first).
- **W3 follow-up** - `trip_rules.default_wants([])` already works with no children (it picks a
  cafe), so feature idea 5 needs only the serializer change from W3.

### Checked and correct

- `anthropic_api.py` matches the current API: model `claude-opus-5-5`, JSON through
  `output_config.format` (`json_schema`), the `server-side-fallback-2026-07-01` beta with
  `fallbacks="default"` (the scalar form needs exactly this beta), and every `stop_reason` other
  than `end_turn` (including `refusal` and `max_tokens`) becomes `LLMError`. SDK 2.8.0 accepts
  `betas`, `fallbacks` and `output_config` on `beta.messages.create`, and knows the beta name.
- Privacy: the payload is a white list of fields with no coordinates, weather is only
  temperature, rain chance and wind, and the logs never hold the prompt or the wishes. Tests check
  both (`test_the_llm_payload_has_no_coordinates`, `test_logs_never_hold_the_wishes_or_the_prompt`).

### What is good

- The split from `AGENTS.md` is real: code does routes, distances, times, opening hours and
  filtering. The LLM only picks and orders places from candidates the backend found, and its
  answer is validated (unknown, repeated or closed places are rejected).
- Every failure has a way out: the next backend, then the rule-based planner, which returns the
  same shape. A crash in one backend is caught (`trip_planner.py:128`) and costs nothing more than
  the fallback.
- Costs are guarded twice: `LLM_DAILY_LIMIT` counts every attempt, and `trip-ideas` has a per-IP
  limit.
- `claude_cli` is careful: an argument list without a shell, batch files refused, `--safe-mode`,
  an empty temporary working directory, the prompt through stdin.
- The system prompt treats wishes and place names as data (a prompt-injection rule), and the
  client cannot send its own candidate list (`serializers.py:116-117`).
- Upstream failures never give 500. Domain errors are 422 with a stable `code`.

## Part 4a: Frontend architecture, data, types, tests and bundle

Run on 2026-11-14 on `dev` at `9656488`.

Files read: `package.json`, `vite.config.ts`, `tsconfig.app.json`, `main.tsx`, `App.tsx`,
`src/api/` (all modules), `lib/mapIcons.tsx`, the map helpers in `MapView.tsx` and `WalkMap.tsx`,
and the list of test files (130 tests in 33 files).

Checks run: `npm run build`; a second build with `react-dom/server` replaced by an empty stub
(config in a temporary folder, the repo was not changed); a TypeScript probe file compiled with
the default options; a search for files with no test.

### Findings

- **F1 [P2/S] `src/lib/mapIcons.tsx:4`, `:22`, `:48`** - `react-dom/server`
  (`renderToStaticMarkup`) is used only to turn the map marker icons into SVG text, but it brings
  the whole server renderer into the browser bundle. Measured: without it the main chunk goes from
  1,011 kB to 809 kB (311 kB to 250 kB gzip), so it is **20 % of the bundle**. Fix: build the SVG
  text without `react-dom/server` (for example from the icon's SVG node data, or render once into a
  detached element with `createRoot` and `flushSync` and read `innerHTML`).
- **F2 [P2/M] B3 follow-up: no code splitting** - there is no `React.lazy` or `import()`; every
  page is in one chunk. The planner (the home page) needs Leaflet anyway, so the biggest win is
  F1. After F1: lazy-load `WalksPage`, `WalkDetailPage`, `ProfilesPage` and `NotFoundPage`, and
  consider a separate vendor chunk so the browser keeps it between deploys. Measure after each
  step.
- **F3 [P2/S] no error boundary** - there is no `ErrorBoundary` and no router `errorElement`, so
  an exception while rendering gives a blank page. API answers are cast to their types without a
  check (`src/api/client.ts:70`, `body as T`), so an unexpected shape after a backend change can
  do exactly that. Fix: one error boundary around the routes in `AppLayout` with a short message
  and a reload button. Feature idea 18 (types from OpenAPI) lowers the risk of drift.
- **F4 [P2/M] `src/components/walks/StopEditor.tsx`** - the largest untested component (361
  lines: add, edit and delete stops, with form validation). No test renders it, not even the
  `WalkDetailPage` tests. Other components without their own test file (`SaveWalkDialog`,
  `RouteForm`, `PlacesSection`, `TripSummary`, `WalkCard`) are covered through the page tests.
- **F5 [P3/S] `src/api/client.ts:29-31`** - when `localStorage` throws (blocked site data),
  `getClientId` makes a new UUID on *every* call. Each request is then a new client, so a walk
  saved a moment ago is not in the list. Fix: keep the id in a module variable as the fallback.
  The test covers only the normal path.
- **F6 [P3/S] `src/api/planning.ts:14`** - the comment says "the backend ends the LLM call after
  60 s". This is not guaranteed (see L1). Fix it together with L1, or add a client timeout
  (`AbortSignal.timeout`, about 90 s) with a clear message.
- **F7 [P3/S] map helpers** - `FitBounds` is written twice (`MapView.tsx:129`, `WalkMap.tsx:71`),
  with the same `eslint-disable` and the same key logic. Move it (and the click handler) to one
  shared file.
- **F8 [P3/S] `tsconfig.app.json`** - there is no `"strict": true`. Checked: TypeScript 6 turns
  strict mode on by default (the probe gave `noImplicitAny` and `strictNullChecks` errors), so the
  code is strict today. Writing it explicitly helps readers and keeps it on if a default changes.
- **B1 follow-up** - `shadcn` is still needed at build time (`src/index.css:3` imports
  `shadcn/tailwind.css`), so moving it to `devDependencies` is right; the frontend build stage in
  stage 8 must install dev dependencies.

Checked and not a problem: the `cn` package is the official one from the `shadcn-ui` repository
(a replacement for `clsx` + `tailwind-merge`).

### What is good

- API calls go only through `src/api/`, with one `ApiError` type and the `X-Client-Id` header set
  in one place.
- TanStack Query is used with care: query key factories, invalidation by prefix, `setQueryData`
  after create, and retry rules that fit each call (a 404 walk is not retried, route plans are
  not retried, trip ideas are mutations, and a map click never sends a request).
- Strict TypeScript with very few casts (mostly Radix `Select` strings into a union type) and only
  two `eslint-disable` lines, both with a reason.
- 130 tests. Page tests use a fake map (`src/test/FakeMapView.tsx`) instead of Leaflet, which keeps
  them fast and stable.

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

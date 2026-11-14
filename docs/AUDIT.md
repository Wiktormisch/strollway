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
| 2 | Overpass and place data: diagnosis and alternatives | To do |
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

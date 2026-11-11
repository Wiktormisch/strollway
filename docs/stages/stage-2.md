# Stage 2: Data model and CRUD API

**Status:** done (2026-11-11). **PR:** #5 `feat(api): add CRUD for walks, stops and family profiles`, squash-merged into `dev`.
**Spec:** `docs/PLAN.md`, section E, "Stage 2".

## Goal

A full, tested CRUD for `FamilyProfile`, `Walk` and `Stop`, with data isolated by the
`X-Client-Id` header, and demo data. No routing yet.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Showed a plan: files, serializer design, test list, two open decisions. |
| Options | developer + agent | The developer asked for alternatives to the two decisions (stops on update, bad filter values). The agent listed options with trade-offs; the developer kept the proposed ones. |
| Plan review | agent | On request, the agent reviewed its own plan as a strict reviewer and found 3 real gaps and 4 smaller ones (see below). The developer approved adding all of them. |
| Build | agent | Models, scoping, serializers, views, demo data, `seed_demo`, 100 tests. All passed on the first run. |
| Self-check | agent | A second check on request found one more bug (stops validated on update although they are ignored) and fixed it with a test. |
| Scope change | developer | Asked whether parks, paid play areas and similar places should be categories. The app is for short walks and full-day trips, so `park`, `zoo`, `museum` and `beach` were added; `indoor_play` waits for a data check in stage 3. |
| Review | developer | Read the diff, checked the API by hand in Swagger. |
| GitHub | agent + developer | On request, the agent pushed the branch and opened PR #5. The developer waited for green CI and squash-merged. |

## What was built (`backend/walks/`)

- `models.py`: `FamilyProfile`, `Walk`, `Stop` as in D.3. Stop categories: playground, toilets,
  cafe, restaurant, bench, water, park, zoo, museum, beach, other. One migration.
- `scoping.py`: reads `X-Client-Id` in `initial()`, before any action. Missing -> shared `demo`
  client; not a UUID -> 400 (also before a possible 404). UUIDs are stored in lower case.
  `ClientScopedMixin` filters querysets (stops through `walk__client_id`) and sets `client_id`
  on create. A foreign object gives 404. The header is documented in OpenAPI.
- `serializers.py`: all validation.
  - `children_ages`: 1-6 whole numbers 0-17 (`true` is rejected; in Python `bool` is an `int`).
  - Coordinates in range; `geometry` is 2-5000 `[lat, lng]` points.
  - `rating` 1-5 only when the status is `done`. On `PATCH` the saved status is used when the
    request has none. Going back to `planned` clears the rating.
  - `notes` up to 1000 characters, `ai_summary` up to 2000 (`TextField` does not limit length).
  - `planned_minutes` 1-120; a stop's `name` may be empty.
  - A walk's profile and a stop's walk must belong to the same client. A stop cannot move to
    another walk.
  - Walks can be created with up to 20 nested stops, each with a different `order`, in one
    atomic request. On update, `stops` is read-only; stops change through `/api/stops/`.
  - The list uses a light serializer (no geometry, `stops_count` from one `COUNT` query); the
    detail has geometry and stops.
- `views.py`: thin `ModelViewSet`s for `/api/profiles/`, `/api/walks/` (`?status=`),
  `/api/stops/` (`?walk=`). A bad filter value gives 400. `POST /api/demo-data/` returns 201 when
  it created data and 200 when the data was already there.
- `demo_data.py` + `manage.py seed_demo`: 1 profile and 2 walks in Gdansk from demo pairs 1 and 3
  (`docs/DECISIONS.md`): 420 m with 16 m of stairs avoided (+288 m), and 833 m with 13 m avoided
  (+6 m). The geometry is a straight line for now; stage 3 replaces it with recorded routes.
- `admin.py`: the three models are registered.

## Tests and checks

| Area | Tests |
|---|---|
| Scoping | missing header -> `demo`; bad header -> 400 on lists, detail (before 404) and demo data; upper-case UUID is the same client; isolation: GET/PUT/PATCH/DELETE of another client's profile, walk or stop -> 404; the schema has the header and the paths |
| Profiles | full CRUD; invalid ages (empty, 7 items, -1, 18, 2.5, "3", true, not a list); 6 children allowed; deleting a profile keeps its walks |
| Walks | full CRUD; light list with `stops_count`; detail with geometry and ordered stops; nested stops (atomic, unique order, max 20); stops ignored on update; coordinate and geometry ranges; all rating rules; notes and AI summary limits; own and foreign profile; `?status=` filter and a bad value; delete removes stops |
| Stops | full CRUD; empty name; `planned_minutes` limits; coordinates; new categories and an unknown one; foreign walk; no move to another walk; `?walk=` filter, a foreign walk id, a bad value |
| Demo data | `seed_demo` twice creates 1 profile, 2 walks, 3 stops; real numbers from pairs 1 and 3; endpoint 201 then 200; data only for the calling client |

`pytest`: 105 passed. `ruff check`, `ruff format --check`, `pre-commit` and CI: all green.
Swagger at `/api/docs/` was checked by hand.

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, section 6.

- **Plan review before code found real gaps:** the client id was read in `get_queryset()`, so
  a bad header could give 404 instead of 400 and `POST /api/demo-data/` skipped the check; a
  `PATCH` with only `rating` ignored the saved status; a stop could be moved to another walk;
  there were no size limits on `geometry`, `ai_summary` and nested stops.
- **No `django-filter`.** Two simple filters are a few lines in `get_queryset()`.
- **Known limits, accepted:** anyone without the header can change the shared `demo` data
  (`seed_demo` restores it); demo data is matched by fixed names, so two requests at the same
  moment, or a renamed demo walk, can create it again; distances and stairs come from the client
  and are not recalculated until stage 3.
- **A long shell heredoc failed** and wrote no files. The agent wrote the test files with the
  file tool instead.
- **Two migrations were merged into one** before the first commit, because neither was merged yet.
  A local `db.sqlite3` that already had the second one must be recreated.

## Open points

- Stage 3: Overpass must find the new categories and use a larger radius for full-day trips;
  check how many `leisure=indoor_play` places exist in Gdansk (note in `docs/PLAN.md`).
- Stage 6: check the time limit and stop count for full-day trips (note in `docs/PLAN.md`).
- Later, with the frontend: pagination of the walk list (it has no limit now).
- PR `dev` -> `main` (merge commit, no squash).

## Next stage

Stage 3: routes, stairs and places (`docs/PLAN.md`, section E, "Stage 3").

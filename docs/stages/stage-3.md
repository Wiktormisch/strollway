# Stage 3: Routes, stairs and places

**Status:** done (2026-11-11), on branch `feat/route-planning-api`, PR to `dev` not opened yet.
**Spec:** `docs/PLAN.md`, section E, "Stage 3".

## Goal

`POST /api/route-plans/` compares the shortest walking route with a step-free one, lists places
along the route and transit stops near its ends, and handles the four cases from D.4. It saves
nothing, and it works without any API key.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Showed modules, a decision table for errors and fallbacks, and a test list. Asked one combined question (httpx, the path to the stage 0 file, the `indoor_play` check). |
| Plan review | agent | On request, reviewed its own plan and found 9 gaps: a failed avoid-steps request threw away a good route, no merge of a playground mapped twice, one cache entry per plan instead of per request, unclear geometry for places, simplification could cut corners, fixtures in a different shape than live data, rounding of `extra_min`, test isolation, small settings items. All were fixed in the plan. |
| Test data | agent | Cut trimmed samples from the stage 0 file. Found that its third route was the rejected Brzezno pair, not Kartuska, and kept it as the "no stairs" sample. |
| Data check | agent | One Overpass query for `indoor_play`: 406 without a `User-Agent`, then 502 "at capacity". No retry loop; the check moved to stage 6. Both answers changed the client. |
| Build | agent | `geo`, `routing`, `pois`, `fixtures`, `services`, serializers, view, `record_fixtures`, demo data. Two test failures on the first run; one showed that the `User-Agent` was set where tests could not see it. |
| Recording | developer | Ran `record_fixtures` with a real key. ORS worked for all pairs; Overpass answered 502, so no fixture has places yet. One demo data test failed because a real route does not start on the exact point. |
| Real API check | developer | Checked pair 1 and pair 2 in Swagger with a real key: both as expected (pair 2: 200, `step_free_available: false`). |
| Self-check | agent | On request, reviewed the diff again: tests depended on files that `record_fixtures` rewrites, `record_fixtures` wrote CRLF on Windows, 7 files had CRLF, DECISIONS.md was out of date. All fixed, one with a regression test. |

## What was built (`backend/planning/`)

- `geo.py`: haversine, encoded polyline decoder, cumulative distance, nearest vertex,
  simplification to about 50 points (keeps chosen indexes), straight line. No geo libraries.
- `routing.py`: ORS client (httpx, 10 s, POST, key in `Authorization`). `[lat, lng]` is swapped
  to `[lon, lat]` only here. Stairs metres from `extras.waytype.summary` (value 8, also `8.0`),
  stair segments from `values`. The cache has one entry per request and keeps routes and errors
  2009/2010, but no temporary failures. `compare_routes` takes a `fetch` function, so live ORS
  and recorded fixtures use the same code.
- `pois.py`: one Overpass query (`[timeout:20]`, node and way, `out center tags`): places within
  150 m of the route, bus and tram stops within 400 m of start and end. Categories match
  `Stop.Category`, including park, zoo, museum and beach. Places with the same category and name
  within 30 m are merged; at most 10 benches. Any failure gives `pois_status: "unavailable"` at
  once: no sleep, no retry.
- `fixtures.py` + `planning/fixtures/pair_{1,2,3}.json`: raw, trimmed ORS answers (and Overpass
  elements when available) for the three demo pairs, matched within 100 m.
- `services.py`: the fallback order and the response in the shape of D.4. Pace: relaxed 3.5,
  normal 4.5, stroller at most 4 km/h.
- `serializers.py`, `views.py`: input validation (ranges, at most 20 km, own profile only), a
  thin `APIView`, throttle scope `route_plans` (60/hour per IP), OpenAPI with examples.
- `management/commands/record_fixtures.py`: records the demo pairs with the real APIs.
- `walks/demo_data.py`: demo walks use the recorded routes, offline.

## Error and fallback table

| Situation | Answer |
|---|---|
| Avoid-steps: 404 + code 2009 | 200, `step_free_available: false`, `route` = `baseline` |
| Normal request: code 2009 | 422 `no_route` |
| Code 2010 | 422 `no_routable_point` |
| No key, timeout, 429, 5xx on the normal request | fixture for a demo pair, otherwise a straight line (`mock`) |
| Avoid-steps fails after a good normal route | 200 with the normal route, `step_free_available: null` |
| Shortest route has 0 m of stairs | one request only, `step_free_available: true`, `detour_m: 0` |
| Overpass 429, 502, 504, timeout, `runtime error` | 200, `pois_status: "unavailable"`, empty lists |

## Tests and checks

| Area | Tests |
|---|---|
| geo | haversine; the decoder on Google's example and on a real ORS sample; cumulative distance; nearest vertex; simplification |
| routing | parsing; stairs metres and segments with `8.0` and `8`; 2009 on each request; 2010; other errors; `[lon, lat]` order, POST, URL, key; cache hit and no cache for failures; timeout and bad JSON; detour; one request when there are no stairs or `avoid_stairs` is false |
| pois | the query; node and way; every category; unknown tags; 0 results; order; playground merge; bench grouping and cap; transit stops; one request and cache; 429/502/504/timeout/connect error/`runtime error` give "unavailable" without sleep or retry |
| endpoint | the D.4 contract; the four cases; 422 codes; profile pace; every fallback; matching within 100 m; places never invented; 400 for bad input and a foreign profile; throttling; 405 for GET |
| record_fixtures | raw answers with 2009; Overpass failure; missing key; ORS failure writes nothing; LF line endings |

`pytest`: 198 passed (none touch the network; a root `conftest.py` blocks it). `ruff check`,
`ruff format --check` and `pre-commit`: all green. The real ORS API was checked by hand in Swagger.

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, section 7.

- **Overpass was down during the whole stage** (502 "at capacity"), so no fixture has places
  and `indoor_play` is not checked. The code handles it as designed: the route comes back at once.
- **The public Overpass server needs a `User-Agent`** (406 without one). Not in the stage 0 notes.
- **The stage 0 file had a different third pair** than the notes said.
- **Tests first read the real fixtures**, so a new recording could break them. They now use fixed
  copies in `planning/tests/data/fixtures/`.
- **Line endings:** files written by a Python script on Windows had CRLF; `record_fixtures` did
  the same. Fixed with `newline="\n"` and a test.
- **Known limits, accepted:** a mock (straight) route still asks Overpass for real places near the
  line; `off_route_m` of a large park is measured from its centre; throttling counts per IP and
  needs `NUM_PROXIES` behind a proxy (stage 8).

## Open points

- Run `record_fixtures` again when Overpass answers, to add places to the fixtures.
- Stage 6: opening hours parser (`open_now`), the `indoor_play` check, a larger radius for trips.
- Stage 8: `NUM_PROXIES` for throttling behind a reverse proxy.

## Next stage

Stage 4: frontend, the planner with a map (`docs/PLAN.md`, section E, "Stage 4").

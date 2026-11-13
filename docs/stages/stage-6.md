# Stage 6: Trip ideas, backend (LLM and rules)

**Status:** done (2026-11-12). Merged to `dev` in PR #14 and released to `main` in PR #15.
**Spec:** `docs/PLAN.md`, section D.6 and section E, "Stage 6".

> This log was written after the stage, from the PR description, the commits and
> `docs/DECISIONS.md` (section 10). It lists facts from the repository, not a step-by-step story
> of the session.

## Goal

`POST /api/trip-ideas/` plans a short family trip from a start point, a time limit and wishes in
plain words. The LLM only picks and orders places that the backend found. Code does everything
else and checks the answer. Without keys the app still works with a rule-based planner.

## What was built (`backend/planning/`)

- `trip_planner.py`: the flow from D.6.
  1. Places around the start from Overpass (radius from the time limit, max 1500 m, at most 40
     candidates, taken round-robin per category), each with `distance_m`, `east_m`, `north_m`
     and `open_now`.
  2. The planner: the LLM chain, then the rules.
  3. The route in ORS with waypoints (step-free plus the shortest route, same stairs logic and
     cache as route plans).
  4. The time limit: up to 10% over is fine; otherwise the last stop is dropped and the trip is
     routed again, at most twice, then `over_limit` is set.
- `trip_rules.py`: the rule-based planner (PL and EN keywords, a default list by children's ages,
  templates for the texts, unmet wishes).
- `llm/`: one small interface and the backends.
  - `claude_cli` (local): `claude -p` in an empty temporary directory with `--safe-mode`.
  - `anthropic` (production): the official SDK, `claude-opus-5-5`, structured outputs.
  - `nvidia` (spare): an OpenAI-compatible endpoint over `httpx`.
  - `mock` (default): no LLM.
  - `prompt.py` (system prompt, white-listed payload) and `validation.py` (a DRF serializer).
- `weather.py`: Open-Meteo, coordinates rounded to about 1 km, 1 h cache, `null` on failure.
- `opening_hours.py`: a small parser for common patterns; `open_now` is now in route plans too.
- `pois.py`: search around a point and new categories (park, zoo, museum, beach, shop).
- `record_fixtures --trip`: a recorded demo trip (`fixtures/trip_demo.json`), so the demo start
  works with no network and no keys.
- `walks`: `shop` added to `Stop.Category` (migration `0002`) and to the frontend lists.
- `GET /api/health/` reports the active `routing` and `llm` engines.
- New package: `anthropic==2.8.0`.

## Privacy and safety

- The LLM gets no coordinates and no addresses. The payload is white-listed, and a test checks
  that it has no `lat` / `lng` keys.
- The only free text from the user is `wishes` (max 200 characters).
- The backend collects the candidates; a client cannot send its own list.
- Logs never contain the prompt, the wishes or the model answer.
- A daily LLM call limit (`LLM_DAILY_LIMIT`, default 300) and 20 requests per hour per IP.

## Tests and checks

| Area | Tests |
|---|---|
| `trip_planner` | a valid LLM answer; bad JSON, unknown or repeated `poi_id`, a closed place and a timeout end in rules with the right `engine`; the time limit drops the last stop; 0 candidates skip the LLM; the daily limit; no coordinates sent |
| `trip_rules` | PL and EN keywords, order from the text, empty wishes, the time limit, unmet wishes |
| LLM backends | backend choice and fallback order; `claude_cli` runs without a shell and outside the repo; `anthropic` with a fake SDK |
| Places, weather, opening hours | search around a point, categories, failures; weather parsing and failures; common patterns and unknown ones |
| API | mock mode; request validation; a client candidate list is ignored; own and foreign profiles; 422 `no_places_nearby` and `places_unavailable`; its own throttle scope at 20/hour |

Backend: `pytest` 352 passed, `ruff check` and `ruff format --check` clean, no missing migrations.
Frontend: ESLint, Vitest (80 passed), build and Prettier on the changed files pass.

Tried by hand: `LLM_BACKEND=mock` (engine `rules`, offline demo) and `LLM_BACKEND=claude_cli` with
live ORS (engine `claude_cli`, a step-free route, 34 m of stairs avoided for +15 m).

## Problems and decisions

Details are in `docs/DECISIONS.md`, section 10.

- **Overpass was overloaded** during the stage. The demo places were exported from Overpass Turbo
  and recorded; live Overpass is a bonus, not a requirement.
- **`claude -p` read the global `CLAUDE.md`** without `--safe-mode` and printed a triage block
  instead of JSON. With `--safe-mode`, `--system-prompt` and `--json-schema` the answer is in
  `structured_output`.
- **NVIDIA lists models the account cannot use** (404). Two working free models were found and
  recorded.
- **Known limit:** the `anthropic` backend was tested with a fake SDK only, not against the real
  API.

## Next stage

Stage 7: trip ideas in the UI and a UX polish pass (`docs/PLAN.md`, section E, "Stage 7").

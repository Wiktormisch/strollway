# AGENTS.md - StrollWay

Rules for every AI coding agent in this repository. Humans follow them too.

## Project
StrollWay plans stair-free walks for families with a stroller and suggests short family trips.
- `backend/`: Django + Django REST Framework, SQLite. Apps: `walks` (CRUD), `planning` (routing,
  places, trip ideas, LLM backends).
- `frontend/`: React + Vite + TypeScript, Tailwind, shadcn/ui, Leaflet, TanStack Query.
- `docs/PLAN.md`: the project plan. `docs/DECISIONS.md`: decision log.

## The six rules (non-negotiable)
1. **A human reads every diff.** Never commit on your own. Finish, show the diff, wait.
2. **No production credentials for agents.** Never read, print or create `.env` files with real
   values. Use `.env.example`. If you need to know whether a key is set, ask.
3. **Plan before code.** For anything bigger than a small edit, show a short plan and wait for OK.
4. **No shortcuts to main.** Work on `feat/*`, `fix/*`, `chore/*`, `docs/*` branches from `dev`.
   Never commit or push to `dev` or `main`. Never push, open, merge or approve a PR unless asked.
5. **No personal data in prompts.** The app sends no coordinates, addresses or user notes to the LLM.
   The only free text sent is the short "wishes" field, and the UI warns the user about it.
   Tests and seed data use fake data only.
6. **A person approves what ships.** Merges and deployments are done by the human.

## Start of every task
Print: size (small / medium / large), which tests you will run, and the branch name.
Check `git status` first; if the tree is dirty or on the wrong branch, stop and ask.

## Code conventions
- Everything in the repo is in English: code, comments, docs, commit messages. Simple, clear English.
- Backend layers: views (HTTP only) -> serializers (validation) -> `planning/*` modules (logic) ->
  API clients. No business logic in views. No network calls in tests.
- Deterministic work (distances, times, routes, opening hours, filtering, validation) is code. The
  LLM only picks and orders stops from candidates collected by the backend and writes short texts.
  Every LLM answer is validated; invalid answers fall back to the rule-based planner.
- External data is poor and services fail: never invent places, never return 500 for an upstream
  failure, never sleep inside a request. Verified API facts are in `docs/DECISIONS.md`.
- Frontend: server state only in TanStack Query; API calls only through `src/api/`; no hard-coded
  user-facing strings (use `src/i18n/pl.json` and `en.json`, keep both in sync).
- Prefer simple and readable over clever. Small functions, clear names, no early abstractions.
- New dependencies: ask first, in one list, with a one-line reason each. Pin versions.

## Commands (Windows PowerShell; on Linux/macOS activate with `source .venv/bin/activate`)
Backend, from `backend/`:
- `.venv\Scripts\Activate.ps1`
- `python manage.py runserver`
- `pytest`
- `ruff check .` and `ruff format --check .`
Frontend, from `frontend/`:
- `npm run dev`
- `npm run test`
- `npm run lint`
- `npm run build`

## Tests
- Every behavior change comes with a test in the same commit. A bug fix includes a regression test.
- Before handing work over: run the tests and linters for the code you touched and report the
  results exactly. Never propose a commit with failing tests.

## Commits
Conventional Commits, imperative, max ~72 characters: `feat(routing): add stair counting`.
Types: feat, fix, refactor, test, docs, style, chore, ci, build.

## End of every task
Report: status, files changed, checks run and their results, an honest self-review (score 1-10 with
named gaps), proposed commit message(s), and the next step for the human.

## Never without an explicit request
Delete files or data, push, send anything outside this machine, install anything globally,
use `--no-verify`, force-push, or rewrite history.

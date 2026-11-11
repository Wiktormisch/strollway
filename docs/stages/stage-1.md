# Stage 1: Repository, rules and scaffold

**Status:** done (2026-11-10). **PR:** #1 `chore: scaffold backend, frontend, CI and pre-commit`, squash-merged into `dev`.
**Spec:** `docs/PLAN.md`, section E, "Stage 1".

## Goal

A public repository with the plan as the first commit, protected `main` and `dev`, a working
backend and frontend scaffold, and green CI. No features yet.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| A. Plan-first commit | agent + developer | The agent wrote `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.gitignore` and a README stub. The developer reviewed them, ran `git init`, made the first commit on `main` and created `dev`. |
| B. Plan | agent | Showed a short plan and one combined list of packages. The developer approved both. |
| B. Backend | agent | Django project, two empty apps, health endpoint, CORS, OpenAPI docs, tests. |
| B. Frontend | agent | Vite + React app shell, i18n, API client, placeholder pages, tests. |
| B. Tooling | agent | CI workflow, pre-commit hooks, PR template, README quick start. |
| Review | developer | Read the diff, ran the app by hand (navigation, language switch, backend status). |
| GitHub | developer | Pushed the branch, opened the PR, waited for green CI, set up the ruleset, merged. |
| Check | developer | A direct push to `dev` was rejected (`GH013: Repository rule violations`). |

## What was built

### Backend (`backend/`)

- Django 6.1 project `config` with empty apps `walks` and `planning`.
- Settings from `backend/.env` (`DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`).
  The app refuses to start without `SECRET_KEY` when `DEBUG` is off.
- CORS with an explicit origin list (never "allow all"). The `X-Client-Id` header is allowed.
- `GET /api/health/` returns `{"status": "ok"}`.
- OpenAPI schema at `/api/schema/` and Swagger UI at `/api/docs/` (drf-spectacular).
- `.env.example`, `requirements.txt`, `requirements-dev.txt`, `pyproject.toml` (ruff + pytest).

### Frontend (`frontend/`)

- Vite, React 19, TypeScript 6.0, Tailwind CSS 4, shadcn/ui (preset "Nova").
- `AppLayout`: app name, navigation, language switch.
- Routes `/`, `/walks`, `/walks/:id`, `/profiles` (placeholder pages) and a 404 page.
- i18n with `react-i18next`: `src/i18n/pl.json` and `en.json`. The language comes from the saved
  choice, then the browser, then Polish. The choice survives a reload.
- `src/api/client.ts`: base URL from `VITE_API_URL`, an `X-Client-Id` header with a UUID kept in
  `localStorage`, and one `ApiError` type (`status` is 0 when the server cannot be reached).
- TanStack Query provider. The home page shows the backend status through the client.

### Repository

- `.github/workflows/ci.yml`: jobs `backend` (ruff check, ruff format check, pytest) and
  `frontend` (eslint, prettier check, tsc, vitest, vite build). Python 3.14.2 and Node 24.12.0
  are pinned, the same as locally.
- `.pre-commit-config.yaml`: ruff, prettier, line endings, private key detection, large file
  guard, YAML and JSON checks.
- `.github/pull_request_template.md` and `.gitattributes` (LF line endings everywhere).
- GitHub ruleset `protect-main-dev` on `main` and `dev`: PR required (0 approvals), status checks
  `backend` and `frontend` from GitHub Actions, no deletions, no force pushes, empty bypass list.

## Tests and checks

| Area | Tests |
|---|---|
| Backend (5) | health returns 200 and the right shape; the schema is served; the CORS header is present for the allowed origin and absent for another origin; the preflight allows `x-client-id` |
| Frontend (14) | `App`: backend status ok and down, navigation, the walk detail route, the 404 page; `client.ts`: client id is created once, the header is sent, HTTP errors and network errors map to `ApiError`; `LanguageSwitch`: changes the text and saves the choice, reads the saved choice, ignores unknown values; `pl.json` and `en.json` have the same keys |

All checks passed locally and in CI: `ruff check`, `ruff format --check`, `pytest`,
`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build`,
`pre-commit run --all-files`. The running server was also checked by hand: `/api/health/` sends
`Access-Control-Allow-Origin: http://localhost:5173` and `/api/docs/` returns 200.

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, section 1.

- **TypeScript 6.0, not 7.** The newest Vite template uses TypeScript 7, but `typescript-eslint`
  8.x supports only TypeScript below 6.1.
- **ESLint, not oxlint.** The Vite template now ships oxlint. The plan asks for ESLint with
  `typescript-eslint`, so the template was changed.
- **TypeScript 6 deprecates `baseUrl`.** The `@/` import alias uses `paths` without `baseUrl`.
- **shadcn/ui added packages outside the approved list**, including one called `cn`. It was
  checked before use: it comes from the official `shadcn-ui/cn` repository and replaces
  `clsx` + `tailwind-merge`. All versions are pinned exactly.
- **No language detector package.** Detection is about 15 lines in `src/i18n/index.ts`.
- **`tsconfig*.json` files contain comments** (JSONC), so they are excluded from the pre-commit
  JSON check.
- **Line endings.** Git on Windows (`core.autocrlf=true`) would check files out with CRLF, and
  then Prettier and the line-ending hook fail locally. `.gitattributes` with `eol=lf` fixes this
  for every clone.
- **A long shell script written by the agent was cut off** and left two broken files. The agent
  noticed it when lint failed, checked every file from that script and rewrote the broken ones.
- **"No module named 'corsheaders'" on the first run.** The venv was not active, so the global
  Python was used. Fix: `.venv\Scripts\Activate.ps1` (or call `.venv\Scripts\python.exe`). The
  README explains both ways.
- **Squash merge with a Conventional Commit title.** GitHub uses the PR title as the commit
  message, so the title was changed before merging.
- **The PR template was not used on PR #1.** GitHub reads it from the default branch (`main`),
  where it arrives with the first `dev` -> `main` PR.

## Open points

- PR `dev` -> `main` (merge commit, no squash), so `main` gets the scaffold and the PR template.
- Backend tests without a `.env` file need `DEBUG=1` in the environment (CI sets it). This is on
  purpose: without `DEBUG`, a missing `SECRET_KEY` stops the app.

## Next stage

Stage 2: data model and CRUD API (`docs/PLAN.md`, section E, "Stage 2").

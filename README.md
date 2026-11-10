# StrollWay - stair-free walks for families

> Work in progress. This repository starts with the plan, and the code follows stage by stage.

StrollWay plans walks for families with a stroller or a kids' bike. It finds a route without
stairs, shows how many metres of stairs it avoided and what that costs compared with the shortest
route, and shows useful places on the way (cafes, toilets, benches, playgrounds). It can also
suggest a short family trip from a start point, a time limit and a few wishes.

## Status

- [x] Plan and agent rules (`docs/PLAN.md`, `AGENTS.md`, `CLAUDE.md`)
- [x] Backend and frontend scaffold
- [ ] Features (see `docs/PLAN.md`, section E)

## Quick start

You need Python 3.14 and Node.js 24. No API keys are needed.

### Backend

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver          # http://localhost:8000/api/docs/
```

Linux / macOS:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

If PowerShell blocks `Activate.ps1`, allow scripts for this window only:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`. Or skip activation and call
the venv directly: `.venv\Scripts\python.exe manage.py runserver`.

### Frontend (second terminal)

```powershell
cd frontend
npm install
copy .env.example .env              # Linux/macOS: cp .env.example .env
npm run dev                         # http://localhost:5173
```

The home page shows "The server works" when the frontend can reach the API.

### Checks

| Where       | Command                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `backend/`  | `pytest`, `ruff check .`, `ruff format --check .`                                |
| `frontend/` | `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build` |

Git hooks (optional): `backend\.venv\Scripts\pre-commit install` (Linux/macOS:
`backend/.venv/bin/pre-commit install`).

## How this project is built

- `docs/PLAN.md`: the project plan (in Polish).
- `docs/DECISIONS.md`: a short log of decisions and verified facts.
- `docs/AI_USAGE.md`: how I worked with AI tools.
- `AGENTS.md`: rules for AI coding agents in this repository.

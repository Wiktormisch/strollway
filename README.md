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
python manage.py import_places data/places_tricity.json.gz
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
python manage.py import_places data/places_tricity.json.gz
python manage.py runserver
```

If PowerShell blocks `Activate.ps1`, allow scripts for this window only:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`. Or skip activation and call
the venv directly: `.venv\Scripts\python.exe manage.py runserver`.

### Place data covers the Tricity only

Places (playgrounds, cafes, toilets, benches, transit stops) come from our own `Place` table.
`import_places` loads it from `backend/data/places_tricity.json.gz`, a one-time Overpass Turbo export
of OpenStreetMap data for Gdansk, Sopot and Gdynia (© OpenStreetMap contributors, ODbL). A point
outside this area gets a clear "Tricity only" message instead of places.

Why not live data? The public Overpass API is often overloaded and did not answer at all in our
checks (`docs/AUDIT.md`, part 2). A local table answers in milliseconds and works offline and in
CI. For a production version we would run our own Overpass service in Docker, or import more
regions on the server on a schedule. `POI_PROVIDER=overpass` in `.env` still uses the live API.

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

### Visual and accessibility check (optional)

With the backend and `npm run dev` running, `npm run visual-check` (from `frontend/`) opens each
page in a headless Microsoft Edge, on a phone and a desktop size, in both themes and both
languages. It saves screenshots, an [axe](https://github.com/dequelabs/axe-core) accessibility
report, the accessibility tree and the Tab order to `frontend/visual-check/` (git-ignored). It
uses the installed Edge, so no browser is downloaded (`CHANNEL=chrome` uses Chrome), and it
blocks every request to other hosts, so map tiles stay grey. Options are listed at the top of
`frontend/scripts/visual-check.mjs`.

## How this project is built

- `docs/PLAN.md`: the project plan (in Polish).
- `docs/DECISIONS.md`: a short log of decisions and verified facts.
- `docs/AI_USAGE.md`: how I worked with AI tools.
- `AGENTS.md`: rules for AI coding agents in this repository.

## Possible next steps

Ideas from manual testing that did not fit before the feature freeze (stage 7):

- **At least one stop on a saved trip:** the walk page lets you delete every stop. This is fine for
  A -> B walks, but a trip walk should keep one. It needs the walk to remember where it came from.
- **Recalculate the route after removing a stop:** today the planned route is kept (see
  `docs/DECISIONS.md`, "Trip ideas in the UI").

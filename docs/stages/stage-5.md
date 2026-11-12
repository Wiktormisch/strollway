# Stage 5: Frontend, CRUD of walks, stops and profiles

**Status:** done (2026-11-11). Merged to `dev` in PR #12 and released to `main` in PR #13.
**Spec:** `docs/PLAN.md`, section E, "Stage 5".

## Goal

Close the MUST scope: save a walk from the planner, list walks, show and edit one walk with its
stops, and manage family profiles. Lists refresh by themselves after every change.

## How the stage went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Read the spec and the backend serializers. Showed components, query keys, a test list and one package question. Found no gap in the API. |
| Plan review | agent | On request, reviewed its own plan. Found payload traps that would give a 400 (`null` stairs and detour, unknown POI categories, `name: null`). It also missed refreshing walks after a profile is deleted, a 404 state, a check that `MapView` can be reused, and `next-themes` hidden in shadcn Sonner. All went into the final plan. |
| Build | agent | Checked the model first (`order` is not unique). Wrote a separate `WalkMap`, because `MapView` is built around a route plan. shadcn asked to overwrite `button.tsx`; the agent declined and added `dialog` on its own. Lint rejected helpers in component files again, so they moved to `lib/formRules.ts`. |
| Contract check | agent | Ran the exact frontend payloads through the Django test client in a temporary pytest file, deleted after. Covered: a walk with nested stops, PATCH done + rating, stop create and PATCH, the status filter, profile delete (`profile` becomes `null`) and 400 field errors. All passed. The backend did not change. |
| Self-check 1 | agent | On request, found three bugs. Deleting a walk removed its cache while the page was still open (a 404 flash). The "Save walk" button sat in an `aria-live` region. The age limits were hard-coded in the texts. Also added the missing `StopEditor` tests. |
| Manual test | developer | Went through 11 checks. All passed. Reported a slow error state with the backend off. Asked for a "Plan route" button on the map when the phone panel is folded, and later for a "Save walk" button there too. |
| Fixes | agent | The slow error came from TanStack's default 3 retries (about 7 s); now there is 1. Added the map button (plan, then save). Added a pace hint in the save dialog, and tests through Radix Select (jsdom needed small stubs). |
| Commits undone | developer | Asked to undo the three commits (`git reset`, changes kept) and to check the work again. |
| Self-check 2 | agent | Found a bug it had made itself: the app-wide `retry: 1` also retried route plans, so a 422 or 429 was sent twice. Fixed with `retry: false` on route plans and a regression test, which fails without the fix. Loading skeletons got `role="status"`. |

## What was built (`frontend/src/`)

- `api/types.ts`: types for profiles, walks (list and detail), stops and their inputs.
- `api/walks.ts`, `api/profiles.ts`: query and mutation hooks.
  - Keys: `["walks", {status}]`, `["walk", id]`, `["profiles"]`. Mutations invalidate by prefix.
  - A new walk is put into the cache, so its page opens with no extra request.
  - Deleting a profile also refreshes the walks.
- `api/planning.ts`: route plans are never retried.
- `lib/walkPayload.ts`: builds the POST body from a plan (see `DECISIONS.md`, section 9).
- `lib/fieldErrors.ts`: DRF errors next to fields, the rest to a toast; translated request errors.
- `lib/formRules.ts`: limits copied from the serializers, plus the age and minutes checks.
- `components/common/`: `ConfirmDialog`, `EmptyState`, `LoadError`, `FieldError`.
- `components/walks/`: `WalkCard`, `WalkForm`, `SaveWalkDialog`, `ProfileSelect`, `StopEditor`,
  `WalkMap`.
- `components/profiles/ProfileForm.tsx`: age chips (add with Enter or a button, remove with x).
- Pages:
  - `/walks`: filter all / planned / done, skeleton, error with retry, empty state with "Add sample walks".
  - `/walks/:id`: map, stats, inline name edit, notes with a counter, status and a 1-5 rating,
    add / edit / delete stops, delete with confirmation, not-found state.
  - `/profiles`: list, create and edit in a dialog, delete with confirmation.
  - Planner: a profile select (plans again), "Save walk", and on phones a map button when the
    panel is folded.
- `main.tsx`: `Toaster` and `retry: 1`.
- `i18n/en.json`, `pl.json`: all new texts in both languages.
- New packages: shadcn `dialog`, `select`, `input`, `textarea`, `label`, `card`, `badge` and
  `skeleton`, plus `sonner` 2.0.8.

## Tests and checks

| Area | Tests |
|---|---|
| WalksPage | loading; empty + sample data (the list refreshes by itself); error + retry; list and the status filter |
| WalkDetailPage | walk with stops; 404; delete cancelled (no request); delete confirmed; mark as done with a rating; stop minutes validation and save; stop delete with confirmation |
| ProfileForm | age out of range; no children; required name; at most 6 children; submitted payload; backend error next to its field |
| WalkForm | required name; chosen places in the payload; pace hint after choosing another profile; backend error next to the name |
| PlannerPage | the map button plans, then saves; `profile_id` is sent after choosing a profile, and the route is planned again |
| walkPayload, fieldErrors, planning | `null` to 0, categories, stop order; DRF error shapes; no retry for route plans (regression) |

`test/mockApi.ts` mocks `fetch` by method and path and records every call. `WalkMap` is replaced by
a fake in `test/setup.ts`, like `MapView`.

Vitest: 80 passed (18 files). ESLint, Prettier, `tsc` and `vite build` are green. The backend did
not change.

## Problems and decisions

Decisions are also logged in `docs/DECISIONS.md`, section 9.

- **The planner panel covered dialogs** (`z-1000` against `z-50`). It is now `z-10`.
- **The default retries** made errors slow, and the first fix made route plans retry. Both are fixed.
- **Radix Select in jsdom** needs `hasPointerCapture`, `releasePointerCapture` and `scrollIntoView`
  stubs (`test/setup.ts`).
- **Long shell heredocs** were cut off again in Git Bash. Files were written with the editor tool
  or a script file instead.
- **Known limits, accepted:**
  - Backend validation messages are English only, also in the Polish UI.
  - The star rating works with Tab and Enter, not with arrow keys.
  - A different profile in the save dialog does not recompute the walking time; a hint says so.
  - The bundle size warning (over 500 kB) from stage 4 is still there.

## Open points

- Recompute the walking time in the save dialog (medium).
- Map DRF error codes to i18n keys (medium).
- Arrow keys for the star rating (small).
- Lazy-load the maps to cut the first bundle (small).

## Next stage

Manual test on `dev`, then the first release PR `dev` -> `main` ("release: MVP with route planning
and CRUD"). After that, stage 6: trip ideas, backend (`docs/PLAN.md`, section E, "Stage 6").

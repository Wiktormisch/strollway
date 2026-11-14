# Stage 7b: Visual redesign "Nordic Sage"

**Status:** done. Session 1 (`docs/design-system`) merged in PR #21, session 2 (`feat/ui-tokens`)
in PR #22, session 3 (`feat/ui-planner`) in PR #23. Session 4 (`feat/ui-pages`) done on 2026-11-14.
**Spec:** `docs/DESIGN.md`; `docs/PLAN.md`, section E, "Stage 7b".

## Session 2: design tokens (`feat/ui-tokens`)

### Goal

Only colours: Nordic Sage tokens for light and dark, no raw colours in components, map colours
that follow the theme. No layout changes.

### How the session went

| Step | Who | What happened |
|---|---|---|
| Plan | agent | Grep found about 30 raw colours in 13 files and 3 map style constants. Plan: tokens in `index.css`, a CSS variable helper for Leaflet, status colours from tokens. A critical review moved the markers to `var(--...)` in their HTML (no JavaScript needed) and kept JavaScript only for the lines, because Leaflet writes the colour into an SVG attribute. |
| Build | agent | Tokens in `:root` and `.dark` plus `@theme inline`; unused `sidebar-*` and `chart-*` removed; focus ring in `brand`; `lib/cssColors.ts` with `useMapColors` (a `MutationObserver` on `<html>`). |
| Manual check 1 | developer | Screenshots: the sage route was hard to see on OSM tiles, and the map stayed light in the dark theme (tiles are images). |
| Fix 1 | agent | A white casing under the route and the stairs; a CSS filter on the tile pane (softer colours in light, inverted in dark). |
| Manual check 2 | developer | "Calm, but sad." Asked for more colour. |
| Colour playground | agent | A temporary dev-only panel to change tokens live (not committed). The developer asked for a bold CTA, coloured accents, a vivid route and strong A/B markers. The agent pointed out conflicts with `DESIGN.md` (orange is for stairs; sage was the route colour). |
| Decision | developer | Forest green `brand` for actions and selected states, a turquoise `route`, A = green, B = navy, tile saturation 0.7. Category icons, shadows and radius moved to session 3. |
| Fix 2 | agent | New tokens `route` and `brand-foreground`; the default button, switch, POI chips and active navigation use `brand`; a glow line under the route. `DESIGN.md` updated. |
| Self-check | agent | Found outdated contrast notes, a wrong text token on the A badge and a wrong sentence about orange in the decision log. Fixed. |

### Tests

| Area | What is checked |
|---|---|
| `lib/cssColors` | reads a variable, falls back when it is missing, light defaults, new colours after the `dark` class changes |
| `constants/mapStyles` | the glow and the casing are wider than the route, colours come from the input |

Vitest: 104 passed (25 files). ESLint, Prettier and `vite build` are green.

Manual (developer): planner in light and dark, the map in both themes, route readability.
Not checked by the agent: the agent had no browser in this session.

### Problems and decisions

Decisions are also logged in `docs/DECISIONS.md` (map colours, route casing, more colour).

- **Map tiles are images**, so CSS variables cannot recolour them; a CSS filter on the tile pane
  does. The tiles stay OpenStreetMap.
- **Glow as a line, not a filter**: CSS filters on SVG paths are not reliable in every browser.
- **Python on Windows wrote CRLF** line endings again; converted to LF before the commits.
- **Known issue (for session 3):** on phones the top navigation is too wide since the theme button
  was added, and it scrolls sideways. The whole top bar is redesigned in session 3, so there is no
  quick fix now.

### Next session

Session 3, `feat/ui-planner`: top bar, bottom sheet, point rows, result hero card, markers,
coloured category icons, shadows and radius.

## Session 3: planner layout (`feat/ui-planner`)

### Goal

The planner as in `DESIGN.md` sections 4-8: floating top bar, bottom sheet, point rows, result
hero, pill controls, new markers and coloured category icons. Every old element keeps a place.

### How the session went

The work was split into four parts, each checked by the developer on screenshots and committed
on its own.

| Part | What happened |
|---|---|
| Plan | The agent proposed the plan and a category palette (contrast computed with a script). A review in the code found too small touch targets (32 px buttons), the Leaflet zoom under the new top bar, and a second start row in the trip form. The developer chose the "more" menu for phones only. |
| A: foundation | `--radius` 12 px, pill buttons and tabs, 44-48 px controls, `rounded-xl` inputs, `cat-*` tokens, `categoryColor()`. |
| B: top bar | Floating pill bar with no sideways scrolling (fixes the known issue from session 2); phone popover with theme and language; Leaflet controls moved under the bar. |
| C: sheet and cards | `PlannerSheet` (24 px top radius, visual handle, whole header toggles), `PointRow` with a closed "Details" line, result hero with tag and stats. Developer feedback: a clear break between the form and the result, a more inviting demo button, the weather above the trip stops, centred. |
| D: map and icons | 36 px A/B markers with a white outline, 28 px place markers with coloured icons, coloured filter chips, stairs and round-trip icons at the switches, legend chip on the map, places and transit stops as collapsible cards. |
| Self-review | The agent found the floating save button touching the folded sheet. The developer saw the legend covering point B and a nearly invisible outline on B in the dark theme. Fixes: `bottom-24`, a legend behind an "i" button on phones, the outline in `card`, and a disclosure button inside the section headings. |

### Tests

| Area | What is checked |
|---|---|
| `AppLayout` | active link, phone menu switches the theme, Escape closes it and returns the focus |
| `PointRow` | no coordinates in the label, closed details, demo name, no point, actions |
| `DetourCard` | status tag, stats row, no places stat without a count |
| `CollapsibleSection` | closed by default, heading kept, `aria-expanded` on the button, can start open |
| `PlannerPage` | demo name in both rows, sheet toggle `aria-expanded`, legend chip only with a result and its "i" button |
| `lib/planner`, `poiCategories` | `demoRouteOf`, `categoryColor` (never the stairs colour) |

Vitest: 119 passed (29 files). ESLint, Prettier and `vite build` are green.
Manual (developer): screenshots of parts A-C on a 360 px phone and desktop. Part D is checked
after this log. Not checked by the agent: it had no browser.

### Problems and decisions

Decisions are in `docs/DECISIONS.md` (category colours, touch sizes, phone menu, point rows,
result title size, legend chip, shadows).

- **PowerShell 5.1 wrote a UTF-8 BOM** into one file; removed before the commit. Edits are done
  with Python or the editor, which keep LF and no BOM.
- **A `git add` ran in the wrong folder** (paths relative to the repo root while the shell was in
  `frontend/`). Nothing was committed; the commit was repeated with the right paths.

### Ideas for later (developer, not in this redesign)

- A slider with a number field for the trip time limit, instead of five buttons.
- Centre the map on the markers after a demo route or demo start is picked.
- "Trip idea" as the first tab (changes the default mode and the first impression).
- Session 4: icons instead of text in the top bar on narrow phones (the labels are cut off, for
  example "Plan...").
- Session 4: keep the dialog close button visible while a long dialog scrolls.
- Session 4: trip idea stops in the planner use navy numbers; saved walks use the category colour.
  Use the same stop marker in both.
- Session 4: one shared class for title letter spacing (`tracking-[-0.01em]` is in three places).

### Next session

Session 4, `feat/ui-pages`: walks list, walk detail, profiles, dialogs, empty and error states.

## Session 4: other pages and shared states (`feat/ui-pages`)

### Goal

The walks list, walk detail, profiles and dialogs in the same card language as the planner, and
one look for loading, empty and error states on every page (`DESIGN.md` sections 6 and 7).

### How the session went

The agent checked its plan against the code twice before starting (the developer asked for a
critical review). That found a missing date helper, a link layout that would hide the card heading,
a possible contrast problem in the warning banner, the not-found page, the dialog close button over
long Polish titles, and the save button lost under the on-screen keyboard. The work was split into
five parts; the developer checked each one on screenshots before the commit.

| Part | What happened |
|---|---|
| A: layout and states | 960 px column, cards with `rounded-2xl` and a 1 px border, `EmptyState`, `WarningBanner` (also in the planner), `ListSkeleton`, not-found page. A script showed that a 10% tint fails AA, so the banner uses 8%. Developer feedback: the dashed outline was almost invisible; it now uses `muted-foreground/40`. The unused `Placeholder` page was removed. |
| B: walks list | Filters as a pill track (toggle buttons), walk cards with a stretched link, the saved date (`formatDate`), a stats grid and a status chip. |
| C: walk detail | Marker helpers moved to `lib/mapIcons.tsx`; A/B markers as in the planner; stops with a number and the category colour on the map and in the list; stats card like the result hero; 44 px stars and buttons; "Delete walk" moved to the end. Two lint errors (React Compiler: a component created during render; fast refresh: mixed exports) were fixed. |
| D: profiles and dialogs | Base dialog in `card` with its own scroll and a sticky footer, translated close button, overlay from tokens; form actions in the footer; an action in the empty profiles state; age chips. |
| Self-review | A full review of the session diff found no bugs; risks and ideas went to the table below and to "Ideas for later". |

### Tests

| Area | What is checked |
|---|---|
| `States` | empty state with one action, warning banner with a working retry, skeleton announces loading |
| `lib/format` | `formatDate` in English and Polish |
| `WalksPage` | saved date on the card, `aria-pressed` on the active filter |
| `lib/mapIcons` | stop number and category colour, muted colour (never stairs) for unknown places, icon cache |
| `WalkDetailPage` | stats row with its label, status chip, no coordinate-like numbers on the page |
| `ConfirmDialog` | translated close button, red confirm, Cancel only closes |
| `ProfilesPage` | the empty state action opens the form |

Vitest: 130 passed (33 files). ESLint, Prettier and `vite build` are green. The raw colour grep
finds nothing in components (only the documented fallbacks in `lib/cssColors.ts`).
Manual (developer): every part on screenshots, light and dark, phone and desktop.
Not checked by the agent: it had no browser.

### Problems and risks

- **Sticky dialog footer** depends on negative margins that match the dialog padding. jsdom does
  not compute layout, so no test covers it; it is noted in `DECISIONS.md`.
- **The shell changed folders** between commands, so a few Prettier and grep runs looked at the
  wrong path. They were repeated with full paths before any result was reported.
- **English dates** follow `Intl` ("Jan 1, 2026"); the first test expected "1 Jan 2026" and was
  fixed, not the code.

## Stage summary

Stage 7b is done in four sessions and four PRs: the design system and Figma reference, colour
tokens for light and dark, the planner layout, and the other pages. The app now has one visual
language: tokens only (no raw colours in components), pill controls with 44-48 px targets, cards
with a 1 px border, one warning, empty and loading style everywhere, and the stairs result as the
hero of the planner. Every part was checked by the developer on screenshots before its commit.
Open ideas are listed in "Ideas for later"; none of them blocks stage 8 or 9.

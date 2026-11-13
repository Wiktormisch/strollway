# Stage 7b: Visual redesign "Nordic Sage"

**Status:** in progress. Session 1 (`docs/design-system`) merged in PR #21. Session 2
(`feat/ui-tokens`) done on 2026-11-13. Sessions 3 and 4 are next.
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

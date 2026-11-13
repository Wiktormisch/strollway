# Design system: Nordic Sage

The visual rules for the StrollWay UI. This file is the source of truth for the redesign.
The Figma file is the visual reference:
[StrollWay - Redesign](https://www.figma.com/design/c9tCW8qo2FG4v55FezHk0O)
(pages: Foundations, Planner - Mobile in light and dark, Components).
The Figma MCP plan has a monthly call limit, so agents work from this file, not from Figma.

## 1. Idea

Scandinavian minimalism for families on a walk: a light, warm background, a lot of space,
sage green for nature and the route, deep navy for text and decisions.

Three colour roles, one meaning each:
- **Navy** = content and decisions (text, the main button).
- **Sage** = nature and the stair-free route (route line, success, selected states).
- **Terracotta** = stairs only (stairs on the map, stairs warnings). Never used as decoration.

## 2. Colour tokens

Token names match the CSS variables in `frontend/src/index.css` (`--background` and so on).
Contrast was checked against WCAG 2.2: text needs 4.5:1, graphics need 3:1.

| Token | Light | Dark | Use | Contrast (light) |
|---|---|---|---|---|
| `background` | `#F7F6F2` | `#0E1E2A` | page background | - |
| `card` | `#FFFFFF` | `#152A3A` | cards, bottom sheet, top bar | - |
| `foreground` | `#12334A` | `#E8EEF1` | main text | 12.2:1 on background |
| `muted-foreground` | `#5F6B73` | `#A7B4BC` | secondary text, captions | 5.1:1 |
| `primary` | `#12334A` | `#E8EEF1` | main button | - |
| `primary-foreground` | `#FFFFFF` | `#12334A` | text on the main button | 13.1:1 |
| `brand` | `#4E7360` | `#9DBCA8` | route line, links, switches, success | 4.9:1 (text allowed) |
| `brand-soft` | `#E3ECE5` | `#1E3A33` | result card, chips, secondary button | navy on it 10.9:1 |
| `sage-500` | `#6B8F7B` | `#7FA38E` | icons and graphics only, **not text** | 3.3:1 |
| `stairs` | `#C2662D` | `#E08A52` | stairs on the map, warning icons | 3.7:1 (graphics only) |
| `stairs-text` | `#A8531F` | `#F0A574` | text about stairs | 4.9:1 (dark: 8.3:1) |
| `border` | `#E4E2DC` | `#24394A` | lines, outlines | - |
| `muted` | `#EFEDE7` | `#1A2F3F` | tab track, skeletons, hover | - |

Status colours (`success`, `info`, `warning`) are built from these tokens:
success = `brand` on `brand-soft`, info = `foreground` on `muted`, warning = `stairs-text` on a
light terracotta tint. Destructive actions keep the shadcn `destructive` red.

The keyboard focus ring uses `brand` (at least 3:1 on both backgrounds).

## 3. Typography

Font: **Geist** (already installed, `@fontsource-variable/geist`). Base size is 16 px.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 32 / 40 | 600 | rare, empty states |
| Title | 24 / 32 | 600 | page titles, the result headline |
| Heading | 20 / 28 | 600 | section titles |
| Body Large | 18 / 28 | 400 | intro text |
| Body | 16 / 24 | 400 | default text |
| Body Strong | 16 / 24 | 500 | labels, button text |
| Caption | 14 / 20 | 400 | hints, meta data |
| Label | 13 / 16 | 500 | small labels, uppercase tags |

Titles 24 px and up use -1% letter spacing. Avoid `text-xs` for anything a user must read.

## 4. Space, radius, shadow

- Spacing on a 4 px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Card padding 16-20 px. Gap between sections 20-24 px.
- Radius: 8 (small), 12 (inputs, rows), 16 (cards), 24 (bottom sheet top), full (buttons, tabs, chips).
- No shadows on cards; a 1 px `border` is enough. Shadows only on things that float over the map
  (top bar, bottom sheet, map markers).
- Touch targets at least 44 x 44 px.

## 5. Components

| Component | Rules |
|---|---|
| Button | Pill shape. **Primary** = navy, one per screen (for example "Save walk"). **Secondary** = `brand-soft` with navy text. Ghost for icon buttons. |
| Tabs | Pill track in `muted`, active tab is `card` with Body Strong text. |
| Point row | Rounded row with a 1 px border: badge (A = navy, B = sage), label, a "Change" text action. Shows "Point on the map" and never raw coordinates; the coordinates are in a "Details" line that is closed by default. Demo routes may show their demo name. |
| Result hero | `brand-soft` card: small uppercase tag ("STAIR-FREE"), Title "You avoid 120 m of stairs", Body "Only +3 min longer", then a row of stats (distance, time, places). The other detour cases use the same layout with their status colour. |
| Banner | Status colour, icon, one short sentence, optional action. |
| Map markers | A = navy circle, B = sage circle, white 3 px outline, soft shadow, 36 px. Places = white circle with a sage outline and the category icon, 28 px. |
| Map lines | Stair-free route `brand` 6-7 px; shortest route `muted-foreground` 3 px dashed; stairs `stairs` 6-7 px. |

## 6. Layout

**Phone (under 768 px), the main target:**
- The map fills the screen.
- A floating top bar (`card`, full radius, soft shadow): logo, navigation, and a menu with
  language and theme.
- A bottom sheet (`card`, 24 px top radius) with a handle. **The handle is visual only.** It and the
  header toggle the sheet between open and closed, like today. No dragging and no snap points in
  this redesign (decided 2026-11-13; dragging is a possible next step).
- When the sheet is closed, the next action is a floating pill button over the map (as today).

**Tablet and desktop (768 px and more):** no Figma mock-up. Keep today's structure: a 400 px side
panel on the left, the map on the right. The panel uses the same cards and spacing as the sheet.
Other pages use a centred column (max 960 px) with cards on `background`.

## 7. States

Every screen needs these, built from the tokens above:
- **Loading:** skeleton blocks in `muted`, no spinners for content.
- **Empty:** a short sentence and one action, inside a dashed `border` card.
- **Error:** warning banner with "Try again".
- **Demo mode:** info banner that says the data is recorded.
- **Stairs cases** of the result card: no stairs, small detour, big detour, no step-free route
  (warning), check failed (warning), not searched (info).

## 8. Where today's UI elements go

The mock-up shows only the main flow. Nothing is removed:
- Language and theme switch: in the top bar (a menu on phones).
- Profile select, demo routes, avoid stairs switch: in the route form, under the points.
- Legend: a small chip on the map.
- Places with category filters, transit stops: under the result, as collapsible sections.
- API status (`HealthStatus`): a small line at the bottom of the panel, muted.
- Trip idea mode: same tabs, same cards and button styles.

## 9. Rules for the implementation

- Colours only through tokens (Tailwind classes such as `bg-brand`, `text-stairs-text`).
  No raw Tailwind palette colours (`emerald-600`) and no hex values in components.
- Leaflet cannot read Tailwind classes. Map colours are read from the CSS variables at runtime,
  and the map redraws when the theme changes.
- Map tiles stay OpenStreetMap. A different tile provider is a separate decision (licence).
- No reverse geocoding: points are never sent to an outside service to get a place name
  (decided 2026-11-13, AGENTS.md rule 5).
- Every new string goes to both `pl.json` and `en.json`.
- Before a UI change is done: check light and dark, phone and desktop, keyboard focus,
  hover / active / disabled states, and long Polish texts.

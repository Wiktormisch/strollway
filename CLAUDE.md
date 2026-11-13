# CLAUDE.md - StrollWay

@AGENTS.md

## Claude Code specifics
- Talk to the developer in Polish (their preference); write everything in the repo in English.
- The developer knows Django well and is learning React and TypeScript. When you use a pattern they may not
  know, explain why in one or two sentences. No lectures.
- No sub-agents for small or medium tasks. Say so before you start any.
- Each stage of `docs/PLAN.md` (section E) is one session and one branch. Read the stage first.
- `.claude/settings.json` blocks reading `.env` files and asks before `git commit` and `git push`.
  Do not try to work around it.

## UI design and Figma MCP

### Source of truth
- `docs/DESIGN.md` is the source of truth for the visual design (tokens, type, components, layout).
  The Figma file linked there is the visual reference. Figma MCP has a monthly call limit on our
  plan: use it only when the developer asks, and batch the calls.
- When Figma and `docs/DESIGN.md` disagree, ask. When a screen has no mock-up, follow `DESIGN.md`
  and the existing code.
- Read before you build: take colors, spacing and sizes from `docs/DESIGN.md` (or, when asked,
  from Figma MCP: `get_design_context`, `get_screenshot`, `get_variable_defs`). Never guess them.
- Map Figma values to what the code already has (Tailwind theme, shadcn/ui components, CSS variables).
  Do not hard-code raw hex or px values, and do not recreate a component that already exists.
- Writing to Figma (`use_figma`, `generate_figma_design`, `send_code_to_figma`, `upload_assets`,
  comments) sends data outside this machine. Do it only when the developer asks in this session.
  Never put real personal data or coordinates into Figma; use fake data.

### Audit and redesign
- Keep the current StrollWay visual identity unless the developer asks to change it.
  Do not copy templates or other apps.
- An audit is read-only: analyze the existing UI first, then report inconsistencies and UX problems
  with screen, component and file references (`src/...:line`), ordered by impact.
- For bigger visual changes, propose 2-3 directions with pros and cons. Change no code until
  a direction is approved.

### Implementation workflow
1. Inspect the existing code for the screen or component.
2. Get the Figma design context and a screenshot.
3. Show a short proposal; wait for OK on anything beyond a small fix.
4. Implement one screen or component at a time.
5. Compare the result with the Figma reference (screenshot side by side) and fix differences.

### Consistency and quality
- Keep colors, typography, spacing, radius and icon style consistent; prefer shared tokens
  (Figma Variables on the design side, Tailwind theme / CSS variables on the code side).
- Buttons, cards, forms and navigation look and behave the same everywhere.
- Mobile first: the app is used on a phone during a walk. It must also work on tablet and desktop.
  Avoid fixed widths and heights where a flexible layout works.
- Prefer original Figma assets and existing icons; do not swap in random alternatives.
- Before calling a screen done, check: visual hierarchy, alignment, contrast (WCAG AA),
  hover / focus / active / disabled states, keyboard focus, and both `pl` and `en` text lengths.

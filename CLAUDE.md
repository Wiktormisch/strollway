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

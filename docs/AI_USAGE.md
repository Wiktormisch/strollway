# How AI tools were used

This page describes how the developer worked with AI tools on StrollWay: what the AI did, what the human did, and how AI claims were checked. The examples are real and come from the project history (`docs/DECISIONS.md`, section 5, lists the errors found in the first version of the plan).

## Roles

| Who | What |
|---|---|
| **Claude Fable** (planning) | Wrote and revised `docs/PLAN.md`: options, scope, data model, API contract, stage prompts, risks. |
| **Claude Opus** (coding) | Builds one stage per session from the stage prompt, on its own branch. |
| **The developer** | Decides scope and trade-offs, runs the checks by hand, reads every diff, commits, pushes, merges. |

## The working loop

1. **Triage first.** Every task starts with a short block: size (small / medium / large), which tests will run, which agents, which branch. A large task gets a plan, and the developer approves it before any code is written.
2. **Plan before code.** The plan is the first commit. Every stage prompt names the plan sections the agent must read.
3. **One stage, one session, one branch.** Each stage has a goal, a definition of done and a test list (see `docs/PLAN.md`, section E).
4. **Checks before handover.** The agent runs the tests and linters that cover the changed code and reports the real output, including failures.
5. **A human reads the diff.** The agent never commits, pushes, merges or opens a PR on its own (`AGENTS.md`).
6. **Self-review with named gaps.** At the end of a task the agent scores its own work from 1 to 10 and must name what is missing. A score without named gaps is not accepted.

Each finished stage has a short log in `docs/stages/` (`docs/stages/stage-1.md` to `stage-7.md`): what was built, which checks ran, and what went wrong.

## Verify before building

Before any code, the riskiest assumptions of the plan were checked by hand against the real services (stage 0). This changed the plan:

- The first plan assumed ORS returns stairs as a count and in `/geojson`. Checking showed it returns **metres** of "steps" segments, and that `/json` returns an encoded polyline. The plan was rewritten, and a decoder was added to the scope.
- The first plan assumed a failed "avoid steps" request is an error. Checking showed ORS answers **404 with code 2009** when stairs are the only way. This became a designed case in the UI instead of a crash.
- The first plan expected playgrounds along routes. Measuring OpenStreetMap showed that places along one route are mostly benches (and there were no playgrounds in two of three tested areas). This is why the AI feature became "trip ideas" around a start point, where the model has real choices to make.

## AI claims are checked against sources

- A summary of Overpass limits written by a second AI was compared with the official documentation. Most numbers were right. Two were **not** in the sources ("2 parallel slots per IP" and "10 minutes of total query time per day"), so they were recorded as unconfirmed instead of being used.
- Coordinates for demo routes proposed by the agent were written from memory and flagged as approximate. One pair turned out to have no stairs at all and was rejected; another gave the most useful case (no step-free route).
- In stage 2 the developer asked the agent to review its own plan before coding. The review found three real gaps (a bad client id could give 404 instead of 400, a `PATCH` with only a rating ignored the saved status, a stop could move to another walk). All were fixed and tested before the first commit.
- In stage 3 the agent reviewed its plan (9 gaps) and later its diff. The second review found that the tests read files which `record_fixtures` rewrites, and that the command wrote Windows line endings. Both were fixed before the first commit. Overpass was down during the stage; the app returned routes without places, as designed, instead of waiting.
- The flags of `claude -p` were read from `claude --help`, not guessed, and were tested in stage 6. The test showed that without `--safe-mode` the CLI read the developer's global `CLAUDE.md` and answered with a triage block instead of JSON.
- In stage 7 the developer asked whether the agent had followed the global rules and to review its plan critically. The agent admitted two misses (it wrote in English instead of Polish, and gave no score) and found a contract gap it had played down: after removing a stop, the route and the arrival times are out of date, and the browser cannot recalculate them. The developer chose to keep the route and say so in the UI. Later reviews of the agent's own diff found a wrong error message, unsafe list keys and a light theme flash, all fixed before commit.
- Manual testing by the developer (a checklist of about 45 points) found what automated tests did not: a missing map button on phones, the ignored dark system theme, and a cached favicon. The agent also proposed a merge commit prefix (`release:`) that is not a Conventional Commits type, and corrected it itself when the developer asked for the exact merge texts.
- In the redesign (stage 7b) the agent audited the UI from the code, proposed three directions, and
  built the colour variables, type styles, one mobile screen (light and dark) and four components in
  Figma through the Figma MCP server. It reported honestly that it had not seen the running app.
  The free MCP plan ran out of calls mid-task, before the agent could check the dark screen; the
  developer checked it by hand. When asked to review its own plan critically, the agent found that
  the mock-up implied reverse geocoding (sending coordinates to a new service, against rule 5) and a
  draggable sheet (a feature, not a style); the developer chose to leave both out.

## What the AI is allowed to do inside the app

- The LLM only picks and orders places from candidates that the backend collected. It cannot invent a place.
- Code does everything deterministic: distances, times, routes, stairs metres, opening hours, validation.
- No coordinates, addresses, profile names or notes are sent to the model. The only free text sent is the short "wishes" field, and the UI warns about it (there is a test for the rest).
- Every LLM answer is validated. A bad answer, a timeout or a missing key gives a rule-based plan, and the UI shows which engine built it.
- Without any API key the app runs in a demo mode with recorded data.

## Safety rules for agents

The six rules are in `AGENTS.md` and enforced in `.claude/settings.json` where possible (reading `.env` is denied; commits and pushes ask first). No production credentials are given to agents; keys are typed by the developer on the server.

# rig

The lane's resident service: keeps a heartbeat, serves the status board, reads the night's run
log. Hono + JSX, rendered on the server, Node 22+.

Read first: `docs/vision.md`, `docs/styleguide.md`. Decisions: `docs/adr/`.

## Commands

- `pnpm dev` / `pnpm start`: serves on `PORT` (8787). Needs `.env` (copy `.env.example`).
- `pnpm test`: vitest. `pnpm typecheck`: tsc.

## How work moves here

1. A feature starts as a plan: `plan.md` at the root (one at a time). Finished plans live in
   `docs/plans/done/`.
2. The plan is split into GitHub issues: skill `plan-to-issues` (`.agents/skills/`). A human
   reviews the split before anything is published. GitHub issues out of reach: files in
   `docs/issues/` (ADR 0004).
3. Issues are worked by workers, one issue per worker, each on its own branch or worktree.
   Pick the model per issue: the strongest for logic, a cheaper one for views and tests.
4. A worker closes its issue with a closing comment, exactly this shape:

   ```
   done: <what changed, one line>
   worker: <harness> · <model> · <effort>
   commit: <sha or "none">
   ```

5. An issue is closed only when its "Done when" holds. If it can't hold yet, leave it open and
   say what it waits on.

## Issue shape

Every issue split from a plan carries, in this order (decided by the human who reviewed the
morning-digest split, 2026-11-01):

- First line: `Source: plan.md § <n>`. Label: `plan:<plan>` (the `plan:` key in its frontmatter).
- `## Scope`: what the plan section asks, in the plan's words, plus the ADR or styleguide rules
  that bind it.
- `## Done when`: the plan's done condition, word for word.
- `## Blocked by`: real issue numbers, or `—`. Say when a worker needs only part of one (e.g.
  just the types), and when "Done when" also waits on another issue or on someone outside.
- `## Model tier`: strong (logic) or cheap (views, tests).
- `## Closing comment`: the closing comment shape above.

An issue that waits on someone outside (a reviewer, a host, another team) stays open until they
confirm, even when its "Done when" reads as met. The preview issue of morning-digest was closed
on sending and had to be reopened until the review was in.

## Skills

Shared skills live in `.agents/skills/`, one folder each, `SKILL.md` inside. That folder is the
one source for every harness on the team. If yours loads skills from somewhere else, point it
here (a link or a config entry). Don't copy: copies drift.

## Rules

- Never commit `.env`, tokens or previews.
- Don't touch `runs/`: those are real nights, read-only fixtures.
- No client JS (ADR 0001).

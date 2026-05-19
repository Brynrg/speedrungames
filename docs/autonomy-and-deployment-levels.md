# Autonomy and deployment levels

How much the agent (Claude / future automation) is permitted to do on its own. Levels are cumulative — each one includes everything below it.

## Level 0 — Advisory only

The agent reads the repo, proposes changes, but **commits nothing**. Output is text/markdown only. The human applies any changes manually.

Useful for: initial repo audits, risk assessments, "what would you do here".

## Level 1 — Game repo autonomy only

The agent can fully operate inside **a separate game source repo** (creating, building, testing, pushing). It does **not** touch this portal repo.

Useful for: building or iterating on a game, getting it to green builds + green tests, before any portal involvement.

## Level 2 — Portal PR autonomy (current recommended level)

In addition to Level 1, the agent can:

- Create a branch in this portal repo.
- Run `scripts/ingest-game-build.mjs` to populate `apps/web/public/games/<slug>/`.
- Commit the resulting changes.
- Open a PR.

It **cannot**:

- Push to `main` directly.
- Merge its own PR.
- Modify any file in [AGENTS.md §8 high-risk list](../AGENTS.md) without explicit operator approval and a separate PR.
- Change Netlify settings (env vars, build hooks, redirects, domains).
- Change CI workflows.

**A human merges the PR.** Netlify's deploy preview lets the human play the game from a preview URL before merging.

## Level 3 — Auto-merge after checks and policy

In addition to Level 2, the agent's PR auto-merges **only when**:

- All required CI checks pass.
- The PR touches **only** `apps/web/public/games/<slug>/**` and `apps/web/src/lib/games.registry.json`.
- A Netlify deploy preview built successfully.
- The repo's branch protection / auto-merge rules are configured to enforce the above.

**Gate (do not enable Level 3 until all of these hold):**

- At least **10 consecutive successful Level-2 PRs** have landed with all checks passing.
- **Zero post-merge rollbacks** required across those 10.
- Operator has reviewed and explicitly approved the move to Level 3.

Until that gate is met, Level 3 stays off.

## Level 4 — Full production autonomy for low-risk updates

In addition to Level 3, the agent can update certain narrow things without a PR:

- Bumping `version` and `lastUpdated` in an existing game's manifest after a no-code asset replacement.
- Promoting a game from `draft` → `preview` after a Playwright smoke pass.

Level 4 is speculative. **Do not enable** without operator approval and a documented rollback story.

## Current level

**Level 2.** PR-only. Set by AGENTS.md and commands/gamedeploy.md.

## Rollback

Initial rollback is the simplest thing that works:

```bash
# Find the offending portal PR / commit
gh pr list --state merged --limit 10
# Revert it
gh pr revert <number>  # or: git revert <sha> && git push
```

Netlify will redeploy from the new `main` HEAD. The game disappears from the portal until a corrected PR lands.

A future `/gamerollback <slug>` command may automate this — out of scope for now.

## Repo bloat triggers (when to move to artifact storage)

The current model commits built game output into this repo. That's fine while the repo stays small. Move to artifact storage (Netlify Large Media, S3, Git LFS, or per-game Netlify sites with reverse proxy) when **any** of these become true:

- Portal repo on disk exceeds **250 MB** (use `du -sh .git`).
- Live game count exceeds **15**.
- Any single compressed game build exceeds **25 MB**.

## Alternative architecture (deferred)

Per-game Netlify sites + portal-side reverse proxy. Each game is its own Netlify deploy; the portal proxies `/games/<slug>/*`. Already partially scaffolded in this repo via [bin/new-game](../bin/new-game) and [AGENT.md](../AGENT.md), but unused by any shipped game.

**Why deferred:** more moving parts (one Netlify site per game, build hooks, proxy config). The ingest-into-portal model is simpler and currently fits well within bloat triggers.

**When to revisit:** when one of the bloat triggers above fires. At that point, the per-game-Netlify-site approach becomes the natural next step and the existing `bin/new-game` scaffolding becomes useful again.

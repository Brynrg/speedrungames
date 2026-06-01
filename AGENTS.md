# AGENTS.md — speedrungames.net portal contract

**Read this file before adding or updating any game in this repo.**

## Repo scope (read before exploring)

Only these top-level paths are part of the portal and in scope for game work:

- `apps/` — the Next.js portal site (games are served from `apps/web/public/games/<slug>/`).
- `games/` — vendored game source kept in-repo (most games live in their own repos; see §2).
- `scripts/`, `bin/`, `commands/` — the ingest / registry / new-game tooling.
- `docs/`, `schemas/` — the contracts and manifest schemas.
- `reports/` — agent run reports (§12).

Everything else at the repo root is **out of scope** — ignore it. Do not build, edit, or reason about it when working on a game, and never wire it into the portal build (`pnpm-workspace.yaml` globs only `apps/*` and `games/*`; Netlify builds only `apps/web`).

## 0. Canonical commands (read first)

There is exactly ONE way to create a game and ONE way to deploy/update one. Do
not improvise either. Hand-copying build output into the portal is the single
most common way agents break the live site — it is forbidden (see §9).

**Create a new game:**

```bash
pnpm new:game --slug <slug> --title "<Title>" --framework <vanilla|vite|vite-phaser|vite-pixi|vite-react|nextjs>
```

This creates a GitHub repo from `speedrungames-game-template` that is born
auto-deploying: it sets the deploy secret and wires the game's CI to this
portal. (`bin/new-game` is DEPRECATED — do not use it.)

**Update / deploy a game:** just push to the game's source repo. Its
`.github/workflows/deploy.yml` calls this portal's reusable workflow
[`.github/workflows/deploy-game.yml`](./.github/workflows/deploy-game.yml),
which builds, runs `scripts/ingest-game-build.mjs`, and opens an **auto-merging
portal PR** that lands only when CI + the Netlify deploy preview pass. Every
push auto-deploys.

**Manual deploy (no CI):** from a built game repo, run the portal ingest — never
copy files yourself:

```bash
node /path/to/speedrungames/scripts/ingest-game-build.mjs --game-dir <game-repo> --status live
```

> ❌ **Never** `cp`/`rsync`/hand-edit anything under `apps/web/public/games/`.
> The deployed files live at the **root** of `apps/web/public/games/<slug>/`,
> never in a nested `dist/` subfolder. `scripts/validate-games.mjs` fails CI on a
> stray `dist/`/`out/`/`build/` subdir — that check exists because a hand-copied
> `cp -r dist <game-dir>/` once shipped a "no visible change" build.

## 1. Purpose

This repo powers **speedrungames.net**, a browser game portal. It hosts static browser games under `/games/<slug>/`. Games are isolated in sandboxed iframes. AI agents and humans must follow this contract end-to-end — it defines the canonical portal-side deployment model.

## 2. Core deployment model (canonical)

- **One source repo per game.** Each game's source code lives in its own GitHub repo (no naming requirement; the source repo URL goes in the game's manifest).
- **Built static output is ingested into this portal.** A game's `dist/` (after `npm run build` or equivalent) is copied into `apps/web/public/games/<slug>/` in this repo.
- **Per-game portal manifest.** Every game has `apps/web/public/games/<slug>/manifest.json` carrying slug, title, repo, sourceCommit, buildHash, buildTimestamp, status, framework, etc.
- **Generated registry.** `apps/web/src/lib/games.registry.json` is **generated** from the per-game portal manifests by `scripts/build-registry.mjs`. Never hand-edit it.
- **Catalog source of truth.** The portal app imports `apps/web/src/lib/games.registry.json` directly. A game is not connected until its manifest is present, the registry is regenerated, validation passes, and the deploy preview homepage lists it.
- **Netlify deploys this repo.** Build = `pnpm install --frozen-lockfile && pnpm -C apps/web build`. Publish = `apps/web/.next` via `@netlify/plugin-nextjs`.

> **Legacy note:** [bin/new-game](./bin/new-game) and `apps/web/scripts/discover-games.mjs` belong to an older per-game-Netlify-site + reverse-proxy experiment. **Do not use that flow for normal game launches.** This file and [commands/gamedeploy.md](./commands/gamedeploy.md) both point to the ingest model defined here.

## 3. Game isolation rule

The portal loads every game through a sandboxed iframe:

```jsx
<iframe
  src="/games/<slug>/index.html"
  title="<Game Title>"
  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-gamepad"
  allow="gamepad; fullscreen"
  loading="lazy"
/>
```

Games must not assume parent-window access. Any future portal↔game communication uses an explicit `postMessage` schema (TBD; not in scope until needed).

## 4. Path rule

- Games are playable at `/games/<slug>/`.
- **Asset URLs must be relative, never root-absolute (`/assets/...`).** For Vite, the canonical config is `base: "./"` (what the template ships); a slug-absolute `base: '/games/<slug>/'` derived from `game.manifest.json` is also accepted. For Next.js static export, set `basePath`/`assetPrefix` to `/games/<slug>` and prefix raw `<img src>` strings yourself. See [docs/browser-game-template-contract.md](./docs/browser-game-template-contract.md) §3.
- After ingest, every `live` or `preview` game must have `apps/web/public/games/<slug>/index.html`.

## 5. Game source repo contract (summary — full spec in `docs/browser-game-template-contract.md`)

Each game source repo must provide:

- `game.manifest.json` — source-of-truth manifest (slug, title, description, framework, supportsMobile, version, entry, buildCommand).
- `npm run build` (or `pnpm build`) — produces `dist/index.html` + assets.
- `npm run test` — at minimum a Playwright smoke test that loads the built `dist/` under a nested path and asserts a game-root element renders without console errors.
- `ASSETS.md` — when any non-code assets are present, with per-asset licensing.

## 6. Portal manifest / provenance contract

Every `apps/web/public/games/<slug>/manifest.json` must satisfy the JSON Schema at [schemas/portal-game-manifest.schema.json](./schemas/portal-game-manifest.schema.json) and include:

- `slug` (kebab-case)
- `title`, `description`
- `repo` (source repo URL or `owner/name`)
- `playUrl` — must equal `/games/<slug>/`
- `category`
- `status` — one of: `draft`, `preview`, `live`, `archived`, `broken`
- `framework` — one of: `vite`, `vite-phaser`, `vite-pixi`, `vite-react`, `vanilla`, `other`
- `supportsMobile` (boolean)
- `version`
- `sourceCommit` (git SHA from the source repo at build time)
- `buildHash` (deterministic sha256 over `dist/`; method documented in [scripts/ingest-game-build.mjs](./scripts/ingest-game-build.mjs))
- `buildTimestamp` (ISO datetime)
- `lastUpdated` (derived from `buildTimestamp`)
- `redirectTo` — required if `status` is `archived` and `index.html` is not preserved

Optional: `assetLicenseSummary` or `assetsDocumented` flag (asserting the source repo has `ASSETS.md`).

## 7. Halt protocol

On any non-zero command, validation failure, missing output, schema failure, or unclear deployment state:

1. **Stop.** Do not continue the deployment/setup sequence.
2. Do not push broken changes to this portal.
3. Write a failure report under `reports/<UTC-timestamp>-<slug>.md` covering:
   - Failed step (phase + sub-task)
   - Exact command(s) attempted and their non-zero exit codes
   - Error output (last ~50 lines)
   - Files touched in this run
   - Recommended next action

## 8. High-risk files

Normal `/gamedeploy` runs **must not modify** these without explicit justification reported in the final summary:

- `netlify.toml`
- `package.json`
- `pnpm-lock.yaml` (or other lockfile)
- `.github/workflows/**`
- `AGENTS.md` (this file)
- `commands/**`
- `scripts/**`

If a high-risk file must change, the agent must:
1. Explain why in the run report.
2. Open a separate, clearly-labeled PR if the change is non-trivial.

## 9. Forbidden actions

- No secrets in code, manifests, registry, or commits. **Never read, print, modify, or commit** `.env`, `.env.*`, Netlify tokens, OAuth secrets, API keys, or private keys.
- No backend services unless explicitly requested.
- No external APIs unless explicitly requested.
- No host migration away from Netlify.
- **No manual `git push` to `main`, and no hand-copying into `apps/web/public/games/`.** Game deploys reach `main` ONLY through the reusable deploy workflow's auto-merging PR (gated on CI + Netlify preview) — see [docs/autonomy-and-deployment-levels.md](./docs/autonomy-and-deployment-levels.md) (current level: **Level 3**). Portal-infra changes (high-risk files, §8) still go through a human-reviewed PR.
- No copyrighted or unlicensed assets.
- No auth, payments, analytics, or other external service integration in normal game-deploy runs.
- **Multiplayer:** allowed only via one of the approved free-tier patterns in [docs/multiplayer-architecture.md](./docs/multiplayer-architecture.md). The default position is single-player; multiplayer is opt-in per game and must declare its pattern in `game.manifest.json`. **No always-on paid servers, no proprietary multiplayer SDKs requiring paid plans, no usage-billed APIs without a documented free ceiling.**

## 10. Required final-report format (every run)

End every deploy/setup run with a structured report containing:

1. **Summary** — one paragraph: what changed and the outcome.
2. **Files changed** — list, grouped by category (docs / scripts / portal / config).
3. **Commands run** — exact commands, in order.
4. **Validation results** — per-step pass/fail, with exit codes for failures.
5. **Known limitations** — what's deferred, what's still TODO.
6. **Next recommended step** — the smallest unit of follow-up work.

## 11. Slash commands

- `/gamedeploy <game description>` — see [commands/gamedeploy.md](./commands/gamedeploy.md). Build or update a game and ingest it into this portal.

## 12. Reports directory

Agents may write run reports (success or failure) under [`reports/`](./reports/) using the filename pattern `<UTC-timestamp>-<slug>.md`. The directory is tracked via `.gitkeep`.

## 13. Recommended further reading

- [commands/gamedeploy.md](./commands/gamedeploy.md) — the `/gamedeploy` contract.
- [docs/browser-game-template-contract.md](./docs/browser-game-template-contract.md) — what a game source repo must provide.
- [docs/autonomy-and-deployment-levels.md](./docs/autonomy-and-deployment-levels.md) — current rollout level and PR/merge policy.
- [docs/multiplayer-architecture.md](./docs/multiplayer-architecture.md) — approved free-tier multiplayer patterns.
- [schemas/portal-game-manifest.schema.json](./schemas/portal-game-manifest.schema.json) — manifest validation schema.

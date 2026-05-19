# AGENTS.md — speedrungames.net portal contract

**Read this file before adding or updating any game in this repo.**

## 1. Purpose

This repo powers **speedrungames.net**, a browser game portal. It hosts static browser games under `/games/<slug>/`. Games are isolated in sandboxed iframes. AI agents and humans must follow this contract end-to-end — it defines the canonical portal-side deployment model.

## 2. Core deployment model (canonical)

- **One source repo per game.** Each game's source code lives in its own GitHub repo (no naming requirement; the source repo URL goes in the game's manifest).
- **Built static output is ingested into this portal.** A game's `dist/` (after `npm run build` or equivalent) is copied into `apps/web/public/games/<slug>/` in this repo.
- **Per-game portal manifest.** Every game has `apps/web/public/games/<slug>/manifest.json` carrying slug, title, repo, sourceCommit, buildHash, buildTimestamp, status, framework, etc.
- **Generated registry.** `apps/web/src/lib/games.registry.json` is **generated** from the per-game portal manifests by `scripts/build-registry.mjs`. Never hand-edit it.
- **Netlify deploys this repo.** Build = `pnpm install --frozen-lockfile && pnpm -C apps/web build`. Publish = `apps/web/.next` via `@netlify/plugin-nextjs`.

> **Alternative pattern (legacy / optional):** [AGENT.md](./AGENT.md) and [bin/new-game](./bin/new-game) describe a per-game-Netlify-site + reverse-proxy flow with GitHub-topic auto-discovery (`apps/web/scripts/discover-games.mjs`). **No currently shipped game uses that flow.** Treat AGENT.md / bin/new-game / apps/web/scripts/discover-games.mjs as historical/alternative documentation. New games go through the ingest model defined here.

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
- Vite games must set `base: '/games/<slug>/'`, derived from `game.manifest.json` or a `GAME_SLUG` env var. See [docs/browser-game-template-contract.md](./docs/browser-game-template-contract.md).
- **Do not rely on root-relative `/assets/...` paths.** Use the configured `base`.
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
- No direct push to `main` unless repo policy explicitly allows it (currently it does NOT — see [docs/autonomy-and-deployment-levels.md](./docs/autonomy-and-deployment-levels.md)).
- No copyrighted or unlicensed assets.
- No multiplayer infrastructure, auth, payments, analytics, or other external service integration in normal game-deploy runs.

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
- [schemas/portal-game-manifest.schema.json](./schemas/portal-game-manifest.schema.json) — manifest validation schema.
- [AGENT.md](./AGENT.md) — historical/alternative proxy-based flow (not canonical).

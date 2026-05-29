# /gamedeploy

**Build or update a browser-playable game and deploy it into speedrungames.net using the standard portal + game-repo workflow.**

Usage:

```
/gamedeploy <game description>
```

Where `<game description>` is plain English: what the game is, optionally including the slug, title, framework, and notes. If the description matches an existing slug, this command updates that game. Otherwise it creates a new one.

## 1. Purpose

Land a working game on `https://speedrungames.net/games/<slug>/` end-to-end with no human intervention beyond reviewing and merging the portal PR. The flow ingests the game's built `dist/` into this portal repo, generates a per-game manifest, regenerates the registry, validates, opens a PR.

## 2. Required behavior (in order)

1. **Read root [AGENTS.md](../AGENTS.md).** Inherit all rules.
2. **Inspect the portal repo before any change.** Confirm current branch state, existing per-game directories under `apps/web/public/games/`, and the existing registry.
3. **Detect multiplayer intent in the user's description.** Keywords like "multiplayer", "MP", "PvP", "co-op", "two-player", "online", "real-time", etc. → **read [docs/multiplayer-architecture.md](../docs/multiplayer-architecture.md) before continuing.** Choose ONE of the five approved free-tier patterns (Local / WebRTC P2P / PartyKit / Cloudflare Workers+DO / Netlify Blobs async) and set `multiplayer` + `multiplayerProvider` in the game's `game.manifest.json`. If the user's request implies costs beyond the documented free tiers (always-on servers, paid SDKs, voice/video at scale), **halt and surface the cost question** — do not silently incur cost.
4. **Determine new vs. existing game.** Match by slug. If the user's description provides a slug, use it. Otherwise infer kebab-case from the title.
5. **Choose / validate slug.** Lowercase kebab-case, URL-safe, ≤ 24 chars, no leading/trailing hyphen, not already taken.
6. **Create or update the dedicated game source repo.**
   - For a new game: scaffold from the official game template (or per the user's framework preference). Follow [docs/browser-game-template-contract.md](../docs/browser-game-template-contract.md).
   - For an existing game: clone and update.
7. **Follow the standard game-repo contract.** Required files: `game.manifest.json`, `package.json`, `vite.config.ts` (when Vite), `src/`, `tests/`. See the contract doc.
8. **Build the static browser app** in the source repo: `npm ci && npm run build`.
9. **Verify game `npm run test`.** Smoke test must pass.
10. **Verify game `npm run build`** produced `dist/index.html`.
11. **Verify nested-path behavior.** Game must serve correctly at `/games/<slug>/` — relative paths only, no `localhost`/`127.0.0.1`/absolute `/assets/*` references in the build output.
12. **Verify iframe compatibility.** Game must not depend on parent-window access. Verify by loading the built `dist/` inside a sandboxed iframe in a Playwright smoke check.
13. **Ingest using [scripts/ingest-game-build.mjs](../scripts/ingest-game-build.mjs):**

    ```bash
    node scripts/ingest-game-build.mjs --game-dir <path-to-game-repo> --status preview
    ```

    The ingest script:
    - Reads the source `game.manifest.json`.
    - Captures `sourceCommit` from the game repo's HEAD.
    - Computes a deterministic `buildHash` over `dist/`.
    - Cleans and re-populates `apps/web/public/games/<slug>/`.
    - Writes `apps/web/public/games/<slug>/manifest.json`.
    - Runs `scripts/build-registry.mjs` and `scripts/validate-games.mjs`.
14. **Confirm the portal builds.** Run `pnpm install --frozen-lockfile && pnpm -C apps/web build`.
15. **Verify catalog connection before opening the PR.**
    - Confirm `apps/web/public/games/<slug>/manifest.json` exists.
    - Confirm `apps/web/src/lib/games.registry.json` contains `<slug>` after `pnpm run build:registry`.
    - Confirm the app build imports the registry and the deploy preview homepage lists the game title.
16. **Open a PR** against the portal `main` branch.
    - Title: `feat(games): add/update <title> (<slug>)`
    - Body: result of the structured report (see §5).
    - Branch name: `game/<slug>` or `game/<slug>-<short-sha>`.
17. **Auto-merge: enabled, gated.** Per [docs/autonomy-and-deployment-levels.md](../docs/autonomy-and-deployment-levels.md) the current level is **Level 3**. Game-content PRs (touching only `apps/web/public/games/<slug>/**` + `apps/web/src/lib/games.registry.json`) are opened with `gh pr merge --auto --squash` and land automatically **once required CI checks + the Netlify deploy preview pass**. Prefer letting the game repo's `deploy.yml` (→ reusable `deploy-game.yml`) do this. Do not hand-merge; do not bypass the checks.

## 3. Hard rules

- **No manual `main` push, no hand-copy.** Deploys reach `main` only via the auto-merging PR gated on CI + Netlify preview. Never `cp`/`rsync` into `apps/web/public/games/` — use `scripts/ingest-game-build.mjs` (or the game repo's `deploy.yml`).
- **No Netlify settings changes** (env vars, build hooks, custom domains, redirects). The portal build is the only Netlify-side artifact.
- **No backend services** added unless the user explicitly requested it.
- **No unlicensed assets.** If the source repo includes assets without `ASSETS.md`, halt and report.
- **No secrets** in code, manifests, registry, or commit messages.
- **No skipped validation.** If validation fails, [halt per AGENTS.md §7](../AGENTS.md).
- **No static-files-only deploys.** A game is not connected until its portal manifest exists, the registry includes it, the deploy preview homepage lists it, and `/games/<slug>/` returns 200.
- **No live slug changes** for already-shipped games unless the user explicitly requested it. A slug change is a redirect-and-archive operation, not a simple rename.
- **No high-risk file changes** during normal game deploys ([AGENTS.md §8](../AGENTS.md)).

## 4. Halt protocol

On any non-zero command, validation failure, missing output, schema failure, or unclear deployment state — stop, write `reports/<UTC-timestamp>-<slug>.md`, and surface the failure with the recommended next action. Do not continue.

## 5. Final report (every run, success or failure)

```
Command:        /gamedeploy
Game title:     <title>
Game slug:      <slug>
Game source:    <source-repo-url>
Portal branch:  <branch>
Portal PR:      <pr-url>
Expected URL:   https://speedrungames.net/games/<slug>/

Build result:        pass | fail (<exit-code>)
Test result:         pass | fail | skipped (<reason>)
Validation result:   pass | fail (<failing-checks>)
Deploy preview:      <netlify-preview-url> | n/a
Production deploy:   pending | live | n/a

Files changed (in portal):
  apps/web/public/games/<slug>/...
  apps/web/src/lib/games.registry.json

Assets / licensing summary:
  <one line per significant asset bucket; "no assets" if none>

Known limitations:
  <bullets>

Next recommended upgrade:
  <one concrete next action>
```

## 6. Why this exists

The portal is a Netlify-deployed Next.js shell. New games must (a) provide their own source repo, (b) ship a clean static `dist/`, (c) carry provenance the portal can verify, and (d) live behind a sandboxed iframe. This command orchestrates all four so an agent can ship a game in one prompt without leaking ownership of the portal architecture, secrets, or live-site state.

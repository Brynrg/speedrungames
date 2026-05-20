# AGENT.md — build and launch a speedrungames.net game

You are an autonomous agent building or updating a browser game for **speedrungames.net**. Follow the canonical portal workflow in this repo. Do not use the old per-game Netlify proxy flow.

## Canonical Architecture

- **One source repo per game.** Build the game in its own GitHub repo.
- **Static output is ingested into this portal.** The game repo builds `dist/`; this portal copies it to `apps/web/public/games/<slug>/`.
- **Every live game has a portal manifest.** `apps/web/public/games/<slug>/manifest.json` is the source of truth for catalog visibility, leaderboard slug validation, provenance, and status.
- **The homepage and API read the generated manifest registry.** `scripts/build-registry.mjs` emits `apps/web/src/lib/games.registry.json`; the app imports that registry directly.
- **Netlify deploys this portal repo.** A merged portal PR makes the game live at `https://speedrungames.net/games/<slug>/`.

## Required Workflow

1. Read [AGENTS.md](./AGENTS.md), [commands/gamedeploy.md](./commands/gamedeploy.md), and [docs/browser-game-template-contract.md](./docs/browser-game-template-contract.md).
2. Pick a lowercase kebab-case slug, max 24 chars, not already present under `apps/web/public/games/`.
3. Create or update the dedicated game source repo. The source repo must include:
   - `game.manifest.json`
   - `package.json`
   - `npm run build`
   - `npm run test`
   - `dist/index.html` after build
   - `ASSETS.md` when non-code assets exist
4. Build and test the game source repo:

   ```bash
   npm ci
   npm run test
   npm run build
   ```

5. In this portal repo, ingest the built game:

   ```bash
   node scripts/ingest-game-build.mjs --game-dir <path-to-game-repo> --status preview
   ```

6. Validate the portal:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run build:registry
   pnpm run validate:games
   pnpm -C apps/web build
   ```

7. Open a PR against `main`. Do not push directly to `main`. Do not merge your own PR unless the user explicitly asks and all checks pass.
8. After merge, verify production:

   ```bash
   curl -L https://speedrungames.net/ | grep "<Game Title>"
   curl -I https://speedrungames.net/games/<slug>/
   ```

## Connection Checklist

A game is correctly connected only when all of these are true:

- `apps/web/public/games/<slug>/index.html` exists.
- `apps/web/public/games/<slug>/manifest.json` exists and validates.
- `pnpm run build:registry` includes `<slug>` in `apps/web/src/lib/games.registry.json`.
- `pnpm run validate:games` passes.
- `pnpm -C apps/web build` passes.
- The deploy preview homepage lists the game title.
- The deploy preview URL `/games/<slug>/` returns HTTP 200.
- After merge, production homepage lists the game title and `/games/<slug>/` returns HTTP 200.

## Hard Rules

- Do not use `bin/new-game` for normal game launches. It belongs to an older per-game Netlify proxy experiment.
- Do not hand-edit `apps/web/src/lib/games.registry.json`; regenerate it with `pnpm run build:registry`.
- Do not treat copied static files alone as "live." The manifest and generated registry are required.
- Do not skip `npm run test`, `npm run build`, `pnpm run validate:games`, or `pnpm -C apps/web build`.
- Do not use unlicensed assets or external CDNs without a vendored fallback.
- Do not add backend services unless the user explicitly requested them and the multiplayer/backend plan is documented.

## Report Back

Return:

- Live URL: `https://speedrungames.net/games/<slug>/`
- Game source repo URL
- Portal PR URL
- Build/test/validation results
- Any manual step still required

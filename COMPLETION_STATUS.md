# Completion Status

> Status doc for AI agents working on this repo. Updated 2026-05-19.

**Score:** 75 / 100 — Feature-complete platform, missing tests
**State:** Production. Active development. Live at https://speedrungames.net
**Stack:** Next.js 15 / React 19 / pnpm workspaces / Netlify Blobs

## What works
- `/api/runs` leaderboard: deploy-preview isolation via `getDeployStore`, MAX_MS/runner/splits sanity caps, slug allowlist via `VALID_SLUGS`, reverse-timestamp keys to avoid read-modify-write races
- 4 games shipped: pokemonspeedrungen1, tower-wars, tower-wars-2, tank-you-again
- Auto-discovery pipeline: `discover-games.mjs`, `ensure-registry.mjs`, `generate-redirects.mjs`
- CI on push + PR (build + cache + concurrency)
- AGENT.md for AI-driven game additions

## Known gaps
- **Zero tests.** `/api/runs` validation/clamp logic is exactly the kind of code that silently regresses
- `apps/web/public/games/tower-wars/game.js` is a 141 KB **manual copy** of the standalone `Brynrg/tower-wars` repo — will drift
- Two registry files exist (`games.data.json` + `games.registry.json`) — unclear which is authoritative
- Drop-in games (tower-wars, tank-you-again) don't use `speedrungames-sdk` — they ship their own timer/storage and can't submit to the leaderboard
- Pokémon page absorbed `pokemon-voice-speedrun` repo (now archived) — umbrella is canonical

## Priority improvements
1. **Add Vitest covering `/api/runs`** — POST validation branches (MAX_MS clamp, slug allowlist, runner length, splits cap) + GET filtering
2. **Resolve tower-wars duplication** — submodule, build-time fetch by release tag, or pin via npm-style version
3. **Document the discovery flow** in `AGENTS.md` — which of `games.data.json` / `games.registry.json` is the source of truth
4. **Migrate drop-in games to consume `speedrungames-sdk`** so they post to the leaderboard

## Notes for AI agents
- **Canonical source for Pokémon speedrun**: this repo (`apps/web/src/app/pokemonspeedrungen1/`). The old `pokemon-voice-speedrun` repo is archived.
- **Canonical source for Tower Wars game logic**: the standalone `Brynrg/tower-wars` repo. The copy here is a manual drop — do not edit `apps/web/public/games/tower-wars/game.js` directly; fix in the source repo and re-drop.
- **Related repos**: `speedrungames-sdk` (shared runtime), `speedrungames-game-template` (scaffold for new games)

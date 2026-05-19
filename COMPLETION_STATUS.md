# Completion Status

> Status doc for AI agents. Updated 2026-05-19. Refines the in-repo `COMPLETION_STATUS.md` with corrections after reading every source file.

**Score:** 72 / 100
**State:** Production. Live at https://speedrungames.net. Two parallel game-deployment models codified in-repo; only one of them is canonical. No automated tests anywhere.
**Last commit:** 2026-05-19 (`4f7a12b` Sync tower-wars-2)
**Stack:** Next.js 16.1.6 / React 19 / pnpm 10.30.0 workspaces / Netlify Blobs / Node 22

## Architecture
- **Umbrella portal:** Next.js shell in `apps/web/` that owns the home grid, leaderboard backend, and serves games under `/games/<slug>/` (static drops) and `/pokemonspeedrungen1` (workspace package).
- **Canonical deployment model (per AGENTS.md):** each game has its own source repo; its built `dist/` is ingested into `apps/web/public/games/<slug>/` by `scripts/ingest-game-build.mjs`, which writes a portal manifest and regenerates `apps/web/src/lib/games.registry.json`.
- **Legacy/alternative model (per AGENT.md, unused by any shipped game):** per-game Netlify sites + topic-based GitHub auto-discovery + Netlify reverse-proxy redirects, scaffolded by `bin/new-game` and `apps/web/scripts/discover-games.mjs`.
- **Leaderboard:** `/api/runs` (Next.js Route Handler) backed by Netlify Blobs with reverse-timestamp keys; deploy previews use `getDeployStore` to isolate test writes from production.
- **CI:** `.github/workflows/validate-and-build.yml` runs build-registry → validate-games → next build on every PR + push to main.

## What works (verified by reading code)
- **Ingest pipeline** — `scripts/ingest-game-build.mjs` validates source manifest, captures git SHA, computes deterministic sha256 over `dist/` (length-prefixed path+content stream, skips OS metadata), guards target-path traversal, scans for broken `/assets/` and `localhost` substrings before copying, then chains `build-registry.mjs` + `validate-games.mjs`.
- **Manifest validator** — `scripts/_lib/manifest-validation.mjs` hand-rolled (intentionally no AJV dep). Validates portal + source manifests with regexes for slug, sha256, git SHA, playUrl, ISO datetime. Enforces `multiplayerProvider` required when `multiplayer ∈ {p2p, realtime-server, async}`.
- **Registry build** — `scripts/build-registry.mjs` scans `apps/web/public/games/*/manifest.json`, enforces directory-name = `manifest.slug`, rejects duplicates with exit 3, sorts by status priority (live, preview, draft, archived, broken) then title, no-op writes when content matches.
- **Validation passes** — `scripts/validate-games.mjs` aggregates failures: schema, manifest/registry sync, missing index.html for live/preview, archived without redirectTo, broken-path substring scan (with 4 MB cap), undocumented assets warning.
- **Leaderboard API** — `apps/web/src/app/api/runs/route.ts:43-167` — POST validates `VALID_SLUGS` set, clamps `ms ∈ (0, 86_400_000]`, slices runner to 32 chars, sanitizes splits with per-item label/ms checks and cap of 100, uses reverse-13-digit timestamp keys to avoid read-modify-write races on concurrent writes, returns 503 on storage failure.
- **Recent runs UI** — `apps/web/src/components/RecentRuns.tsx` — client component fetches `/api/runs?limit=10`, joins on `games` map for title/href, gracefully hides on empty.
- **Auto-discovery (legacy flow)** — `apps/web/scripts/discover-games.mjs` queries GitHub search for `topic:speedrungames user:Brynrg`, fetches each repo's `speedrungames.json`, tolerates network failure, supports `SRG_DISCOVER=off` env to disable, supports `GITHUB_TOKEN` for higher rate limits.
- **Redirects generator** — `apps/web/scripts/generate-redirects.mjs` writes `apps/web/public/_redirects` from games with `proxyTo`; emits a 301 normalization line + a `200!` force-proxy line per game.
- **Postinstall guard** — `apps/web/scripts/ensure-registry.mjs` seeds `games.generated.json` from `games.data.json` if missing so typecheck/dev work pre-prebuild.
- **Netlify deploy-preview isolation** — `leaderboardStore()` switches to `getDeployStore` when `process.env.CONTEXT` is `deploy-preview` or `branch-deploy`.
- **Multiplayer policy doc + validator hook** — `docs/multiplayer-architecture.md` defines 5 free-tier patterns (local, WebRTC P2P, PartyKit, Cloudflare DO, Netlify Blobs async); validator + schema enforce `multiplayerProvider` presence.
- **Bootstrap script** — `bin/new-game` (legacy flow): creates repo from template, sets topic, optionally creates Netlify site, populates manifest+slug+title, pushes, fires build hook or opens fallback PR. Idempotent on re-run.

## Known gaps
- **Zero automated tests.** No `vitest.config.*`, no `*.test.ts`, no Playwright at the portal level. `/api/runs` clamp/validation logic, ingest hash determinism, manifest validator, and discovery merge are all silently regressable.
- **Two game-registration models coexist.** AGENTS.md declares the ingest flow canonical and explicitly demotes AGENT.md/`bin/new-game`/`apps/web/scripts/discover-games.mjs` to "historical/alternative." Both are wired into the codebase: `apps/web/package.json` still runs `discover-games.mjs` + `generate-redirects.mjs` in `prebuild`, and `apps/web/src/lib/games.ts` reads `games.generated.json` (legacy) — **not** `games.registry.json` (canonical). The home grid is rendered from the legacy file.
- **`/api/runs` slug allowlist points at the wrong registry.** `route.ts:15` imports from `@/lib/games` which loads `games.generated.json`. Games registered via the canonical ingest path (with manifest only) are absent from `VALID_SLUGS` and will receive HTTP 400 from POST.
- **`apps/web/public/games/tower-wars/game.js` is a 141 KB manual copy** of the standalone `Brynrg/tower-wars` repo with no provenance link in the portal manifest (`sourceCommit` is the in-repo merge commit `35f1074`, not the upstream SHA). Source/portal will drift.
- **Tower-wars index.html still says `<title>Green Circle TD</title>`** and links Google Fonts via external CDN (`fonts.googleapis.com`) — violates the "No external CDNs without a vendored fallback" rule in `docs/browser-game-template-contract.md` §5.
- **Tower-wars-2 index.html uses root-absolute paths** (`src="/games/tower-wars-2/assets/..."`). This matches the deployed base but means the file can't be smoke-tested standalone, and `validate-games.mjs` would flag `src="/assets'` but does NOT flag `src="/games/...` — so the validator is silent on this case. Worth confirming intent.
- **Tower-wars-2 also pulls 20+ Google Fonts families** from `fonts.googleapis.com` in a single stylesheet — same external-CDN concern.
- **Three games (tower-wars, tower-wars-2, tank-you-again) don't consume `speedrungames-sdk`.** They ship their own timer/storage and cannot POST to `/api/runs`. SDK adoption is a portfolio-wide priority called out in the SDK repo's COMPLETION_STATUS.md.
- **Pokémon game is at `/pokemonspeedrungen1`, not `/games/pokemonspeedrungen1/`.** Its portal manifest is `status: archived` with `redirectTo: /pokemonspeedrungen1` documenting the URL mismatch. Migration would unify routing.
- **`pokemonspeedrungen1` workspace package has no build step.** It exports `src/index.ts` directly and relies on `next.config.ts#transpilePackages` — fine for Next, but means typecheck doesn't run against it in isolation.
- **No lockfile referenced for `games/pokemonspeedrungen1/`** — has its own `package-lock.json` but root uses pnpm-lock.yaml. Source of subtle install-time confusion if anyone runs `npm install` in the subpackage.
- **`reports/` directory tracked but empty** — `.gitkeep` only. AGENTS.md §7 + §12 require writing reports on validation failure, but no enforcement that agents actually do this.
- **`AGENT.md` (legacy doc) is still discoverable** by agents that don't read AGENTS.md first. It tells them to use `bin/new-game`, edit `games.data.json`, and rely on `discover-games.mjs` — exactly the flow AGENTS.md §2 calls non-canonical.

## Hot paths
- `apps/web/src/app/api/runs/route.ts` — leaderboard backend (GET/POST runs).
- `apps/web/src/lib/games.ts` — game registry consumed by the portal UI; currently reads the **legacy** `games.generated.json`.
- `apps/web/src/lib/games.registry.json` — canonical generated registry; **not consumed by the UI yet**.
- `scripts/ingest-game-build.mjs` — canonical "ship a game into the portal" entrypoint.
- `scripts/_lib/manifest-validation.mjs` — shared schema rules; intentionally dependency-free.
- `apps/web/scripts/discover-games.mjs` — legacy auto-discovery; runs on every prebuild whether you want it or not.
- `bin/new-game` — legacy bootstrap; opens fallback PRs against `games.data.json`.

## Notes for AI agents
- **Canonical doc:** `AGENTS.md`. **Read it before `AGENT.md`** — they describe different deployment models and AGENT.md is explicitly demoted to historical (see AGENTS.md §2 last paragraph).
- **Canonical game-add flow:** `/gamedeploy` slash command → `commands/gamedeploy.md` → `scripts/ingest-game-build.mjs`. **Not** `bin/new-game`.
- **Canonical registry:** `apps/web/src/lib/games.registry.json` (generated by `scripts/build-registry.mjs`). **Do not hand-edit.**
- **Legacy registry (still wired in):** `apps/web/src/lib/games.data.json` (hand-edited overrides) + `apps/web/src/lib/games.generated.json` (overrides ⊕ discovery, gitignored). Touch only if explicitly modifying the legacy flow.
- **Do not edit** `apps/web/public/_redirects` — auto-generated by `apps/web/scripts/generate-redirects.mjs`.
- **Do not edit** `apps/web/public/games/tower-wars/game.js` directly. Canonical source = `Brynrg/tower-wars`. Fix there and re-ingest (or set up a proper sync).
- **Canonical Pokémon speedrun source** = this repo's `games/pokemonspeedrungen1/` (the old `pokemon-voice-speedrun` repo is archived).
- **High-risk files** (per AGENTS.md §8, do not modify in normal `/gamedeploy` runs): `netlify.toml`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/**`, `AGENTS.md`, `commands/**`, `scripts/**`.
- **Always** PR-only — autonomy is at Level 2 per `docs/autonomy-and-deployment-levels.md`.
- **Related repos:** `Brynrg/speedrungames-sdk` (shared runtime — only the future template-spawned games use it today), `Brynrg/speedrungames-game-template` (template referenced by AGENT.md), `Brynrg/tower-wars` (canonical source for the tower-wars game.js copy), `Brynrg/app-tower-game` (upstream for tower-wars-2 per `games.registry.json#tower-wars-2.repo`), `Brynrg/Tank-you-again` (upstream for tank-you-again).

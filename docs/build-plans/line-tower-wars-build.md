# Build plan — Line Tower Wars (real build)

**Slug:** `line-tower-wars` · **Category:** tower-defense · **Goal:** replace the
empty-grid stub at `/games/line-tower-wars/` with a real Line Tower Wars game.

## Context (read first)

- Source repo `Brynrg/line-tower-wars` exists but its entire game is a **696-byte
  `main.js`** that draws a static grid — no towers, no creeps, no economy, no
  win/lose. It is a stub.
- Line Tower Wars (the WC3 custom map) is fundamentally: two players each defend a
  lane; you **build a maze of towers** to slow creeps, and you **spend gold to
  send creeps down the opponent's lane**; leaked creeps cost you lives/income.
  Last one standing wins.
- The working **`tower-wars`** repo **already implements the hard parts**: a maze
  TD with BFS pathing, an **income/send economy with a send queue and refunds**,
  and a **duel mode** with two lanes and per-player state
  (`syncLegacyEconomyFromActive`/`syncActiveToLegacyIfDuel` in `tower-wars/game.js`).
  LTW is essentially tower-wars' duel mode, reframed and balanced as LTW.

## Recommended approach: fork the tower-wars engine

1. **Create / reset the source repo** from the template, or work in the existing
   `line-tower-wars` repo — but replace the stub entirely:
   ```bash
   pnpm new:game --slug line-tower-wars --title "Line Tower Wars" \
     --framework vanilla --description "Build a maze, leak creeps to your opponent — standalone web LTW."
   ```
2. **Start from `tower-wars/game.js` duel mode**, not from scratch. Copy the engine
   and configure it for LTW semantics:
   - Two lanes, one per player (vs-AI is fine for v1 — no server needed; keep it
     **single-player vs bot** to stay within the no-paid-backend rule, AGENTS.md §9).
   - **Send mechanic is the core loop**: spending gold queues a creep onto the
     opponent's lane and raises your income. tower-wars' `queueSend`/`clearSendQueue`
     and per-player income ticks are the basis — surface them as the primary action.
   - **Maze building**: reuse tower-wars' maze mode (BFS distance map, build
     validation, re-path on placement). LTW mazes are the defensive skill.
   - Win/lose: a player loses when leaked creeps drain their lives; bot escalates sends.
3. **Reskin + rebalance** so it reads as LTW, not tower-wars: lane-vs-lane layout,
   send shop UI, income/leak HUD, simpler tower set tuned for mazing.
4. **Fix the known tower-wars bug while you're in there**: the maze false-leak at
   `tower-wars/game.js:1006–1014` (a transiently boxed creep is counted as a leak
   after a mid-wave re-path). Don't inherit it.

## Required to pass ingest (per the contract)

- `game.manifest.json`: `slug: "line-tower-wars"`, `framework: "vanilla"`,
  `supportsMobile` honest (tower-wars is desktop-only today — either add touch
  controls or set `false`).
- `npm run build` → `dist/index.html`, **relative** asset URLs.
- Playwright smoke test (loads under `/games/line-tower-wars/`, game-root element
  appears, no console errors in 3s).
- localStorage keys prefixed `speedrungames:line-tower-wars:` (use the SDK's
  `createStorage("line-tower-wars")`).

## Deploy + un-hide (final step)

1. Push `main` → reusable `deploy-game.yml` → auto-merging portal PR.
2. Once the real build lands and validates, set `"hidden": false` and
   `status: "live"` in `apps/web/public/games/line-tower-wars/manifest.json` and
   run `node scripts/build-registry.mjs` (or just re-ingest the real build).
3. Verify `https://speedrungames.net/games/line-tower-wars/` plays a full match.

## Halt protocol

On any failure, STOP and write `reports/<UTC>-line-tower-wars.md` per AGENTS.md §7.

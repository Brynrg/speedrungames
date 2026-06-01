# Build plan — Green Circle TD (web port)

**Slug:** `green-circle-td` · **Category:** tower-defense · **Goal:** replace the
empty-grid stub currently served at `/games/green-circle-td/` with a real,
playable web game that faithfully reproduces the existing Python desktop game.

## Context (read first)

- The live slot is a **696-byte placeholder** (`drawGrid()` only). It is NOT a game.
- The registry's `repo: Brynrg/Guardian` is **wrong** — that repo is 404, and the
  `Guardian/` dir that used to be in this hub was an unrelated macOS Swift app.
- The **real Green Circle TD** is a Python `arcade` desktop game preserved in this
  repo at [`tower-defense/`](../../tower-defense/) (~5,000 LOC). `arcade` uses
  pyglet/OpenGL and **cannot run in a browser** (Pyodide won't help), so this is a
  **logic port to TypeScript**, not a wrapper.
- Good news: the game's content is **fully data-driven JSON** —
  `tower-defense/data/{towers,enemies,waves,hero,upgrades}.json` and
  `tower-defense/dist/cards.json`. Reuse these verbatim; only the engine is rewritten.
- The mechanics (armor matrix, aura towers, branching upgrades, hero, cards) are
  the **same family** already implemented in the working **`tower-wars`** repo's
  vanilla-JS engine. Build on that rather than from scratch.

## Source of truth for behavior

Port semantics from these Python files (do NOT guess — match them):

- `tower-defense/core/sim.py` (1,882 LOC) — the deterministic simulation: tick
  order, spawn timing, targeting, damage application, gold/lives economy.
- `tower-defense/core/armor.py` — armor-vs-damage-type matrix (the headline feature).
- `tower-defense/core/tower.py`, `aura.py`, `hero.py`, `enemy.py`, `bullet.py`,
  `status.py` — entity behavior and status effects (burn/slow/etc).
- `tower-defense/core/rng.py` — seeded RNG; reproduce it exactly so runs are
  deterministic (needed for leaderboard integrity later).
- `tower-defense/core/card.py` + `dist/cards.json` — the between-wave card draft.

## Recommended approach

1. **Create the source repo** (do not reuse `Guardian`):
   ```bash
   pnpm new:game --slug green-circle-td --title "Green Circle TD" \
     --framework vanilla --description "Tower defense with an armor matrix, aura towers, and branching upgrades."
   ```
   (Or `--framework vite` if you want a bundler. `nextjs`/`vite`/`vanilla` are all
   valid now — the framework enum was fixed in #32.)
2. **Lift the tower-wars engine** as the starting point: copy `tower-wars/game.js`
   structure (game loop, canvas camera, tower/enemy/projectile pools, armor matrix,
   status effects, economy, save/PB). It already implements most of GCTD's feature
   set. Keep deterministic sim separate from rendering (tower-wars mostly does).
3. **Swap in GCTD's data**: load `towers.json/enemies.json/waves.json/hero.json/
   upgrades.json/cards.json` (copy them into the new repo's `src/data/` or `public/`).
   Map each Python field to the engine's tower/enemy/wave structs. This is where
   most of the fidelity work is — match `core/data.py` loaders and `sim.py` usage.
4. **Port the distinctive systems** tower-wars lacks: the **hero** unit
   (`core/hero.py`), the **card draft** between waves (`core/card.py` + cards.json),
   and any aura/upgrade rules in `sim.py` that differ. Verify against the Python.
5. **Parity check**: run `tower-defense/` locally (`python launch_game.py`) and the
   web build side by side. Same seed → same wave composition, same kills, same
   economy. Add a couple of deterministic unit tests around the sim (mirror
   `tower-defense/test_simple.py`).

## Required to pass ingest (per the contract)

- `game.manifest.json` with `slug: "green-circle-td"`, `framework: "vanilla"`
  (or `vite`), `supportsMobile` set honestly. Do **not** reuse the stale Python
  manifest's `framework: "python-arcade"` — that value is not allowed.
- `npm run build` → `dist/index.html` with **relative** asset URLs (Vite: `base:"./"`).
- Playwright smoke test: loads `dist/` under `/games/green-circle-td/`, asserts a
  `canvas`/`#game`/`[data-game-root]` appears and **no console errors** in 3s.
  If `supportsMobile:true`, also test at 375×667.
- `ASSETS.md` for any art/audio, with licensing (the Python game's palette is
  code-generated; keep it that way to stay license-clean — AGENTS.md §9).

## Deploy + un-hide (final step)

1. Push to the new repo's `main`; its `deploy.yml` calls the portal's reusable
   `deploy-game.yml`, which ingests and opens an auto-merging portal PR.
2. After the real build lands and validates, **flip visibility**: in
   `apps/web/public/games/green-circle-td/manifest.json` set `"hidden": false`
   (and `status` to `live`), then `node scripts/build-registry.mjs`. This is done
   automatically if you re-ingest with the real build; otherwise it's a one-line
   portal PR.
3. Verify `https://speedrungames.net/games/green-circle-td/` actually plays.

## Halt protocol

On any failure, STOP and write `reports/<UTC>-green-circle-td.md` per AGENTS.md §7.
Do not leave a half-ported build labeled `live`.

# Build plan — Pokémon Speedrun Gen 1 (fix to playable)

**Slug:** `pokemonspeedrungen1` · **Repo:** `Brynrg/pokemon-voice-speedrun` ·
**Framework:** Next.js static export · **Goal:** make the game actually playable —
it is code-complete (~90%) but every sprite 404s.

## Context (read first)

The game logic is sound — `start → run → end` state machine, ms timer, Web Speech
voice provider with tap fallback, all 151 canonical names correct (Mr. Mime,
Farfetch'd, Nidoran♀/♂ handled), silhouette mode. Two defects make it unplayable:

1. **Assets missing.** `public/assets/gen1/` contains only `.gitkeep` — the 151
   `001.png … 151.png` are absent. Verified live: `…/assets/gen1/001.png` → **404**.
2. **Asset path bug.** Even once the PNGs exist they will 404 under the portal
   subpath. `getGen1ImageSrc` returns `/assets/gen1/NNN.png` (`src/preload.ts:4`,
   used at `src/app/page.tsx:~599`). Next.js `basePath` does **NOT** rewrite raw
   `<img src>` strings, so the request goes to `/assets/...` instead of
   `/games/pokemonspeedrungen1/assets/...`.

## Task 1 — Fix the asset path (code; do this regardless of art source)

- In `next.config.ts`, expose the base path:
  `env: { NEXT_PUBLIC_BASE_PATH: "/games/pokemonspeedrungen1" }` (keep the existing
  `basePath`/`assetPrefix`/`output:"export"`/`images.unoptimized`).
- Change `getGen1ImageSrc` (`src/preload.ts`) to prefix:
  `` `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets/gen1/${n}.png` ``.
- Audit for any other raw `/assets`, `/icons`, `/...` string in `src/` and apply
  the same prefix (or migrate to `next/image`/`next/link`, which DO honor basePath).
- **Verify in the exported output**, not just dev: `npm run build` then grep
  `out/` for `src="/assets` — there should be none; all should be
  `/games/pokemonspeedrungen1/assets/...`.

## Task 2 — Source the 151 sprites (this is the part to decide deliberately)

The portal contract (`AGENTS.md` §9, contract §5) **forbids unlicensed assets**, and
official Pokémon sprites are Nintendo/Game Freak IP. Pick ONE, document it in
`ASSETS.md`, and keep the repo license-clean:

- **Option A — generated placeholder art (recommended, license-clean).** The game
  already has a **silhouette mode** (`src/silhouette.ts`). Generate 151 simple,
  original placeholder shapes/numbers (or distinct procedural blobs) as
  `001.png…151.png`. The game stays fully playable and ships nothing infringing.
  Replace with better original art later.
- **Option B — an openly-licensed sprite set.** If a genuinely CC0/open sprite
  pack exists, vendor it and record the license per-asset in `ASSETS.md`. Do not
  assume PokeAPI/serebii sprites are open — they are not.
- **Option C — runtime CDN (NOT recommended).** Contract §5 forbids external CDNs
  without a vendored fallback, and this still uses the IP. Avoid.

> Whichever you choose, place files at `public/assets/gen1/001.png … 151.png`
> (zero-padded to 3 digits) and add `ASSETS.md` with source + license per the
> contract. Update the README — delete the stale local
> `~/Documents/.../public/assets/gen1/` instruction.

## Task 3 — Hardening (P1, while you're here)

- **Silhouette guard** (`src/silhouette.ts:~21`): `getImageData` throws on a 0×0 /
  failed image. Skip/abort when `img.naturalWidth === 0`; make `preloadImage`
  reject (or flag) on `onerror` so a missing sprite shows a clear "missing" tile
  instead of a black square.
- **Mobile voice**: feature-detect `webkitSpeechRecognition`; iOS Safari is
  unreliable, so show a capability note and lean on the tap fallback. Optionally a
  one-time `getUserMedia({audio:true})` warm-up before `recognition.start()` for a
  clearer permission prompt.

## Task 4 — Nice-to-have (P2)

- Add **PB persistence** (none today) via the SDK: `createStorage("pokemonspeedrungen1")`
  → best time per mode, shown on Start/End screens.
- Emit completion/score to the portal via the SDK in `finishRun` (`page.tsx:~198`).
- Broaden voice aliases (Farfetch'd → "far fetched/barfetched", Mr. Mime, accept
  bare "Nidoran" for the current gender).

## Verify + deploy

- Local: `npm run build`, serve `out/` under `/games/pokemonspeedrungen1/`, confirm
  sprites load (no 404s in the network panel) and a full 151 run completes.
- Deploy via the existing `deploy.yml` (already wired to the portal reusable
  workflow). The manifest can now legitimately declare `framework: "nextjs"`
  (added to the enum in #32) instead of the `"other"` workaround.
- Verify `https://speedrungames.net/games/pokemonspeedrungen1/` shows art and runs.

## Halt protocol

On any failure, STOP and write `reports/<UTC>-pokemonspeedrungen1.md` per AGENTS.md §7.

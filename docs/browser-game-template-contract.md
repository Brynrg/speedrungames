# Browser game template contract

What a **game source repo** must provide so that `scripts/ingest-game-build.mjs` can ingest it into the portal at `apps/web/public/games/<slug>/`.

Game source repos are independent of this portal. They live wherever you want on GitHub. The portal does not depend on a specific template — only on the contract below being met.

## 1. Required files

- `AGENTS.md` — tells future agents how to work on this game.
- `README.md` — human-readable description, controls, how to run locally.
- `package.json` — see required commands below.
- `game.manifest.json` — see schema at `schemas/game-source-manifest.schema.json` in this portal repo. Required fields: `slug`, `title`, `description`, `framework`. Recommended: `category`, `supportsMobile`, `version`, `emoji`, `entry`, `buildCommand`.
- `vite.config.ts` (if using Vite) — see required configuration below.
- `src/` — source code.
- `public/` (if assets are large or you want Vite to copy them unprocessed).
- `tests/` — at minimum one Playwright smoke test (see below).
- `ASSETS.md` — required only when any non-code assets are present. One row per asset (or asset bucket) with source, license, and attribution.

## 2. Required commands

```bash
npm ci             # installs lockfile-locked deps
npm run test       # smoke test must pass
npm run build      # produces dist/index.html and assets
```

The portal's ingest step calls `npm run build` indirectly — by reading `dist/` after you've built it. The ingest script does NOT install or build your game; that's the game repo's job (locally or in its own CI).

## 3. Required Vite configuration

**Asset URLs in the built `index.html` must be relative, never root-absolute.** Root-absolute URLs (`/assets/foo.js`) break when the portal serves the game under `/games/<slug>/`.

**Canonical pattern — `base: "./"` (recommended).** This is what `speedrungames-game-template` ships. Relative asset URLs resolve correctly under any mount point, so the build is slug-decoupled and needs no env wiring:

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
});
```

**Alternative — slug-absolute base.** Also valid if you prefer absolute URLs (e.g. for apps with deep client-side routing). Derive the slug from `game.manifest.json` so it stays in sync:

```ts
import manifest from "./game.manifest.json" with { type: "json" };
const slug = process.env.GAME_SLUG || manifest.slug;
export default defineConfig({ base: `/games/${slug}/` });
```

Either approach passes ingest; the only hard rule is **no root-absolute asset paths**. `scripts/validate-games.mjs` and the Playwright smoke test (§4) catch violations.

> **Non-Vite builds (e.g. Next.js static export):** the same rule applies. Set `basePath`/`assetPrefix` to `/games/<slug>` and remember that raw `<img src="/...">` strings are NOT rewritten by Next's `basePath` — prefix them yourself (use `next/image`/`next/link`, or read `process.env.NEXT_PUBLIC_BASE_PATH`).

## 4. Required smoke test (Playwright)

At minimum, one Playwright test that:

1. Builds the game (`npm run build`).
2. Serves the resulting `dist/` under a nested path (e.g. `http://localhost:<port>/games/<slug>/`). The `vite preview` server with `--base /games/<slug>/` is a convenient way.
3. Loads the page in headless Chromium.
4. Asserts **no console errors** during the first 3 seconds of load.
5. Asserts a game-root element appears within 3 seconds — one of `canvas`, `#game`, or `[data-game-root]`.
6. If `supportsMobile: true`, also runs the same checks at a 375×667 viewport (iPhone SE portrait).

The portal's `/gamedeploy` flow calls this test. If the test isn't green, ingest is blocked.

## 5. Required game constraints

- **Fully static by default.** No backend, no API calls, no auth, no analytics — unless the operator explicitly requested it.
- **No external CDNs without a vendored fallback.** Self-host fonts, libraries, sounds.
- **No unlicensed assets.** Every asset must be either authored by you, public domain, or under a license listed in `ASSETS.md`.
- **localStorage keys must be prefixed `speedrungames:<slug>:`** to avoid cross-game collisions inside the portal's iframe context. This matches `speedrungames-sdk`'s `createStorage(slug)` (see `src/storage.ts`); use the SDK rather than hand-rolling keys.
- **Must run inside a sandboxed iframe.** Specifically: must not require parent DOM access, `window.parent`, or escape from the sandbox attributes the portal applies (`allow-scripts allow-same-origin allow-pointer-lock allow-gamepad`).
- **Must not assume the user can navigate up.** No `window.top.location = ...` etc.

## 6. Recommended starter stack

- **Vite** — fastest path to a clean static `dist/`. Required for the `base` rule above.
- **TypeScript** — catches the most common slug/path/manifest typos at compile time.
- **Phaser** or **PixiJS** — for canvas/WebGL games. The framework field in your manifest reflects which one (`vite-phaser`, `vite-pixi`).
- **Keep deterministic game logic separate from rendering** where practical. Easier to add replay/leaderboard later if game state is reproducible from a seed.

## 7. Multiplayer (optional)

If the game is multiplayer, declare it in `game.manifest.json`:

```json
{
  "multiplayer": "p2p",
  "multiplayerProvider": "webrtc",
  "multiplayerEndpoint": "https://your-deployed-server.example/optional"
}
```

`multiplayer` is one of:
- `"none"` (default — omit the field)
- `"local"` — couch co-op, no network. `multiplayerProvider` should be `null` or omitted.
- `"p2p"` — WebRTC peer-to-peer with portal-side signaling. `multiplayerProvider: "webrtc"`.
- `"realtime-server"` — WebSocket via a hosted server. `multiplayerProvider: "partykit"` or `"cloudflare-do"`.
- `"async"` — turn-based or polled state via Netlify Blobs. `multiplayerProvider: "netlify-blobs"`.

When `multiplayer` is `p2p`, `realtime-server`, or `async`, `multiplayerProvider` is **required**. The portal validator enforces this.

Pattern-specific game source requirements are documented in [docs/multiplayer-architecture.md](./multiplayer-architecture.md). Common ones:

- **All patterns:** No user accounts, no auth, no PII. Use room codes / pairing handshakes for matchmaking.
- **Pattern C (PartyKit):** Add `party/index.ts` server module, `partykit.json` config, and a deploy step (`npx partykit deploy`).
- **Pattern D (Cloudflare Workers + DO):** Add `worker/index.ts`, `wrangler.toml`, and `npx wrangler deploy`.
- **Pattern E (Netlify Blobs):** Coordinate with portal-side route additions; flag in your PR.

## 8. What the portal will do with your build

When `scripts/ingest-game-build.mjs --game-dir <your-repo>` runs:

1. Reads `game.manifest.json`.
2. Captures the git SHA of your repo's HEAD.
3. Computes a deterministic sha256 over `dist/`.
4. Copies `dist/` into `apps/web/public/games/<slug>/` in this portal repo.
5. Writes `apps/web/public/games/<slug>/manifest.json` with all the provenance fields.
6. Regenerates `apps/web/src/lib/games.registry.json`.
7. The portal app reads `games.registry.json` directly, so a valid manifest plus regenerated registry is what makes the game appear on the homepage and become an accepted leaderboard slug.
8. Runs the portal validator.
9. Opens a PR against portal `main`.

Your game's source repo is **not** touched by the portal. The ingest step is one-directional.

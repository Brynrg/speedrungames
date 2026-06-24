# speedrungames.net → Cloudflare — Migration Prep

Branch: `cloudflare-migration`. **Nothing here touches production until the DNS cutover.**
Same playbook as the Solo Stack pilot: Next.js → Cloudflare via the **OpenNext adapter**, verified
on a `*.workers.dev` preview before any DNS change.

## What this site is
- A **pnpm monorepo**; the portal is a **Next.js 16 App Router** app at **`apps/web`**
  (currently Netlify, `@netlify/plugin-nextjs`, Node 22, pnpm 10.30).
- Build is not a plain `next build`: a **prebuild pipeline** discovers games + generates redirects
  (`../../scripts/build-registry.mjs`, `apps/web/scripts/{ensure-registry,discover-games,generate-redirects}.mjs`).
- No database / affiliate tracking (unlike solo-stack) — **no D1 binding needed.**

## Scaffolded in this branch (preview-only, no DNS)
- `apps/web/wrangler.jsonc` — Workers config: `.open-next/worker.js`, `nodejs_compat` +
  `global_fetch_strictly_public`, `ASSETS` binding, account `f14fbd517a2319f53d206d16b640bbce`,
  observability. No D1.
- `apps/web/open-next.config.ts` — minimal `defineCloudflareConfig` (default cache; add R2 ISR later).
- `apps/web/package.json` — `cf:preview` / `cf:deploy` scripts that run the **prebuild pipeline first**
  (`pnpm run prebuild`) so games are discovered + redirects generated before the OpenNext build —
  OpenNext invokes `next build` directly and would otherwise skip the npm `prebuild` hook.

## BLOCKER — RESOLVED 2026-06-23
`@opennextjs/cloudflare@1.19.x` peer-required **`next: >=15.5.18 <16 || >=16.2.6`**; the app was on
**next@16.1.6** (the unsupported gap). **Fixed:** bumped `apps/web` to **next@16.2.9** (forward, within
Next 16) — `next build` compiles clean (Turbopack, ~1.4s, no code changes), and `opennextjs-cloudflare
build` produces `.open-next/worker.js` without issue.
(The `@cloudflare/next-on-pages` adapter caps at Next 15.5.2 — not an option. OpenNext is the path.)

## Live preview (no DNS) — VERIFIED 2026-06-23
Deployed via authed wrangler to **https://speedrungames-web.brynrgarnett.workers.dev** (worker
`speedrungames-web`, account `f14fbd…`). HTTP/asset sweep:
- Portal `/` → 200, lists all games. 404 handling works.
- All 6 live games + 4 shard-dominion variants (`/games/<slug>/`) → **200**.
- Game assets (JS/CSS/WebGL bundles, pokémon sprites) → 200, correct MIME types.
- No hardcoded netlify/fly/localhost URLs in any page → games use relative paths, host-portable.
- `/api/runs` (leaderboard) → see below.

## Leaderboard — ported to Cloudflare KV 2026-06-23
`apps/web/src/app/api/runs/route.ts` previously used **`@netlify/blobs`** (Netlify-only). Replaced with
**Cloudflare KV** via `getCloudflareContext().env.RUNS_KV` (KV's lexicographic key order preserves the
reverse-timestamp "newest-first" scheme). `@netlify/blobs` removed from deps. The KV namespace binding
`RUNS_KV` is in `apps/web/wrangler.jsonc`. (Single namespace for now; bind a separate one per environment
when production is set up.) Route keeps its graceful fallback (GET→`[]`, POST→503) if the binding is absent.

## Safe-first sequence
1. Bump `apps/web` next 16.1.6 → 16.2.6+; verify `pnpm -C apps/web build` passes + smoke the pages.
2. `pnpm -C apps/web add @opennextjs/cloudflare && pnpm -C apps/web add -D wrangler`.
3. `pnpm -C apps/web cf:preview` → fix any build issues → `cf:deploy` to a `*.workers.dev` preview.
4. **Verify on the preview:** portal renders, game pages load, generated redirects work, static game
   assets serve. Port `@netlify/blobs` → R2 if any feature needs it.
5. **DNS cutover only after the preview passes.** Add `speedrungames.net` to Cloudflare / flip the
   hostname to the Worker; keep Netlify 48h as instant rollback; then decommission.

**Needs a human:** the Cloudflare ↔ GitHub connect (push-deploys) and the DNS cutover.

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

## BLOCKER (the one thing to fix first)
`@opennextjs/cloudflare@1.19.x` peer-requires **`next: >=15.5.18 <16 || >=16.2.6`**.
This app is on **next@16.1.6** — in the **unsupported gap** (16.0–16.2.5).
→ **Bump `apps/web` to `next@16.2.6+`** (forward, within Next 16), verify `pnpm -C apps/web build`
still passes + smoke the portal, THEN install `@opennextjs/cloudflare` + `wrangler` and run `cf:preview`.
(The `@cloudflare/next-on-pages` adapter caps at Next 15.5.2 — not an option. OpenNext is the path.)

## Second consideration (runtime, not build)
`apps/web` depends on **`@netlify/blobs`** — a Netlify-only runtime store. Any feature that reads/writes
Blobs at runtime will fail on Cloudflare. Before production: replace it with **R2** (or **KV** for small
hot data). For the first preview, the static portal + game pages + redirects are what must work; Blob-backed
features can be ported next.

## Safe-first sequence
1. Bump `apps/web` next 16.1.6 → 16.2.6+; verify `pnpm -C apps/web build` passes + smoke the pages.
2. `pnpm -C apps/web add @opennextjs/cloudflare && pnpm -C apps/web add -D wrangler`.
3. `pnpm -C apps/web cf:preview` → fix any build issues → `cf:deploy` to a `*.workers.dev` preview.
4. **Verify on the preview:** portal renders, game pages load, generated redirects work, static game
   assets serve. Port `@netlify/blobs` → R2 if any feature needs it.
5. **DNS cutover only after the preview passes.** Add `speedrungames.net` to Cloudflare / flip the
   hostname to the Worker; keep Netlify 48h as instant rollback; then decommission.

**Needs a human:** the Cloudflare ↔ GitHub connect (push-deploys) and the DNS cutover.

# AGENTS.md — adding a game to speedrungames.net

You are adding a new game to **speedrungames.net**. The site is a Next.js shell hosted on Netlify; each game lives in its **own** GitHub repo and ships from its **own** Netlify site. The umbrella site (this repo) just proxies the URL.

After initial wiring, every `git push` to the game repo's `main` updates the live game on speedrungames.net automatically — **zero commits to this repo required for iteration.**

## TL;DR

1. Create the game repo from the template:
   ```bash
   gh repo create Brynrg/game-<slug> --public \
     --template Brynrg/speedrungames-game-template --clone
   ```
2. Build the game in that repo. Push to `main`.
3. Connect the repo to Netlify (one-time, manual): netlify.com → Add new site → Import from GitHub → pick the repo → Deploy. The included `netlify.toml` handles config.
4. Note the resulting URL, e.g. `https://game-<slug>.netlify.app`.
5. In **this repo**, add **one entry** to `apps/web/src/lib/games.data.json`:
   ```json
   {
     "slug": "<slug>",
     "title": "<Game Title>",
     "description": "<one-liner>",
     "href": "/games/<slug>/",
     "emoji": "🎮",
     "proxyTo": "https://game-<slug>.netlify.app"
   }
   ```
6. PR → merge → live at `speedrungames.net/games/<slug>/`.

That's it. No new route file. No nav edit. No `_redirects` edit. The build script + auto-nav + home grid all derive from that single entry.

## The proxy model (read before iterating)

- `apps/web/scripts/generate-redirects.mjs` runs in `prebuild`. It reads `games.data.json` and writes `apps/web/public/_redirects` with one rule per game that has `proxyTo`:
  ```
  /games/<slug>/*    https://game-<slug>.netlify.app/:splat    200!
  ```
- The `200!` (force) means the proxy wins even over a Next route at the same path. Netlify proxies the request transparently — the player's URL bar stays at `speedrungames.net`.
- The game itself **must** use relative asset paths (`./assets/foo.png`, not `/assets/foo.png`) — see the template's `AGENTS.md` for the per-tool config.

## Hard rules

1. **`slug` is permanent.** It's baked into the live URL and the proxy target. Choose carefully (lowercase, kebab-case, URL-safe).
2. **Repo name must equal `game-<slug>`** unless you also override `proxyTo` to point at the actual Netlify subdomain (which is usually `<repo-name>.netlify.app`).
3. **`href` for proxied games must end in `/`** (`/games/<slug>/`). The proxy splat doesn't match the bare path; the generator emits a 301 to handle it, but linking with the slash skips the redirect.
4. **Never hand-edit `apps/web/public/_redirects`.** It is generated. Edit `games.data.json` and re-run `pnpm -C apps/web build` (or the dev server).
5. **Don't change the `prebuild` script or `netlify.toml` build command** without explicit approval — Netlify deploys depend on them.
6. **Don't add Next routes for proxied games.** The proxy at `/games/<slug>/*` covers everything; a Next route is dead code.

## Legacy games (in-monorepo pattern)

The original three games (`tower-wars`, `tower-wars-2`, `pokemonspeedrungen1`) still live in this repo and use either an iframe-from-`public/games/` (Pattern A) or a workspace package (Pattern B). They have **no `proxyTo`** so the redirect generator skips them. Leave them alone unless explicitly migrating.

To migrate one: extract its source to `Brynrg/game-<slug>`, follow steps 1–6 above, then delete the old Next route file and `apps/web/public/games/<slug>/` directory.

## Verifying locally

```bash
pnpm install
pnpm -C apps/web dev
```

Visit `http://localhost:3000` — the new game appears in the grid and nav. The proxy rule itself only works on a deployed Netlify build (the dev server doesn't run Netlify redirects).

To preview the live proxy behavior, push to a PR — Netlify deploy previews include `_redirects` and will proxy the new game from the preview URL.

## Pre-flight checklist

- [ ] Game repo created from `Brynrg/speedrungames-game-template`
- [ ] Game uses relative asset paths
- [ ] Game's Netlify site deployed successfully (status: Published)
- [ ] Game URL loads in a browser standalone
- [ ] Entry added to `apps/web/src/lib/games.data.json` with correct `slug`, `href` (trailing slash), `proxyTo`
- [ ] `pnpm -C apps/web build` passes locally
- [ ] PR opened; deploy preview loads the new game at `/games/<slug>/`

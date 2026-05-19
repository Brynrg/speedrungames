# AGENTS.md — adding a game to speedrungames.net

**For autonomous agents: read [AGENT.md](AGENT.md) instead.** That file is a self-contained system prompt.

This file is the manual-mode reference. Each game has its own GitHub repo + its own Netlify site. The umbrella proxies them. After initial wiring, `git push` to the game's `main` updates the live game on speedrungames.net.

## TL;DR — the bootstrap script does it all

```bash
./bin/new-game \
  --slug=<slug> \
  --title="<Game Title>" \
  --description="<one-liner>" \
  --emoji=🎮
```

This creates the game repo from the template, tags it, creates the Netlify site (if `NETLIFY_AUTH_TOKEN` is set), adds the entry to `apps/web/src/lib/games.data.json` on a new branch, and opens a PR. The new game repo is cloned to `./tmp/game-<slug>/` for you to start coding in.

Set up the Netlify token once at `app.netlify.com` → User settings → Applications → Personal access tokens, then `export NETLIFY_AUTH_TOKEN=...` in your shell. Without it, the script prints a one-click deploy URL you click manually.

## Manual path (if you can't use the bootstrap)

1. Create the game repo:
   ```bash
   gh repo create Brynrg/game-<slug> --public \
     --template Brynrg/speedrungames-game-template --clone
   ```
2. Tag it: `gh api -X PUT repos/Brynrg/game-<slug>/topics --input -` with body `{"names":["speedrungames"]}`.
3. Build the game (see the template's `AGENTS.md`).
4. Connect the repo to Netlify (web UI: app.netlify.com → Import → pick repo → Deploy).
5. Add one entry to `apps/web/src/lib/games.data.json`:
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

## The proxy model

`apps/web/scripts/generate-redirects.mjs` runs in `prebuild`. It reads `games.data.json` and writes `apps/web/public/_redirects` with one rule per game that has `proxyTo`:

```
/games/<slug>/*    https://game-<slug>.netlify.app/:splat    200!
```

The `200!` (force) means the proxy wins even over a Next route at the same path. Netlify proxies the request transparently — the player's URL bar stays at `speedrungames.net`.

## Iteration

To change an existing proxied game, you do **not** touch this repo. Clone the game's own repo, change it, push:

```bash
gh repo clone Brynrg/game-<slug>
cd game-<slug>
# ... changes ...
git push origin main
```

The game's own Netlify site redeploys. The umbrella has nothing to do.

## Hard rules

1. **`slug` is permanent.** Baked into the live URL and proxy target.
2. **Repo name must equal `game-<slug>`** unless you override `proxyTo` to point at the actual Netlify subdomain.
3. **`href` for proxied games ends in `/`** (`/games/<slug>/`). The proxy splat doesn't match the bare path; the generator emits a 301 to handle it, but linking with the slash skips the redirect.
4. **Never hand-edit `apps/web/public/_redirects`.** It is generated. Edit `games.data.json` and re-run `pnpm -C apps/web build`.
5. **Don't change the `prebuild` script or `netlify.toml` build command** without explicit approval — Netlify deploys depend on them.
6. **Don't add Next routes for proxied games.** The proxy at `/games/<slug>/*` covers everything; a Next route is dead code.

## Legacy games

The original three (`tower-wars`, `tower-wars-2`, `pokemonspeedrungen1`) live in this repo with no `proxyTo` and use the older in-monorepo pattern (iframe-from-`public/games/` or workspace package). The redirect generator skips them; their routes still work.

To migrate one: extract its source to `Brynrg/game-<slug>`, run the bootstrap with the same slug (after deleting the old `games.data.json` entry), and delete the old Next route file + `apps/web/public/games/<slug>/` directory.

## Verifying locally

```bash
pnpm install
pnpm -C apps/web dev
```

Visit `http://localhost:3000` — the new game appears in the grid and nav. The proxy rule itself only works on a deployed Netlify build (the dev server doesn't apply Netlify redirects). To see proxy behavior, push to a PR and use the Netlify deploy preview.

## Pre-flight checklist

- [ ] Bootstrap ran successfully (or manual steps completed)
- [ ] Game's Netlify site is Published and loads standalone
- [ ] CI green in the game repo
- [ ] Speedrungames PR opened and ready to merge
- [ ] After merge: `speedrungames.net/games/<slug>/` loads the game

## See also

- [AGENT.md](AGENT.md) — self-contained system prompt for autonomous agents
- [Brynrg/speedrungames-game-template](https://github.com/Brynrg/speedrungames-game-template) — the game-side template + its own AGENTS.md

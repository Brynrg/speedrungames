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

This creates the game repo from the template, tags it, creates the Netlify site (if `NETLIFY_AUTH_TOKEN` is set), populates the new repo's manifest + slug + title and pushes, then fires the umbrella build hook (if `NETLIFY_UMBRELLA_BUILD_HOOK` is set) so auto-discovery picks the game up — no umbrella PR required.

Set up the two env vars once and the workflow is fully autonomous:

```bash
# In your shell rc:
export NETLIFY_AUTH_TOKEN=...            # for creating Netlify sites
export NETLIFY_UMBRELLA_BUILD_HOOK=...   # for triggering umbrella rebuilds
```

`NETLIFY_AUTH_TOKEN`: app.netlify.com → User settings → Applications → Personal access tokens.

`NETLIFY_UMBRELLA_BUILD_HOOK`: Netlify dashboard → speedrungames site → Site configuration → Build & deploy → Build hooks → "Add build hook".

Without `NETLIFY_AUTH_TOKEN`: the bootstrap prints a one-click Netlify deploy URL you click manually.
Without `NETLIFY_UMBRELLA_BUILD_HOOK`: the bootstrap opens a fallback PR that adds the game to `games.data.json` (manual override).

## How registration works

The umbrella's prebuild runs three scripts in order:

1. **`ensure-registry.mjs`** — postinstall guard, seeds `games.generated.json` from `games.data.json` if missing.
2. **`discover-games.mjs`** — queries GitHub for repos in `Brynrg` with the `speedrungames` topic, fetches each repo's `speedrungames.json`, and merges them with `games.data.json` (overrides win on slug conflict). Writes `games.generated.json`.
3. **`generate-redirects.mjs`** — reads the merged registry and writes `apps/web/public/_redirects` with one proxy rule per game that has `proxyTo`.

`games.ts` reads from `games.generated.json` (gitignored). Nav, home grid, and Netlify proxy rules all derive from it.

## Manual path (if you can't use the bootstrap)

1. `gh repo create Brynrg/game-<slug> --public --template Brynrg/speedrungames-game-template --clone`
2. Tag it: `gh api -X PUT repos/Brynrg/game-<slug>/topics --input -` with body `{"names":["speedrungames"]}`.
3. Edit `speedrungames.json` in the new repo to fill in slug, title, description, emoji, deployUrl.
4. Build the game (see the template's `AGENTS.md`).
5. Connect the repo to Netlify (web UI: app.netlify.com → Import → pick repo → Deploy).
6. (Optional) Trigger the umbrella to rebuild — or wait for its next deploy. Auto-discovery handles registration.

If auto-discovery isn't an option (e.g. private repo), add an explicit override to `apps/web/src/lib/games.data.json` and open a PR.

## Iteration

To change an existing proxied game, you do **not** touch this repo. Clone the game's own repo, change it, push:

```bash
gh repo clone Brynrg/game-<slug>
cd game-<slug>
# ... changes ...
git push origin main
```

The game's own Netlify site redeploys. The umbrella has nothing to do.

## Leaderboard

The umbrella exposes `/api/runs` (POST + GET) backed by Netlify Blobs. Games using the SDK's `submitRun({ slug, ms, splits })` post automatically on finish. The home page surfaces recent runs across all games.

To test the API locally, use `netlify dev` instead of `pnpm dev` — `next dev` doesn't have blob access.

## Hard rules

1. **`slug` is permanent.** Baked into the live URL and proxy target.
2. **Repo name must equal `game-<slug>`** unless `speedrungames.json`'s `deployUrl` is set to the actual Netlify subdomain.
3. **`href` for proxied games ends in `/`** (handled by the generator).
4. **Never hand-edit `apps/web/public/_redirects` or `apps/web/src/lib/games.generated.json`.** Both auto-generated.
5. **Don't change the `prebuild` script or `netlify.toml` build command** without explicit approval.
6. **Don't add Next routes for proxied games.** The proxy at `/games/<slug>/*` covers everything.

## Legacy games

The original three (`tower-wars`, `tower-wars-2`, `pokemonspeedrungen1`) live in this repo's `apps/web/public/games/` (Pattern A, iframe) or `games/` (Pattern B, workspace package). They're explicitly listed in `games.data.json` with no `proxyTo`. The discovery + redirect scripts skip them; their existing Next routes still work.

To migrate one: create a new game repo via bootstrap with the same slug (after removing the legacy entry from `games.data.json`), then delete the old Next route file + `apps/web/public/games/<slug>/` directory.

## Verifying locally

```bash
pnpm install
pnpm -C apps/web dev
```

Visit `http://localhost:3000` — the grid + nav render from the discovered set. Proxy rules and the leaderboard endpoint only work in deployed builds (use `netlify dev` for both).

## See also

- [AGENT.md](AGENT.md) — self-contained system prompt for autonomous agents
- [Brynrg/speedrungames-game-template](https://github.com/Brynrg/speedrungames-game-template) — game-side template + its own AGENTS.md
- [Brynrg/speedrungames-sdk](https://github.com/Brynrg/speedrungames-sdk) — shared runtime (timer, storage, HUD, leaderboard client)

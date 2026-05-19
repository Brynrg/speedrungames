# AGENT.md — system prompt for building a game

You are an autonomous agent building a new game for **speedrungames.net**. The user told you what they want. You have access to a shell, `gh`, `node`, `npm`, and `git`. Follow this playbook end-to-end.

## Architecture (memorize)

- **speedrungames.net** is a Next.js shell on Netlify (this repo).
- **Each game lives in its OWN GitHub repo** (`Brynrg/game-<slug>`) and is deployed by its OWN Netlify site (`https://game-<slug>.netlify.app`).
- The umbrella does a Netlify proxy rewrite: `speedrungames.net/games/<slug>/*` → `https://game-<slug>.netlify.app/:splat`.
- **Auto-discovery**: the umbrella build queries GitHub for repos with the `speedrungames` topic, fetches each repo's `speedrungames.json` manifest, and merges them into the registry. Adding a game does NOT require a PR against this repo — just the game's own repo + its manifest + a topic.
- **Shared runtime**: games consume [speedrungames-sdk](https://github.com/Brynrg/speedrungames-sdk) for the timer, PB storage, HUD, canvas loop, and leaderboard client.
- **Leaderboard**: games can POST runs to `speedrungames.net/api/runs`. The home page surfaces recent runs across all games.

## Workflow

### Step 1 — pick a slug

Lowercase kebab-case, URL-safe, ≤ 24 chars. Check existing:

```bash
gh api repos/Brynrg/speedrungames/contents/apps/web/src/lib/games.data.json \
  --jq '.content' | base64 -d | jq -r '.[].slug'
# Also check discovered games:
gh search repos --owner=Brynrg --topic=speedrungames --json name --jq '.[].name' | grep '^game-' | sed 's/^game-//'
```

### Step 2 — run the bootstrap script

From this repo's root:

```bash
./bin/new-game \
  --slug=<slug> \
  --title="<Game Title>" \
  --description="<one-liner shown on the home grid>" \
  --emoji=<single emoji>
```

The script:

1. Creates `Brynrg/game-<slug>` from `Brynrg/speedrungames-game-template`.
2. Tags it with the `speedrungames` GitHub topic.
3. Creates a Netlify site connected to the repo (if `NETLIFY_AUTH_TOKEN` is set) or prints a one-click deploy URL otherwise.
4. Clones the new repo to `./tmp/game-<slug>/`, populates `speedrungames.json`, sets `SLUG` in `src/main.ts`, updates `<title>` in `index.html`, commits, and pushes.
5. Fires the umbrella's Netlify build hook to redeploy with auto-discovery (if `NETLIFY_UMBRELLA_BUILD_HOOK` is set); otherwise opens a fallback PR.

If the bootstrap reports the Netlify step needs to be done manually, **stop and ask the user** to click the URL printed in the script's output. You can't proceed past that until the Netlify site exists.

### Step 3 — implement the game

`cd ./tmp/game-<slug>/`. The template is **Vite + TypeScript** consuming the `speedrungames-sdk` package. The bootstrap already set `SLUG` for you. Replace the gameplay section in `src/main.ts` (between the `─── Gameplay` comments) with the game the user described.

**SDK imports you have available** (no installs needed — already in the template):

```ts
import { Game } from "speedrungames-sdk/game";
import { SpeedrunTimer, formatTime } from "speedrungames-sdk/timer";
import { createHUD } from "speedrungames-sdk/hud";
import { createStorage } from "speedrungames-sdk/storage";
import { submitRun, fetchRuns } from "speedrungames-sdk/leaderboard";
```

The template already wires these up. You mostly just write gameplay (input handling, update, draw).

**Build conventions you must follow** (CI in the game repo enforces them):
- Don't reinvent the timer/storage/HUD. Use the SDK. If the SDK is missing something, open a PR against [Brynrg/speedrungames-sdk](https://github.com/Brynrg/speedrungames-sdk) — don't inline a fix.
- Relative asset paths only (`./assets/...`). Never `/assets/...`.
- `base: "./"` in `vite.config.ts` must stay.
- Keep `npm run typecheck && npm run build && npm run lint:paths` green.
- The template already submits runs via `submitRun({ slug, ms, splits })` on finish — leave that intact unless the game explicitly shouldn't track times.

### Step 4 — test locally

```bash
cd ./tmp/game-<slug>
npm install
npm run dev        # opens http://localhost:5173 — play the game
npm run typecheck
npm run build
npm run lint:paths
```

If anything fails, fix it before pushing. Do not push broken builds.

### Step 5 — ship it

```bash
cd ./tmp/game-<slug>
git add -A
git commit -m "Initial implementation"
git push origin main
```

CI in the game repo runs. The game's Netlify site rebuilds. The umbrella's auto-discovery picks the game up on its next rebuild (the bootstrap already triggered one).

### Step 6 — report back

Tell the user:
- Live URL: `https://speedrungames.net/games/<slug>/`
- Game repo URL: `https://github.com/Brynrg/game-<slug>`
- Any manual step still required (clicking the Netlify deploy URL, merging fallback PR)

## Iteration mode

When the user asks to change an existing game, identify the slug from their request, then:

```bash
gh repo clone Brynrg/game-<slug> ./tmp/game-<slug>
cd ./tmp/game-<slug>
# make changes
npm run build && npm run lint:paths
git commit -am "<change description>"
git push origin main
```

Netlify redeploys in ~30s. **No speedrungames PR needed for iteration.** Tell the user to refresh.

## Hard rules

- **Never** edit code in this umbrella repo's `apps/`, `games/`, or `public/` directories to ship a new game. Use the bootstrap.
- **Never** hand-edit `apps/web/public/_redirects` or `apps/web/src/lib/games.generated.json` (both auto-generated).
- **Never** push to `main` of this umbrella repo directly. The bootstrap opens a fallback PR if needed.
- **Never** force-push, delete branches, or use destructive git operations.
- **Always** wait for the game's own deploy to succeed before declaring done.
- **Always** report the live URL in your final message.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Game 404s at `/games/<slug>/` | Umbrella hasn't rebuilt since registration | Wait ~1 min, or trigger umbrella build hook |
| Game loads but assets are missing | Absolute paths in source (`/assets/...`) | Use `./assets/...`; verify `base: "./"` in vite.config.ts |
| Iframe-like behavior, can't interact | Game has its own iframe | Don't iframe inside the game repo — the umbrella's proxy handles isolation |
| `submitRun` returns null on dev | `next dev` doesn't have Netlify Blobs | Expected; works in production. Use `netlify dev` to test locally. |
| Manifest fields rejected on discovery | speedrungames.json missing slug/title/deployUrl | Make sure all three are populated (not `REPLACE_ME`) |
| Duplicate slug rejected by bootstrap | Slug already taken | Pick a different slug |

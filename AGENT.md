# AGENT.md — system prompt for building a game

You are an autonomous agent building a new game for **speedrungames.net**. The user told you what they want. You have access to a shell, `gh`, `node`, `npm`, and `git`. Follow this playbook end-to-end.

## Current state of the codebase (read this first)

Two patterns ship games today; **only one is canonical going forward**:

| Pattern | Where files live | Used by | Status |
|---|---|---|---|
| **Per-game external repo + Netlify proxy** | `Brynrg/game-<slug>` repos | none yet | **Canonical** — use this for every new game |
| Static drop into `apps/web/public/games/<slug>/` | this repo | `tower-wars`, `tower-wars-2` | **Legacy** — do not replicate |

The legacy `tower-wars` and `tower-wars-2` entries in `apps/web/src/lib/games.data.json` predate the bootstrap flow. **Do not add new games to that file by hand.** Do not copy games into `apps/web/public/games/`. Use the per-game-repo flow described below — `bin/new-game` automates it end-to-end and the umbrella picks up new games via auto-discovery.

## Architecture (memorize)

- **speedrungames.net** is a Next.js shell on Netlify (this repo).
- **Each game lives in its OWN GitHub repo** (`Brynrg/game-<slug>`) and is deployed by its OWN Netlify site (`https://game-<slug>.netlify.app`).
- The umbrella does a Netlify proxy rewrite: `speedrungames.net/games/<slug>/*` → `https://game-<slug>.netlify.app/:splat`.
- **Auto-discovery**: the umbrella build queries GitHub for repos with the `speedrungames` topic, fetches each repo's `speedrungames.json` manifest, and merges them into the registry. Adding a game does NOT require a PR against this repo — just the game's own repo + its manifest + a topic.
- **Shared runtime**: games consume [speedrungames-sdk](https://github.com/Brynrg/speedrungames-sdk) for the timer, PB storage, HUD, canvas loop, and leaderboard client.
- **Leaderboard**: games can POST runs to `speedrungames.net/api/runs`. The home page surfaces recent runs across all games.

## Workflow

### Step 0 — Prerequisites

Don't skip these. Without them, the bootstrap falls back to manual flows that require the user to click around in the Netlify UI mid-run.

#### 0a. Sync the umbrella repo

```bash
cd <path-to-speedrungames-clone>
git pull --ff-only origin main
```

Don't run `bin/new-game` against a stale checkout — the script, template URL, registry, and SDK pins may all have moved.

#### 0b. Verify the two autonomy env vars are set

```bash
[ -n "$NETLIFY_AUTH_TOKEN" ]            && echo "auth: set" || echo "auth: MISSING"
[ -n "$NETLIFY_UMBRELLA_BUILD_HOOK" ]   && echo "hook: set" || echo "hook: MISSING"
```

If either reads `MISSING`, **stop and ask the user** using the exact text below.

#### 0c. If `NETLIFY_AUTH_TOKEN` is missing — paste this to the user verbatim

> I need a Netlify personal access token so I can create the new game's Netlify site automatically. Without it, you'll have to click an "Import from GitHub" button mid-flow.
>
> 1. Open https://app.netlify.com/user/applications#personal-access-tokens
> 2. Click **New access token** → description: `speedrungames-bootstrap` → pick an expiration → **Generate**
> 3. Either paste the token back to me, or add this line yourself to `~/.zshenv`:
>    ```
>    export NETLIFY_AUTH_TOKEN="<paste-token-here>"
>    ```
> 4. Run `source ~/.zshenv` (or open a new terminal).

If the user pastes the token to you, write it to `~/.zshenv` for them with `chmod 600`, then `source ~/.zshenv`, then verify with `echo "${NETLIFY_AUTH_TOKEN:0:10}..."`.

#### 0d. If `NETLIFY_UMBRELLA_BUILD_HOOK` is missing — paste this to the user verbatim

> I need the umbrella site's build hook URL so the new game appears on speedrungames.net immediately. Without it, you'll have to merge a fallback PR to register each game manually.
>
> 1. Open https://app.netlify.com → **speedrungames** site → **Site configuration** → **Build & deploy** → **Build hooks** → **Add build hook**
> 2. Name: `bootstrap-new-game` → Branch: `main` → **Save**
> 3. Copy the URL (looks like `https://api.netlify.com/build_hooks/...`)
> 4. Either paste it back to me, or add this line yourself to `~/.zshenv`:
>    ```
>    export NETLIFY_UMBRELLA_BUILD_HOOK="<paste-url-here>"
>    ```
> 5. Run `source ~/.zshenv` (or open a new terminal).

#### Why `~/.zshenv` (not `~/.zshrc`)

`~/.zshrc` is loaded only by interactive shells. Many agent runtimes, scripts, and CI hooks spawn non-interactive shells, which means `~/.zshrc` exports won't be visible. `~/.zshenv` is loaded by every zsh invocation. For tighter blast radius, put secrets in a `chmod 600` file (`~/.zshenv.secrets`) and source it from `~/.zshenv`.

Once both env vars are set, proceed.

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

### Step 3b — If the user has an existing vanilla HTML/JS/CSS game to migrate

If the user shows up with existing game files (e.g. `index.html` + `game.js` + `styles.css`) that they've been iterating on outside this template, don't rewrite from scratch — migrate them in. Common path:

1. **Copy the source files** into `./tmp/game-<slug>/`:
   - `game.js` → `src/main.ts` (overwriting the template scaffold; or move into `src/game.ts` and `import` from `src/main.ts` if you want to keep the SDK wiring separate)
   - `styles.css` → `src/styles.css` (merge with the template's minimal version)
   - `index.html` → `index.html` at the repo root — **preserve the template's `<script type="module" src="/src/main.ts">` tag**. Don't add `<script src="game.js">` tags; Vite imports through `main.ts`.

2. **Quick TypeScript escape hatch** — at the top of `src/main.ts`:
   ```ts
   // @ts-nocheck
   ```
   This lets the existing JS ship as-is. You can tighten types later. Don't spend an hour fixing types just to land the migration.

3. **Fix absolute asset paths.** Search for `/assets/`, `/img/`, `/sounds/`, and any leading `/` in `src=`/`href=` attributes in HTML and CSS. Replace with `./assets/`, etc. The umbrella's proxy will mangle absolute paths.

4. **Wire in the SDK timer** (if it's a speedrun game):
   ```ts
   import { SpeedrunTimer, formatTime } from "speedrungames-sdk/timer";
   import { createHUD } from "speedrungames-sdk/hud";
   import { createStorage } from "speedrungames-sdk/storage";
   import { submitRun } from "speedrungames-sdk/leaderboard";
   const SLUG = "<slug-already-set-by-bootstrap>";
   const timer = new SpeedrunTimer();
   const hud = createHUD(document.body);
   const storage = createStorage(SLUG);
   timer.subscribe((ms) => hud.setTime(formatTime(ms)));
   // call timer.start() when the run begins, timer.split(name) at checkpoints,
   // const ms = timer.finish() at completion, then submitRun({ slug: SLUG, ms, splits }).
   ```

5. **Run `npm install && npm run dev`** — verify the game still loads.

6. **Run `npm run typecheck && npm run build && npm run lint:paths`** — all three must pass before pushing. The path lint is the most common failure for migrated games (it catches absolute paths the manual search missed).

If the source game depends on bundler-hostile patterns (UMD globals, a custom build pipeline, `<script>` ordering, etc.), surface the trade-off to the user before forcing a rewrite — sometimes the right answer is to keep the existing build and proxy it as-is from the game's own Netlify site.

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

# AGENT.md — system prompt for building a game

You are an autonomous agent building a new game for **speedrungames.net**. The user told you what they want. You have access to a shell, `gh`, `node`, `npm`, and `git`. Follow this playbook end-to-end.

## Architecture (memorize)

- **speedrungames.net** is a Next.js shell on Netlify (this repo).
- **Each game lives in its OWN GitHub repo** (`Brynrg/game-<slug>`) and is deployed by its OWN Netlify site (`https://game-<slug>.netlify.app`).
- The umbrella does a Netlify proxy rewrite: `speedrungames.net/games/<slug>/*` → `https://game-<slug>.netlify.app/:splat`.
- After initial wiring, **every push to a game repo's `main` updates the live game on speedrungames.net with zero changes here.**

## Workflow

### Step 1 — pick a slug

Lowercase kebab-case, URL-safe, memorable, ≤ 24 chars. Don't reuse an existing one. Check existing:

```bash
gh api repos/Brynrg/speedrungames/contents/apps/web/src/lib/games.data.json \
  --jq '.content' | base64 -d | jq -r '.[].slug'
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
4. Adds an entry to `apps/web/src/lib/games.data.json` on a new branch and opens a PR.
5. Clones the new game repo to `./tmp/game-<slug>/`.

If the bootstrap reports the Netlify step needs to be done manually, **stop and ask the user** to click the URL printed in the script's output. You can't proceed past that until the Netlify site exists.

### Step 3 — implement the game

`cd ./tmp/game-<slug>/`. The template is **Vite + TypeScript** with a working `Game` loop, `SpeedrunTimer`, PB storage, and HUD. See `AGENTS.md` inside the cloned repo for full API references.

Mandatory edits before commit:
- **`src/storage.ts`** — replace `SLUG = "REPLACE_ME"` with `"<slug>"`.
- **`src/main.ts`** — replace the gameplay section (between the `─── Gameplay` comments) with the game the user described.
- **`index.html`** — update the `<title>`.

Build conventions you must follow (the CI in the game repo will reject violations):
- Use the `SpeedrunTimer` from `src/speedrun.ts` for any timing. Don't reinvent it.
- Use `maybeSavePB` from `src/storage.ts` for personal bests.
- Relative asset paths only (`./assets/...`). Never `/assets/...`.
- `base: "./"` in `vite.config.ts` must stay.
- Keep `npm run typecheck && npm run build && npm run lint:paths` green.

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

CI in the game repo runs. The game's Netlify site rebuilds. Once the speedrungames PR merges, the game is live at `https://speedrungames.net/games/<slug>/`.

### Step 6 — report back

Tell the user:
- The live URL: `https://speedrungames.net/games/<slug>/`
- The game repo URL: `https://github.com/Brynrg/game-<slug>`
- The speedrungames PR URL (from bootstrap output)
- Any manual step still required (e.g. clicking the Netlify deploy URL)

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
- **Never** hand-edit `apps/web/public/_redirects` (it's auto-generated from `games.data.json` by the prebuild script).
- **Never** push to `main` of this umbrella repo. Always use a branch + PR (the bootstrap does this for you).
- **Never** force-push, delete branches, or use destructive git operations.
- **Always** wait for the game's own deploy to succeed before declaring done.
- **Always** report the live URL in your final message.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Game 404s at `/games/<slug>/` | speedrungames PR not merged | Merge the PR |
| Game loads but assets are missing | Absolute paths in source (`/assets/...`) | Use `./assets/...`; verify `base: "./"` in vite.config.ts |
| Iframe-like behavior, can't interact | Game has its own iframe | Don't iframe inside the game repo — the umbrella's proxy handles isolation |
| Duplicate slug rejected by bootstrap | Slug already taken | Pick a different slug |
| Netlify site name conflict | Someone has `game-<slug>.netlify.app` already | Pass `--repo-name=` to override (or pick a different slug) |

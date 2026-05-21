# Improvement Plan

> Executable backlog. Work top-to-bottom. Each task self-contained.

## P0 — Blockers / safety / data integrity

### Task 1: Fix `/api/runs` slug allowlist to include canonical-registry games
**Effort:** S (15min)
**Files:** `apps/web/src/app/api/runs/route.ts`, `apps/web/src/lib/games.ts`
**What:** `route.ts:15,43` imports `games` from `@/lib/games`, which reads `games.generated.json` (legacy overrides ⊕ topic discovery). Any game registered via the canonical ingest flow (which writes `games.registry.json` only) is absent from `VALID_SLUGS` and gets HTTP 400 on POST.
**Why:** Submitting runs is broken for every game added via the AGENTS.md-canonical flow. Silent for the 3 ingest-only games today; will break every new game tomorrow.
**Steps:**
1. Add a second JSON import in `apps/web/src/lib/games.ts`: `import registryData from "./games.registry.json"`.
2. Export `export const allSlugs: Set<string> = new Set([...games.map(g => g.slug), ...(registryData as Array<{ slug: string }>).map(e => e.slug)]);`.
3. In `route.ts`, replace `const VALID_SLUGS = new Set(games.map((g) => g.slug));` with `import { allSlugs as VALID_SLUGS } from "@/lib/games";`.
4. Verify the registry file already exists at build time (it does — `build-registry.mjs` runs in the CI workflow before `next build`).
**Acceptance:**
- [ ] `curl -X POST https://<deploy-preview>/api/runs -d '{"slug":"tank-you-again","ms":12345}'` returns 200 (currently 400).
- [ ] Existing legacy slugs (`pokemonspeedrungen1`, `tower-wars`, `tower-wars-2`) continue to return 200.
- [ ] `pnpm -C apps/web build` succeeds with both registries imported.

### Task 2: Reconcile the two registry models — make the UI read the canonical registry
**Effort:** M (1hr)
**Files:** `apps/web/src/lib/games.ts`, `apps/web/src/lib/games.registry.json`, `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/components/RecentRuns.tsx`
**What:** `games.ts:1` reads `games.generated.json` (legacy: hand overrides ⊕ topic discovery). AGENTS.md §2 declares `games.registry.json` (ingest-generated) canonical. Adapt the UI to the canonical registry shape (which uses `playUrl` not `href`, and has no `emoji`/`proxyTo`/`hidden`).
**Why:** The home grid and nav silently miss any ingest-only game until a human also adds an override to `games.data.json`. Two sources of truth = drift.
**Steps:**
1. Pick the canonical shape: extend `games.registry.json` entries with the UI-only fields (`emoji`, optional `hidden`) by adding them to `manifestToRegistryEntry()` in `scripts/build-registry.mjs` and to the portal manifest schema (`schemas/portal-game-manifest.schema.json` — add `emoji: { type: "string", maxLength: 8 }`).
2. Backfill the three live portal manifests with `emoji` values matching today's `games.data.json` (🛡️, 🏰, 🎙️). Add 🎯 or similar for tank-you-again.
3. Rewrite `games.ts` to read from `games.registry.json` and map `playUrl → href`. Filter out `status: archived` with `redirectTo` matching one of the live entries (for the Pokémon dual-listing case), or use a `hidden` field on the manifest.
4. Update `RecentRuns.tsx` `slugToHref` map source accordingly.
5. Re-run `pnpm run build:registry && pnpm -C apps/web build`.
**Acceptance:**
- [ ] Home grid renders identically to current production for the 3 currently visible games (Pokémon, tower-wars, tower-wars-2).
- [ ] `tank-you-again` now appears on the home grid (today only the legacy override list omits it).
- [ ] Removing an entry from `games.data.json` does NOT remove it from the home grid as long as its portal manifest still exists.
- [ ] No new pnpm package added.

### Task 3: Add Vitest coverage for `/api/runs` validation/clamp branches
**Effort:** M (1hr)
**Files:** new `apps/web/src/app/api/runs/route.test.ts`, `apps/web/package.json`, `apps/web/vitest.config.ts`
**What:** Cover every reject branch in POST and the limit clamp + slug filter in GET. Stub `@netlify/blobs` with an in-memory map.
**Why:** This is the only data-write endpoint and its silent regression risk is highest. The clamp constants (`MAX_MS=86_400_000`, `MAX_RUNNER_LEN=32`, `MAX_SPLITS=100`) have no test holding them.
**Steps:**
1. `pnpm -C apps/web add -D vitest @vitest/coverage-v8`.
2. Create `apps/web/vitest.config.ts` with `test.environment = "node"`.
3. Add `"test": "vitest run"` and `"test:watch": "vitest"` to `apps/web/package.json`.
4. Mock `@netlify/blobs` in the test file with `vi.mock`:
   ```ts
   const store = new Map<string, unknown>();
   vi.mock("@netlify/blobs", () => ({
     getStore: () => ({
       setJSON: async (k: string, v: unknown) => { store.set(k, v); },
       get: async (k: string) => store.get(k) ?? null,
       list: async () => ({ blobs: [...store.keys()].map(key => ({ key })) }),
     }),
     getDeployStore: () => ({ /* same impl */ }),
   }));
   ```
5. Write tests for: invalid JSON → 400; unknown slug → 400; `ms ≤ 0` → 400; `ms > MAX_MS` → 400; runner > 32 chars gets sliced; >100 splits gets capped; valid POST returns Run with `id`/`achievedAt`; GET with `limit=200` clamps to 100; GET with `game=` filters to matching slug.
6. Add to CI: in `.github/workflows/validate-and-build.yml` add step `- run: pnpm -C apps/web test` between `Validate games` and `Build portal`.
**Acceptance:**
- [ ] `pnpm -C apps/web test` runs 10+ test cases, all pass.
- [ ] Each clamp branch from §1-§5 above has at least one assertion.
- [ ] CI workflow includes the test step and fails if any test fails.

---

## P1 — High-value

### Task 4: Resolve `tower-wars` manual-copy drift — pin upstream via submodule or scripted sync
**Effort:** M (1hr)
**Files:** `apps/web/public/games/tower-wars/`, `apps/web/public/games/tower-wars/manifest.json`, new `scripts/sync-tower-wars.mjs` OR `.gitmodules`
**What:** `tower-wars/game.js` is a 141 KB drop from `Brynrg/tower-wars` with no automation. Replace with one of: (a) git submodule pinning the upstream commit, (b) a `sync-tower-wars.mjs` script that fetches a release-tagged tarball and copies into place + updates `sourceCommit`/`buildHash`, or (c) move tower-wars onto the standard ingest path by adding `game.manifest.json` + Vite config to the upstream repo and running `scripts/ingest-game-build.mjs`.
**Why:** Drift between the upstream source repo and the portal copy is invisible. AGENTS.md §2 requires `sourceCommit` to point at the source repo's git SHA; today it points at the in-portal merge commit (`35f1074`).
**Steps:**
1. Pick option (c) if upstream `Brynrg/tower-wars` can be modified — add `game.manifest.json` (slug=tower-wars, framework=vanilla, supportsMobile=false, version=1.0.0), commit, then run `node scripts/ingest-game-build.mjs --game-dir ../tower-wars --status live`.
2. Failing that, pick option (b): create `scripts/sync-tower-wars.mjs` that runs `gh api repos/Brynrg/tower-wars/commits/main --jq .sha`, downloads `https://api.github.com/repos/Brynrg/tower-wars/tarball/<sha>`, extracts into `apps/web/public/games/tower-wars/`, writes a portal manifest with the upstream sourceCommit, runs `build-registry.mjs`.
3. Add a step to CI on a weekly cron (separate `.github/workflows/sync-tower-wars.yml`) that runs the script and opens a PR on diff.
4. Update `apps/web/public/games/tower-wars/manifest.json#sourceCommit` to the actual upstream SHA.
**Acceptance:**
- [ ] `manifest.json#repo` points to `Brynrg/tower-wars` (currently `Brynrg/speedrungames` — wrong).
- [ ] `manifest.json#sourceCommit` is a real upstream SHA verified by `gh api repos/Brynrg/tower-wars/commits/<sha>`.
- [ ] A documented, repeatable way to re-sync exists (script or submodule update command).

### Task 5: Vendor or self-host Google Fonts referenced by tower-wars and tower-wars-2
**Effort:** M (1hr)
**Files:** `apps/web/public/games/tower-wars/index.html`, `apps/web/public/games/tower-wars-2/index.html`, possibly new `public/games/<slug>/fonts/` directories.
**What:** Both games load `fonts.googleapis.com` stylesheets. `docs/browser-game-template-contract.md` §5 forbids "external CDNs without a vendored fallback." Tower-wars-2 pulls 20+ font families in a single request.
**Why:** Privacy (Google reads every play), reliability (CDN outage breaks games), policy compliance, and page-load size. Tower-wars-2's font request alone is several hundred KB.
**Steps:**
1. For tower-wars (Cinzel + Rajdhani): download `.woff2` files, place under `apps/web/public/games/tower-wars/fonts/`, add `@font-face` rules to `styles.css`, remove the `<link>` tag in `index.html`.
2. For tower-wars-2: audit which fonts the bundle CSS actually references (grep `index-*.css` for `font-family`). Vendor only those. Likely 1-3 families, not 20.
3. Re-run `scripts/validate-games.mjs` — the broken-path scanner should still pass.
4. Update each game's portal `manifest.json#assetLicenseSummary` to note the SIL Open Font License for the vendored faces.
**Acceptance:**
- [ ] No `fonts.googleapis.com` or `fonts.gstatic.com` strings remain in `apps/web/public/games/tower-wars/**` or `apps/web/public/games/tower-wars-2/**`.
- [ ] Both games render correctly in production (visual check).

### Task 6: Update tower-wars `<title>` so it isn't "Green Circle TD"
**Effort:** S (15min)
**Files:** `apps/web/public/games/tower-wars/index.html`
**What:** `apps/web/public/games/tower-wars/index.html:5` reads `<title>Green Circle TD</title>` — leftover from upstream. The portal manifest title is "Tower Wars".
**Why:** Bookmark/share titles look wrong. Conflicts with the portal's branding.
**Steps:**
1. Change `<title>Green Circle TD</title>` to `<title>Tower Wars — speedrungames.net</title>`.
2. If addressing via the upstream sync from Task 4, fix it in the source repo.
**Acceptance:**
- [ ] Loading `/games/tower-wars/index.html` in a browser shows "Tower Wars — speedrungames.net" in the tab.

### Task 7: Demote or delete AGENT.md so agents don't follow the legacy flow — ✅ DONE (2026-05-21)
**Resolution:** AGENT.md was kept at the repo root for a while but its content drifted to match AGENTS.md (both described the canonical ingest flow), creating duplication rather than a legacy-flow problem. Deleted in the "polish-readme-and-deduplicate-agent-docs" PR. README.md rewritten to be the actual entry point, pointing at AGENTS.md as the canonical contract. Stale `AGENT.md` references removed from AGENTS.md §2 + §13 and from `docs/autonomy-and-deployment-levels.md`. Sub-item from step 4 (remove `discover-games.mjs` from `prebuild`) is still open — tracked as a separate task if it becomes annoying.

### Task 8: Add Vitest coverage for `scripts/_lib/manifest-validation.mjs`
**Effort:** M (1hr)
**Files:** new `scripts/_lib/manifest-validation.test.mjs`, root `package.json`
**What:** Validate the hand-rolled validator — slug regex, playUrl/slug consistency, multiplayerProvider-required rule, ISO datetime regex edge cases.
**Why:** The validator is the gate on every ingest. AGENTS.md §10 chose hand-rolled over AJV for dep-count reasons; trade-off was supposed to be paid in tests.
**Steps:**
1. `npm install -D vitest` at root (NOT inside `apps/web` — this is a node script test).
2. Add `"test:scripts": "vitest run scripts"` to root `package.json`.
3. Write tests covering: valid portal manifest passes; missing each REQUIRED_PORTAL_FIELDS → error; invalid slug shapes (uppercase, leading hyphen, 49 chars); playUrl/slug mismatch; sourceCommit wrong length / non-hex; buildHash wrong length; multiplayer=p2p without multiplayerProvider → error; multiplayer=local with provider → OK.
4. Wire into CI between `Validate games` and `Build portal`.
**Acceptance:**
- [ ] 15+ test cases, all pass.
- [ ] Mutating the validator (e.g. changing the slug regex to accept uppercase) causes at least one test to fail.
- [ ] CI step `npm run test:scripts` runs and is required for merge.

### Task 9: Add Vitest coverage for ingest-script hash determinism
**Effort:** M (1hr)
**Files:** new `scripts/ingest-game-build.test.mjs`, expose `computeBuildHash` from ingest module
**What:** The deterministic sha256 over `dist/` is the entire integrity story for game provenance. Test that (a) same input → same hash, (b) reordering on-disk doesn't change hash, (c) extra `.DS_Store` is ignored, (d) one-byte content change changes the hash.
**Why:** A subtle bug in `walk()` order or in the path-encoding logic would break reproducibility silently — there's no way to detect this without a test.
**Steps:**
1. Refactor `scripts/ingest-game-build.mjs` to export `computeBuildHash` (top-level function — currently it's defined inside the script). Move helpers to `scripts/_lib/build-hash.mjs`.
2. Update the script to `import { computeBuildHash } from "./_lib/build-hash.mjs"`.
3. Test: create temp dirs with the same files in different on-disk creation orders; assert identical hash. Add a `.DS_Store` to one; assert identical hash. Mutate one byte; assert hash differs.
4. Add `vi.test` cases under `scripts/_lib/build-hash.test.mjs`.
**Acceptance:**
- [ ] 4+ test cases covering the 4 properties above.
- [ ] Running `node scripts/ingest-game-build.mjs --game-dir ./tests/fixtures/known-hash --dry-run` outputs a hash matching a constant checked into the test file.

### Task 10: Add a CODEOWNERS file and enable branch protection on main
**Effort:** S (15min)
**Files:** new `.github/CODEOWNERS`, GitHub repo settings (not in-repo, but document)
**What:** AGENTS.md §9 + `docs/autonomy-and-deployment-levels.md` explicitly require Level 2 (PR-only, no direct push to main). Today nothing enforces this except agent compliance.
**Why:** A misbehaving agent or hot-fix push can land on `main` without CI passing. Branch protection + CODEOWNERS makes the policy machine-enforced.
**Steps:**
1. Create `.github/CODEOWNERS` with `* @Brynrg` (or appropriate team) + targeted `/scripts/ @Brynrg /AGENTS.md @Brynrg /commands/ @Brynrg /netlify.toml @Brynrg /package.json @Brynrg` to match the high-risk list in AGENTS.md §8.
2. Document in `docs/autonomy-and-deployment-levels.md` that branch protection must be enabled with: require PR, require status check `validate-and-build`, require code-owner review for paths in CODEOWNERS, disallow direct push.
3. Operator action (outside repo): toggle these settings in github.com → Settings → Branches.
**Acceptance:**
- [ ] `.github/CODEOWNERS` exists and matches AGENTS.md §8.
- [ ] Attempting `git push origin main` from a fresh clone (without merge) is rejected by GitHub.

---

## P2 — Quality / polish

### Task 11: Tighten broken-path scanner to also flag `src="/games/<other-slug>/`
**Effort:** S (15min)
**Files:** `scripts/validate-games.mjs`, `scripts/ingest-game-build.mjs`
**What:** The scanner today catches `src="/assets`, `src="/src/`, `localhost`, `127.0.0.1`. Tower-wars-2 ships with `src="/games/tower-wars-2/assets/..."` which is correct for its own deploy but means the same file shipped into a different slug would silently break. Add a "must contain `/games/<this-slug>/` not some other slug" guard.
**Why:** Prevents copy-paste mistakes during ingest where an old slug bakes into the build output.
**Steps:**
1. In `validate-games.mjs#scanForBrokenPaths`, after the existing needle loop, scan for `/games/<other>/` paths where `<other> !== this slug`. Flag as warning (not error — there are valid cross-slug refs imaginable).
2. Make the warning specific: `apps/web/public/games/tower-wars-2/index.html: contains '/games/some-other-slug/' — wrong slug baked into build?`
**Acceptance:**
- [ ] Introducing a test fixture with `/games/wrong-slug/` in a built `index.html` triggers a validator warning.
- [ ] Existing tower-wars-2 build (with `/games/tower-wars-2/`) does NOT trigger the warning.

### Task 12: Document which registry is canonical in AGENTS.md
**Effort:** S (15min)
**Files:** `AGENTS.md`
**What:** Today AGENTS.md §2 says "`apps/web/src/lib/games.registry.json` is **generated** from the per-game portal manifests" — but nowhere notes that `games.data.json` and `games.generated.json` from the legacy flow still exist and are still wired into `apps/web/package.json#prebuild`. Agents reading AGENTS.md alone will assume those files don't exist.
**Why:** Reduces the "wait, which JSON file matters?" question for every new agent.
**Steps:**
1. Add a subsection AGENTS.md §2 "Registry files":
   - `apps/web/src/lib/games.registry.json` — **canonical, generated by `scripts/build-registry.mjs`.**
   - `apps/web/src/lib/games.data.json` — **legacy, hand-edited overrides for the proxy flow. Not used by any shipped game; will be removed when the legacy flow is deleted.**
   - `apps/web/src/lib/games.generated.json` — **legacy, gitignored, generated by `apps/web/scripts/discover-games.mjs` from `games.data.json` ⊕ topic discovery.**
2. Reference Task 7 — these files go away when the legacy flow is deleted.
**Acceptance:**
- [ ] AGENTS.md §2 explicitly enumerates all three registry files and labels each.

### Task 13: Make `apps/web/scripts/discover-games.mjs` opt-in instead of opt-out
**Effort:** S (15min)
**Files:** `apps/web/package.json`
**What:** `discover-games.mjs` runs on every `dev` and `prebuild`. Network failure is tolerated, but the script still makes a GitHub API call per build. Without `GITHUB_TOKEN` the limit is 60 req/hr — multiple consecutive builds will hit the cap. Flip the default: skip discovery unless `SRG_DISCOVER=on` (or in CI).
**Why:** Reduce unnecessary network traffic. The legacy flow has no shipped games anyway, so discovery returning empty is the common case.
**Steps:**
1. In `apps/web/scripts/discover-games.mjs:98`, change `const offline = process.env.SRG_DISCOVER === "off"` to `const offline = process.env.SRG_DISCOVER !== "on"`.
2. Update the log line to match: `"discover-games: SRG_DISCOVER!=on — using overrides only."`.
3. If/when Task 7 lands, delete the script entirely.
**Acceptance:**
- [ ] `SRG_DISCOVER=on pnpm dev` triggers discovery; bare `pnpm dev` skips it.
- [ ] No GitHub API call from `pnpm dev` without the env var.

### Task 14: Add `eslint` check step to CI workflow
**Effort:** S (15min)
**Files:** `.github/workflows/validate-and-build.yml`
**What:** `apps/web/package.json#scripts.lint` defines `next lint`, but the CI workflow only runs build-registry → validate-games → build. Lint never runs.
**Why:** Catches style + simple-bug regressions before they hit `main`.
**Steps:**
1. Add a step `- run: pnpm -C apps/web lint` between `Validate games` and `Build portal`.
**Acceptance:**
- [ ] A deliberately introduced unused-variable in `apps/web/src/app/page.tsx` causes the CI run to fail.

### Task 15: Cache the registry-build/validate output to skip on no-op changes
**Effort:** M (1hr)
**Files:** `.github/workflows/validate-and-build.yml`
**What:** Currently `build-registry.mjs` runs on every build, including PRs touching only docs. `actions/cache` keyed on a hash of `apps/web/public/games/**/manifest.json` would skip the build when no manifests changed.
**Why:** Faster CI for doc-only PRs. Cost is small but adds up.
**Steps:**
1. Add an `actions/cache@v4` step keyed on `${{ hashFiles('apps/web/public/games/**/manifest.json') }}` storing `apps/web/src/lib/games.registry.json`.
2. Skip the `pnpm run build:registry` step if cache hit.
**Acceptance:**
- [ ] PR touching only `README.md` shows "cache hit" in the build-registry step.
- [ ] PR touching `apps/web/public/games/tower-wars/manifest.json` shows "cache miss" and regenerates.

---

## P3 — Nice-to-haves

### Task 16: Add an `/api/runs/[slug]` shortcut route
**Effort:** M (1hr)
**Files:** new `apps/web/src/app/api/runs/[slug]/route.ts`
**What:** Today the per-game leaderboard is `GET /api/runs?game=<slug>`. Adding a path-segment route makes for cleaner share URLs (`/api/runs/tower-wars?limit=20`).
**Why:** Lower-friction UI integration; better cacheability story per game.
**Steps:**
1. Refactor `listRuns` out of `route.ts` into `apps/web/src/lib/runs.ts`.
2. New file `apps/web/src/app/api/runs/[slug]/route.ts` re-exports a GET that calls `listRuns(limit, slug)` with slug from `params`.
3. Add a Vitest case for the new route.
**Acceptance:**
- [ ] `curl https://speedrungames.net/api/runs/tower-wars?limit=5` returns the same data as `?game=tower-wars&limit=5`.

### Task 17: Show per-game leaderboard on the game iframe wrapper page
**Effort:** M (1hr)
**Files:** `apps/web/src/app/games/tower-wars/page.tsx`, `apps/web/src/app/games/tower-wars-2/page.tsx`, new `apps/web/src/components/GameLeaderboard.tsx`
**What:** Today each `/games/<slug>` page is a bare iframe. No leaderboard, no link back. Add a slim sidebar/footer with the top-10 runs for that game.
**Why:** Drives engagement; gives Tower Wars / Tank You Again users a reason to care about the runtime even though those games don't submit times today (until Task 18 lands).
**Steps:**
1. Create `apps/web/src/components/GameLeaderboard.tsx` — client component fetching `/api/runs?game=<slug>&limit=10`.
2. Embed it in the three iframe pages with the slug hardcoded per page.
3. Style with the existing `.recent-run-*` classes.
**Acceptance:**
- [ ] `/games/tower-wars` shows an iframe + a top-10 list (or "No runs yet" when empty).

### Task 18: Migrate tower-wars and tank-you-again to consume `speedrungames-sdk`
**Effort:** L (half-day) per game
**Files:** Upstream `Brynrg/tower-wars`, `Brynrg/Tank-you-again` (NOT this repo)
**What:** Both games ship their own timer/HUD/storage and never POST to `/api/runs`. The whole point of the SDK is to centralize this. Cross-repo work, but the speedrungames repo gets the win — runs from those games start appearing in `Recent Runs`.
**Why:** Largest games on the portal contribute zero data to the leaderboard today. This is the single most user-visible improvement.
**Steps:** (per game, in upstream repo)
1. `npm install github:Brynrg/speedrungames-sdk#v0.1.0` (assumes SDK Task 2 has tagged).
2. Replace existing timer with `import { SpeedrunTimer, formatTime } from "speedrungames-sdk/timer"`.
3. Replace localStorage PB code with `createStorage(slug)`.
4. On game finish, `await submitRun({ slug, ms, splits })`.
5. Re-build, re-ingest into the portal via `scripts/ingest-game-build.mjs`.
**Acceptance:**
- [ ] Playing tower-wars or tank-you-again to completion submits a run that appears in `Recent Runs` on the home page within ~2 seconds.
- [ ] PB still persists across page reloads in browser storage.

### Task 19: Migrate `pokemonspeedrungen1` from `/pokemonspeedrungen1` to `/games/pokemonspeedrungen1/`
**Effort:** L (half-day)
**Files:** `games/pokemonspeedrungen1/**`, `apps/web/src/app/pokemonspeedrungen1/page.tsx` (delete), `apps/web/src/app/games/pokemonspeedrungen1/page.tsx` (new), portal manifest update
**What:** Pokémon game is at `/pokemonspeedrungen1` (top-level Next.js route consuming the workspace package). Portal manifest documents this as `status: archived` with `redirectTo: /pokemonspeedrungen1` — the manifest is essentially apologizing for the URL. Move to canonical `/games/pokemonspeedrungen1/` and flip status to `live`.
**Why:** Single consistent URL pattern across the whole portal. Aligns with AGENTS.md §4.
**Steps:**
1. Decide: keep as Next.js workspace package OR build to static `dist/` and ingest via the standard path.
2. If keeping workspace: rename the route directory `apps/web/src/app/pokemonspeedrungen1/` → `apps/web/src/app/games/pokemonspeedrungen1/`, set up a 301 from the old URL.
3. Update the portal manifest at `apps/web/public/games/pokemonspeedrungen1/manifest.json`: `status: live`, drop `redirectTo`, drop `backfillNotes`.
4. Re-run `build-registry.mjs && validate-games.mjs`.
**Acceptance:**
- [ ] `https://speedrungames.net/games/pokemonspeedrungen1/` loads the game directly.
- [ ] `https://speedrungames.net/pokemonspeedrungen1` 301s to the canonical URL (or the URL is removed entirely).
- [ ] Portal manifest no longer carries `backfilled: true` or `backfillNotes`.

### Task 20: Add a Playwright smoke test for the umbrella site
**Effort:** L (half-day)
**Files:** new `playwright.config.ts`, `tests/portal.spec.ts`
**What:** Verify home page renders, all four `game-card` links are present, clicking each opens the game's iframe page without console errors. `/api/runs` returns 200 with an array.
**Why:** Portal-level regression catch. AGENTS.md and `docs/browser-game-template-contract.md` mandate Playwright in game repos but not at the portal level.
**Steps:**
1. `pnpm add -D @playwright/test` at root.
2. `npx playwright install chromium`.
3. Add `playwright.config.ts` with baseURL = `http://localhost:3000`, webServer running `pnpm dev`.
4. Tests: home page loads with `<h1>⚡ Speed Run Games</h1>`, ≥3 game cards visible, `/api/runs?limit=1` returns 200 + array, each `/games/<slug>` route loads an iframe.
5. Wire into CI (`pnpm exec playwright test`) after `Build portal`.
**Acceptance:**
- [ ] `pnpm exec playwright test` passes locally with the dev server running.
- [ ] CI runs it and fails if any check breaks.

### Task 21: Replace `pnpm-lock.yaml` + `games/pokemonspeedrungen1/package-lock.json` with single lockfile
**Effort:** S (15min)
**Files:** `games/pokemonspeedrungen1/package-lock.json` (delete), `games/pokemonspeedrungen1/package.json`, `pnpm-workspace.yaml`
**What:** Subpackage has `package-lock.json` (npm) while root uses `pnpm-lock.yaml` (pnpm). Mixed lockfiles confuse install tooling and version-pinning.
**Why:** One workspace, one package manager, one lockfile.
**Steps:**
1. Delete `games/pokemonspeedrungen1/package-lock.json`.
2. Add it to `.gitignore` to prevent re-introduction.
3. Run `pnpm install` from root to regenerate `pnpm-lock.yaml` with the subpackage covered.
**Acceptance:**
- [ ] `find . -name "package-lock.json" -not -path "*/node_modules/*"` returns nothing.
- [ ] `pnpm install --frozen-lockfile` succeeds at root.

### Task 22: Document the "two largest games don't consume the SDK" gap in AGENTS.md
**Effort:** S (15min)
**Files:** `AGENTS.md`
**What:** AGENTS.md is silent on SDK adoption. The status quo (3 of 4 games not consuming the SDK) means the leaderboard is mostly cosmetic.
**Why:** Future agents working on tower-wars / tank-you-again should know SDK integration is on the priority list.
**Steps:**
1. Add a §14 "Known portfolio-wide priorities":
   - SDK adoption: tower-wars, tower-wars-2, tank-you-again — Task 18.
   - tower-wars manual-copy drift — Task 4.
   - Pokémon URL migration — Task 19.
**Acceptance:**
- [ ] AGENTS.md §14 exists and references the related improvement-plan tasks.

# Shard Dominion consolidation — unpublished review candidate

## Summary

Retain `Brynrg/shard-dominion` and `/games/shard-dominion/`. This local candidate hides only the existing Fable, Chat and V2 catalog entries and temporarily redirects their entry URLs to canonical Shard Dominion. Bakeoff has no separate portal entry. No repository or deployment was changed remotely. Execution is blocked by unresolved independent hosting mappings and requires independent review.

The user agreed to retire exactly Fable, Chat, V2 and Bakeoff on 2026-10-27. This candidate implements the portal portion for review only. It does not authorize deletion of domains, projects, code, browser storage or shared records.

## Files and justification

- Three `apps/web/public/games/shard-dominion-{fable,chat,v2}/manifest.json` files: metadata only (`status`, `hidden`, `redirectTo`). All provenance and static bundles remain unchanged. This is a requested retirement exception to the normal game-ingest workflow. Ingest is inappropriate here because it deletes/replaces a destination build directory; no build is being ingested.
- `apps/web/src/lib/games.registry.json`: regenerated with the maintained registry command, retaining old slugs for historical run compatibility.
- `apps/web/scripts/generate-redirects.mjs`, `redirect-rules.mjs`, `redirect-rules.test.mjs`: generated `_redirects` receives six forced temporary entry redirects ahead of legacy proxy rules. An old discovery entry cannot resurrect a retired slug or proxy its retained assets to another host. Unrelated proxy rules retain their previous output. Root and `index.html` entry URLs redirect; no asset wildcard redirects are added.
- This report records scope and outstanding gates. `netlify.toml`, workflows, package manifests and lockfiles are unchanged.

The generator is portal infrastructure. AGENTS.md §8/§9 require justification and a human-reviewed infrastructure PR; this report supplies the justification, not a publication approval. No PR has been opened. The parent controller explicitly requested an independently reviewed local plan before any mutation.

## Commands and validation

Starting point: isolated sparse worktree on published portal commit `9661fef19d6936c10638a3c7421c794e4e1460af`, branch `codex/plan-shard-consolidation-20261027`; initially clean. Existing primary and repair worktrees are not used for publication.

Commands completed with Node v22.22.3:

1. `node scripts/build-registry.mjs` — exit 0; 13 manifests/entries.
2. `node --test apps/web/scripts/redirect-rules.test.mjs` — exit 0; 9 tests passed.
3. `SRG_DISCOVER=off node apps/web/scripts/discover-games.mjs` — exit 0; offline overrides only, no network discovery.
4. `node apps/web/scripts/generate-redirects.mjs` — exit 0; six entry redirect rules.
5. `node scripts/validate-games.mjs` — exit 0; no errors; one unchanged Tower Wars asset-documentation warning.

The generated `_redirects` and discovery JSON are ignored build outputs and are not committed or hand-edited. No installation, Next build, browser, loopback service or live API write was run. Unit checks verify rule generation, not Netlify's hosted routing behavior. Hosted preview must verify slash normalization, static-index override and query-string behavior before production publication.

## Data and compatibility

The catalog hides entries using `hidden`; `archived` alone does not hide them. The API accepts slugs from all registry entries, so keeping the three archived entries preserves historical `/api/runs` compatibility. No API, Netlify `runs` store, stored record or key is modified. Preview data uses a separate deploy store. Old run times remain associated with their original game; they must not be relabeled as canonical runs.

Legacy SDK PB storage and canonical ECS saves are different contracts. Canonical uses `shardDominion.save`, `shardDominion.saves`, campaign and choice keys. Existing browser storage is not read, cleared, migrated or overwritten by this patch. Bakeoff's placeholder logic selects `template-demo`, despite declaring the canonical slug; do not clear or repurpose that shared namespace. Already-open or cached clients may continue running. This is reversible unpublishing of entry points, not remote termination or data migration.

## Known limitations and next step

Netlify's connector confirms the portal's published commit and deploy, but does not expose Git/build-hook mappings. The official CLI status check was blocked by an EPERM write to its protected preferences directory; it was not retried. Cloudflare's existing CLI login was expired and could not refresh; no login or permission change was attempted. Thus independent sites, build hooks and live consumers are not cleared. Tracked OpenNext/Cloudflare artifacts are not evidence of a currently deployed worker and remain untouched.

Complete the missing provider mapping checks using an already authorized account, then independently review this exact patch and its deployment/rollback plan. Do not publish, disable workflows, add notices or archive while those gates remain open. Canonical game source has unrelated dirty work and no ownership handoff; no gameplay patch is proposed here.

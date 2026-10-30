# Consolidation CI increment — unpublished candidate

The independently reviewed eight-file candidate is preserved unchanged in its original worktree. This increment retains the published source base and original patch, and adds validation only. No deploy trigger, workflow permission, build command, secret, game source, route metadata or rollback policy changes.

## Files and justification

- `.github/workflows/validate-and-build.yml`: the existing validation step still runs `pnpm run validate:games`, then executes the nine reviewed redirect regressions plus focused artifact-verifier regressions. The existing portal build is unchanged. A new read-only verification step runs after prebuild/build has generated the actual redirect file. Any unexpected rule fails CI.
- `apps/web/scripts/verify-publication-redirects.mjs` and its test: verify the existing generated file without regenerating it or performing discovery. Compare ordered semantic rules against checked-in overrides plus archival registry metadata. Reject canonical entry/asset proxy interference, broad wildcard/placeholder interference, and unrelated additions/removals/changes from network discovery. Preserve explicitly reviewed unrelated proxy rules.
- This report justifies the high-risk workflow edit under AGENTS.md §8. Publication still requires a human-reviewed infrastructure PR; no PR is opened in this local-only task.

## Publication verification step

After an independently authorized normal build, run `node apps/web/scripts/verify-publication-redirects.mjs` against the actual `apps/web/public/_redirects` produced by that build. Do not regenerate it with offline inputs immediately before verification: doing so would hide network-discovery effects. Record the output hash and retain that exact generated file as review evidence. Network-discovered canonical or unrelated proxies are blockers, not implicitly approved changes.

Before any future production publication, inspect the Netlify adapter's actual packaged redirects and hosted preview routing as well. The CLI accepts a file path argument for checking a captured generated-rules artifact. Additional framework-generated rules require explicit review; do not weaken this check merely to make a deployment green. The local CI check does not establish provider configuration, final adapter packaging, live DNS, query/slash behavior or hosted asset responses.

## Bounded local verification

Use the existing Node runtime and offline inputs only: registry generation, game validation, the exact CI test invocation, `SRG_DISCOVER=off` discovery, redirect generation, then verification of that actual generated file. No dependencies installed, network discovery, Next build, browser, preview, provider check, publication or retirement mutation is authorized in this increment. Results and hashes are pinned outside the worktree.

Completed locally: all six commands exited 0. The exact CI invocation ran 15 tests (the original nine plus six verifier regressions), all passing. Game validation retains one unchanged Tower Wars asset-documentation warning and no errors. The generated file contains six approved entry rules, SHA-256 `8d21a779a27fc8181642912cc186970f25aec6f203034e9bab6b8f022515a85d`. All eight originally reviewed files remain byte-identical. This is an offline fixture receipt, not qualification of a network-discovered or Netlify-packaged production artifact.

## Remaining gates

Netlify connected-repository/build-hook/live-consumer mappings remain unknown following the preferences EPERM denial. Cloudflare mapping remains unknown following expired existing authentication. Prior GitHub installation 403 is unchanged and must not be retried through the same route. Full portal build, final Netlify artifact/preview checks and independent increment review remain outstanding. The original approved targets, source pins, data preservation, execution ordering and rollback plan are unchanged.

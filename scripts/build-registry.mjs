#!/usr/bin/env node
// scripts/build-registry.mjs
//
// Scan apps/web/public/games/*/manifest.json, validate each, and emit
// apps/web/src/lib/games.registry.json (sorted: status priority, then title).
//
// Exit codes:
//   0  on success (registry written or already up-to-date)
//   2  on validation failure
//   3  on duplicate slug
//
// Per AGENTS.md §2: the registry is *generated*, never hand-edited.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validatePortalManifest, STATUS_PRIORITY } from "./_lib/manifest-validation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = resolve(ROOT, "apps/web/public/games");
const REGISTRY_PATH = resolve(ROOT, "apps/web/src/lib/games.registry.json");

function main() {
  const failures = [];
  const entries = [];
  const slugs = new Set();

  if (!existsSync(GAMES_DIR)) {
    log(`No games directory at ${GAMES_DIR} — writing empty registry.`);
    writeRegistry([]);
    log("✓ scanned: 0  emitted: 0");
    return;
  }

  const dirs = readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let scanned = 0;
  for (const slug of dirs) {
    const manifestPath = resolve(GAMES_DIR, slug, "manifest.json");
    if (!existsSync(manifestPath)) {
      // Bare static-drop directories without manifest.json are NOT included
      // in the generated registry. They predate the manifest contract.
      // validate-games.mjs reports them separately.
      log(`  skip: apps/web/public/games/${slug}/ (no manifest.json)`);
      continue;
    }

    scanned++;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      failures.push(`apps/web/public/games/${slug}/manifest.json: invalid JSON — ${err.message}`);
      continue;
    }

    const { valid, errors } = validatePortalManifest(
      manifest,
      `apps/web/public/games/${slug}/manifest.json`,
    );
    if (!valid) {
      failures.push(...errors);
      continue;
    }

    if (manifest.slug !== slug) {
      failures.push(
        `apps/web/public/games/${slug}/manifest.json#slug: "${manifest.slug}" does not match directory name "${slug}"`,
      );
      continue;
    }

    if (slugs.has(slug)) {
      log(`✗ duplicate slug "${slug}"`);
      process.exit(3);
    }
    slugs.add(slug);

    entries.push(manifestToRegistryEntry(manifest));
  }

  if (failures.length > 0) {
    log("");
    log("✗ Validation failed:");
    for (const f of failures) log(`  - ${f}`);
    process.exit(2);
  }

  entries.sort(byStatusThenTitle);

  writeRegistry(entries);

  log("");
  log(`✓ scanned: ${scanned}  emitted: ${entries.length}`);
  for (const e of entries) {
    log(`    ${e.status.padEnd(8)}  ${e.slug.padEnd(28)}  ${e.title}`);
  }
}

function manifestToRegistryEntry(m) {
  // Subset of fields useful to the portal frontend / search / nav.
  // Provenance fields (buildHash, sourceCommit, buildTimestamp) stay in the
  // per-game manifest.json — not duplicated here to keep the registry tight.
  return {
    slug: m.slug,
    title: m.title,
    description: m.description,
    repo: m.repo,
    playUrl: m.playUrl,
    category: m.category,
    status: m.status,
    framework: m.framework,
    supportsMobile: m.supportsMobile,
    version: m.version,
    lastUpdated: m.lastUpdated,
    ...(m.redirectTo ? { redirectTo: m.redirectTo } : {}),
  };
}

function byStatusThenTitle(a, b) {
  const ap = STATUS_PRIORITY[a.status] ?? 99;
  const bp = STATUS_PRIORITY[b.status] ?? 99;
  if (ap !== bp) return ap - bp;
  return a.title.localeCompare(b.title);
}

function writeRegistry(entries) {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  const payload = JSON.stringify(entries, null, 2) + "\n";
  if (existsSync(REGISTRY_PATH) && readFileSync(REGISTRY_PATH, "utf8") === payload) {
    log(`✓ ${relFromRoot(REGISTRY_PATH)} already up to date.`);
    return;
  }
  writeFileSync(REGISTRY_PATH, payload, "utf8");
  log(`✓ wrote ${relFromRoot(REGISTRY_PATH)}`);
}

function relFromRoot(p) {
  return p.startsWith(ROOT + "/") ? p.slice(ROOT.length + 1) : p;
}

function log(s) {
  process.stdout.write(s + "\n");
}

main();

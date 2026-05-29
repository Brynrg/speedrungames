#!/usr/bin/env node
// scripts/validate-games.mjs
//
// Portal-side validation. Catches:
//   1. manifests missing or invalid
//   2. registry out of sync with manifests
//   3. missing index.html for live/preview games
//   4. archived games without redirectTo OR preserved index.html
//   5. obvious root-absolute / localhost references in built files
//   6. ASSETS.md flag missing when manifest claims undocumented assets
//   7. bare static-drop directories without manifest.json (warns; legacy)
//
// Collects ALL failures and reports together. Exit non-zero if any errors.
//
// Exit codes:
//   0  all checks pass
//   2  one or more checks failed

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { validatePortalManifest, STATUS_PRIORITY } from "./_lib/manifest-validation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = resolve(ROOT, "apps/web/public/games");
const REGISTRY_PATH = resolve(ROOT, "apps/web/src/lib/games.registry.json");

// Patterns that indicate a build was made for the wrong base path or has
// hardcoded dev-server references. Strings, not regexes — exact-substring match.
const BROKEN_PATH_NEEDLES = [
  'src="/assets',
  "src='/assets",
  'href="/assets',
  "href='/assets",
  "url(/assets",
  'from "/assets',
  "from '/assets",
  'import "/assets',
  "import '/assets",
  '"/src/',
  "'/src/",
  // dev-server URLs only — NOT the bare word "localhost", which legitimately
  // appears inside bundled polyfills (e.g. Next.js URL parsing: s.host==="localhost").
  "//localhost",
  "//127.0.0.1",
];

// File extensions worth scanning for broken paths. Limit blast radius: don't
// open multi-MB binaries.
const SCAN_EXTS = new Set([".html", ".css", ".js", ".mjs", ".cjs", ".map", ".svg"]);

// Subdirectories that must NEVER appear inside a deployed game dir. Their
// presence means someone copied a build artifact in wholesale instead of
// ingesting its CONTENTS — e.g. `cp -r client/dist <game-dir>/` nests the build
// under dist/ and the site keeps serving the stale root files. This exact
// mistake shipped a "no visual change" Tank You Again build. Catch it here.
const STRAY_BUILD_SUBDIRS = new Set(["dist", "out", "build", "node_modules", ".next"]);

// File extensions that are "assets" — if a game's public dir contains any of
// these, we expect either assetsDocumented:true or assetLicenseSummary in the
// manifest.
const ASSET_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".mp4", ".webm",
  ".woff", ".woff2", ".ttf", ".otf",
  ".glb", ".gltf",
]);

const errors = [];
const warnings = [];
const summary = [];

function main() {
  if (!existsSync(GAMES_DIR)) {
    log(`No games directory at ${GAMES_DIR} — nothing to validate.`);
    log("✓ all checks passed (0 games)");
    return;
  }

  const dirs = readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const slugsSeen = new Set();
  const manifests = []; // [{slug, manifest, dir}]

  for (const slug of dirs) {
    const dir = resolve(GAMES_DIR, slug);
    const manifestPath = resolve(dir, "manifest.json");

    if (!existsSync(manifestPath)) {
      warnings.push(
        `apps/web/public/games/${slug}/: bare static-drop directory has no manifest.json (legacy; will not appear in registry)`,
      );
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      errors.push(`apps/web/public/games/${slug}/manifest.json: invalid JSON — ${err.message}`);
      continue;
    }

    const { valid, errors: schemaErrors } = validatePortalManifest(
      manifest,
      `apps/web/public/games/${slug}/manifest.json`,
    );
    if (!valid) {
      errors.push(...schemaErrors);
      continue;
    }

    if (manifest.slug !== slug) {
      errors.push(
        `apps/web/public/games/${slug}/manifest.json#slug: "${manifest.slug}" does not match directory name "${slug}"`,
      );
    }
    if (slugsSeen.has(slug)) {
      errors.push(`duplicate slug "${slug}" detected by validator`);
    }
    slugsSeen.add(slug);

    manifests.push({ slug, manifest, dir });
  }

  // ─── checks per game ─────────────────────────────────────────────────────
  for (const { slug, manifest, dir } of manifests) {
    const indexHtmlPath = resolve(dir, "index.html");
    const hasIndexHtml = existsSync(indexHtmlPath);

    if (manifest.status === "live" || manifest.status === "preview") {
      if (!hasIndexHtml) {
        errors.push(`apps/web/public/games/${slug}/index.html: missing (required for ${manifest.status})`);
      }
    } else if (manifest.status === "archived") {
      if (!hasIndexHtml && !manifest.redirectTo) {
        errors.push(
          `apps/web/public/games/${slug}/: archived without preserved index.html — manifest must set redirectTo`,
        );
      }
    }

    // stray build-artifact subdirectory scan — the "buried dist/" failure
    const strayDirs = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && STRAY_BUILD_SUBDIRS.has(d.name))
      .map((d) => d.name);
    for (const stray of strayDirs) {
      errors.push(
        `apps/web/public/games/${slug}/${stray}/: stray build artifact nested inside the game dir — ` +
          `deploy must ingest dist/ CONTENTS to the game-dir root, never copy the build folder in. ` +
          `Re-run scripts/ingest-game-build.mjs; never \`cp -r dist <game-dir>/\`.`,
      );
    }

    // broken-path scan
    const offending = scanForBrokenPaths(dir);
    if (offending.length > 0) {
      for (const o of offending) {
        errors.push(`apps/web/public/games/${slug}/${o.file}: contains "${o.needle}" — game should use base /games/${slug}/`);
      }
    }

    // assets documentation
    const assetsPresent = hasAssetsInTree(dir);
    if (assetsPresent && !manifest.assetsDocumented && !manifest.assetLicenseSummary) {
      warnings.push(
        `apps/web/public/games/${slug}/: contains asset files but manifest has no assetsDocumented/assetLicenseSummary — source repo should carry ASSETS.md and manifest should attest`,
      );
    }

    summary.push({
      slug,
      status: manifest.status,
      indexHtml: hasIndexHtml,
      version: manifest.version,
    });
  }

  // ─── registry-vs-manifests consistency ───────────────────────────────────
  if (existsSync(REGISTRY_PATH)) {
    let registry;
    try {
      registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
    } catch (err) {
      errors.push(`${rel(REGISTRY_PATH)}: invalid JSON — ${err.message}`);
      registry = null;
    }
    if (Array.isArray(registry)) {
      const registrySlugs = new Set(registry.map((e) => e.slug));
      const manifestSlugs = new Set(manifests.map((m) => m.slug));
      for (const slug of registrySlugs) {
        if (!manifestSlugs.has(slug)) {
          errors.push(`${rel(REGISTRY_PATH)}: contains slug "${slug}" with no matching manifest — regenerate registry`);
        }
      }
      for (const slug of manifestSlugs) {
        if (!registrySlugs.has(slug)) {
          warnings.push(`${rel(REGISTRY_PATH)}: missing slug "${slug}" present in manifests — regenerate registry`);
        }
      }
    }
  } else {
    warnings.push(`${rel(REGISTRY_PATH)}: not present — run build-registry.mjs`);
  }

  // ─── output ──────────────────────────────────────────────────────────────
  log("");
  log("=== summary ===");
  log(`  manifests: ${manifests.length}`);
  log(`  errors:    ${errors.length}`);
  log(`  warnings:  ${warnings.length}`);
  log("");

  if (summary.length > 0) {
    log("Games:");
    for (const s of summary.sort((a, b) => statusOrd(a.status) - statusOrd(b.status))) {
      log(`  ${s.status.padEnd(8)}  ${s.slug.padEnd(28)}  index.html=${s.indexHtml ? "yes" : "NO "}  v${s.version}`);
    }
    log("");
  }

  if (warnings.length > 0) {
    log("Warnings:");
    for (const w of warnings) log(`  ⚠ ${w}`);
    log("");
  }
  if (errors.length > 0) {
    log("Errors:");
    for (const e of errors) log(`  ✗ ${e}`);
    log("");
    log("✗ validation FAILED");
    process.exit(2);
  }

  log("✓ all checks passed");
}

function scanForBrokenPaths(dir) {
  const offending = [];
  walk(dir, (filePath) => {
    const ext = lowerExt(filePath);
    if (!SCAN_EXTS.has(ext)) return;
    // size cap to keep this fast
    const stat = statSync(filePath);
    if (stat.size > 4 * 1024 * 1024) return;
    let contents;
    try {
      contents = readFileSync(filePath, "utf8");
    } catch {
      return;
    }
    for (const needle of BROKEN_PATH_NEEDLES) {
      if (contents.includes(needle)) {
        offending.push({ file: relative(dir, filePath), needle });
      }
    }
  });
  return offending;
}

function hasAssetsInTree(dir) {
  let found = false;
  walk(dir, (filePath) => {
    if (found) return;
    if (ASSET_EXTS.has(lowerExt(filePath))) found = true;
  });
  return found;
}

function walk(dir, fn) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else if (ent.isFile()) fn(p);
  }
}

function lowerExt(p) {
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i).toLowerCase();
}

function statusOrd(s) {
  return STATUS_PRIORITY[s] ?? 99;
}

function rel(p) {
  return p.startsWith(ROOT + "/") ? p.slice(ROOT.length + 1) : p;
}

function log(s) {
  process.stdout.write(s + "\n");
}

main();

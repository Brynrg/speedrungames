#!/usr/bin/env node
// scripts/ingest-game-build.mjs
//
// Ingest a built game repo into the portal.
//
// Usage:
//   node scripts/ingest-game-build.mjs --game-dir <path-to-game-repo>
//
// Optional flags:
//   --slug <slug>                   override manifest.slug
//   --repo <owner/name | url>       override the repo identifier
//   --status <draft|preview|live|archived|broken>   default: preview
//   --dry-run                       describe actions, don't write
//   --allow-missing-source-commit   permit ingest even if git SHA can't be captured
//   --allow-path-warnings           ingest even if broken-path needles found in dist/
//   --skip-validate                 skip running validate-games.mjs at end
//
// What it does (in order):
//   1. Reads <game-dir>/game.manifest.json + validates source manifest.
//   2. Resolves slug (--slug overrides manifest.slug; conflict = fail).
//   3. Asserts <game-dir>/dist/index.html exists.
//   4. Captures sourceCommit via `git -C <game-dir> rev-parse HEAD`.
//   5. Computes buildHash: sha256 over sorted dist/ file paths + file bytes.
//      Manifest is NOT inside dist/, so no self-reference issue.
//   6. Cleans apps/web/public/games/<slug>/ (with path-traversal guard).
//   7. Copies dist/ → apps/web/public/games/<slug>/.
//   8. Writes apps/web/public/games/<slug>/manifest.json.
//   9. Runs scripts/build-registry.mjs.
//  10. Runs scripts/validate-games.mjs (unless --skip-validate).
//
// Safety:
//   - Refuses to clean target if slug is empty, contains "/", or "..", or
//     after resolution falls outside apps/web/public/games/.
//   - Never deletes apps/web/public/games itself.
//   - Fails fast on dist/index.html missing.
//   - Fails on slug/--slug conflict.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep as PATH_SEP } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { validatePortalManifest, validateSourceManifest } from "./_lib/manifest-validation.mjs";
import { checkExpectedAssets } from "./_lib/asset-check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = resolve(ROOT, "apps/web/public/games");

const args = parseArgs(process.argv.slice(2));

if (!args["game-dir"] || typeof args["game-dir"] !== "string") {
  fail("Missing required --game-dir=<path>");
}

const gameDir = resolve(process.cwd(), args["game-dir"]);
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  fail(`--game-dir does not exist or is not a directory: ${gameDir}`);
}

const srcManifestPath = resolve(gameDir, "game.manifest.json");
if (!existsSync(srcManifestPath)) {
  fail(`Missing ${rel(srcManifestPath)} — every source repo must carry game.manifest.json (see docs/browser-game-template-contract.md)`);
}

let srcManifest;
try {
  srcManifest = JSON.parse(readFileSync(srcManifestPath, "utf8"));
} catch (err) {
  fail(`Invalid JSON in ${rel(srcManifestPath)}: ${err.message}`);
}

{
  const { valid, errors } = validateSourceManifest(srcManifest, rel(srcManifestPath));
  if (!valid) {
    fail("Source manifest invalid:\n  - " + errors.join("\n  - "));
  }
}

const slug = (args.slug && typeof args.slug === "string") ? args.slug : srcManifest.slug;
if (args.slug && typeof args.slug === "string" && srcManifest.slug && args.slug !== srcManifest.slug) {
  fail(`--slug "${args.slug}" conflicts with manifest.slug "${srcManifest.slug}". Reconcile one.`);
}
if (typeof slug !== "string" || slug.length === 0) {
  fail("Could not resolve slug — neither --slug nor manifest.slug is set");
}
if (slug.includes("/") || slug.includes("..") || slug.includes("\\") || slug.startsWith("-") || slug.endsWith("-")) {
  fail(`Refusing unsafe slug "${slug}"`);
}
if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
  fail(`Slug "${slug}" is not kebab-case`);
}

const distDir = resolve(gameDir, "dist");
const distIndex = resolve(distDir, "index.html");
if (!existsSync(distIndex)) {
  fail(`Expected built output at ${rel(distIndex)} — run \`npm run build\` in the game repo first`);
}

// Asset-presence contract: if the source manifest declares expectedAssets, the
// freshly-built dist/ must actually contain them. This turns a runtime 404
// (e.g. a game that ships 0 of its 151 sprites) into a deploy-time failure.
if (srcManifest.expectedAssets !== undefined) {
  const { ok, errors } = checkExpectedAssets(distDir, srcManifest.expectedAssets);
  if (!ok) {
    fail(
      "Build is missing assets declared in game.manifest.json#expectedAssets:\n  - " +
        errors.join("\n  - ") +
        `\n  Build these into ${rel(distDir)} before ingest, or correct expectedAssets.`,
    );
  }
}

const targetDir = resolve(GAMES_DIR, slug);
assertSafeTarget(targetDir);

const sourceCommit = captureSourceCommit(gameDir);
if (!sourceCommit && !args["allow-missing-source-commit"]) {
  fail(`Could not capture git SHA from ${rel(gameDir)}. Pass --allow-missing-source-commit to ingest without provenance.`);
}

const buildHash = computeBuildHash(distDir);
log(`  buildHash: ${buildHash}`);

const buildTimestamp = new Date().toISOString();

const repo = (args.repo && typeof args.repo === "string") ? args.repo : (srcManifest.repo || "");
if (!repo) {
  fail(`No repo identifier — pass --repo=<owner/name> or set "repo" in ${rel(srcManifestPath)}`);
}

const status = (args.status && typeof args.status === "string") ? args.status : "preview";
const portalManifest = {
  slug,
  title: srcManifest.title,
  description: srcManifest.description,
  repo,
  playUrl: `/games/${slug}/`,
  category: srcManifest.category || "uncategorized",
  status,
  framework: srcManifest.framework,
  supportsMobile: !!srcManifest.supportsMobile,
  version: srcManifest.version || "0.0.0",
  sourceCommit: sourceCommit || "0000000",
  buildHash,
  buildTimestamp,
  lastUpdated: buildTimestamp,
};

if (typeof srcManifest.emoji === "string") {
  portalManifest.emoji = srcManifest.emoji;
}
if (typeof srcManifest.hidden === "boolean") {
  portalManifest.hidden = srcManifest.hidden;
}
if (typeof srcManifest.assetsDocumented === "boolean") {
  portalManifest.assetsDocumented = srcManifest.assetsDocumented;
}
if (typeof srcManifest.assetLicenseSummary === "string") {
  portalManifest.assetLicenseSummary = srcManifest.assetLicenseSummary;
}
// multiplayer declaration (docs/multiplayer-architecture.md): carry through so
// the portal manifest records each game's pattern + provider + endpoint
if (typeof srcManifest.multiplayer === "string") {
  portalManifest.multiplayer = srcManifest.multiplayer;
}
if (typeof srcManifest.multiplayerProvider === "string") {
  portalManifest.multiplayerProvider = srcManifest.multiplayerProvider;
}
if (typeof srcManifest.multiplayerEndpoint === "string") {
  portalManifest.multiplayerEndpoint = srcManifest.multiplayerEndpoint;
}
// carry the asset contract into the portal manifest so validate-games.mjs can
// re-check the served directory on every portal build (defense in depth)
if (Array.isArray(srcManifest.expectedAssets)) {
  portalManifest.expectedAssets = srcManifest.expectedAssets;
}

{
  const { valid, errors } = validatePortalManifest(portalManifest, "<built portal manifest>");
  if (!valid) {
    fail("Portal manifest would be invalid:\n  - " + errors.join("\n  - "));
  }
}

// Broken-path scan on dist/ BEFORE copying
const offending = scanDistForBrokenPaths(distDir);
if (offending.length > 0 && !args["allow-path-warnings"]) {
  log("");
  log("✗ Build output contains references that will break under /games/<slug>/:");
  for (const o of offending) log(`    ${o.file}: ${o.needle}`);
  log("");
  log("  Fix the game's vite.config.ts base path, then rebuild. Or pass --allow-path-warnings to ingest anyway.");
  process.exit(2);
}

// ── dry-run summary ────────────────────────────────────────────────────────
if (args["dry-run"]) {
  log("");
  log("(dry-run) would perform:");
  log(`  - clean   ${rel(targetDir)}`);
  log(`  - copy    ${rel(distDir)} → ${rel(targetDir)}`);
  log(`  - write   ${rel(targetDir)}/manifest.json`);
  log(`  - run     node scripts/build-registry.mjs`);
  if (!args["skip-validate"]) log(`  - run     node scripts/validate-games.mjs`);
  log("");
  log("Manifest preview:");
  log(JSON.stringify(portalManifest, null, 2));
  process.exit(0);
}

// ── write ──────────────────────────────────────────────────────────────────
if (!existsSync(GAMES_DIR)) {
  mkdirSync(GAMES_DIR, { recursive: true });
}
if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true });
}
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

writeFileSync(
  resolve(targetDir, "manifest.json"),
  JSON.stringify(portalManifest, null, 2) + "\n",
  "utf8",
);

log("");
log(`✓ ingested: ${slug}`);
log(`  target:        ${rel(targetDir)}`);
log(`  sourceCommit:  ${portalManifest.sourceCommit}`);
log(`  buildHash:     ${portalManifest.buildHash}`);
log(`  status:        ${portalManifest.status}`);
log(`  expected URL:  https://speedrungames.net/games/${slug}/`);
log("");

runStep("node", [resolve(ROOT, "scripts/build-registry.mjs")]);

if (!args["skip-validate"]) {
  runStep("node", [resolve(ROOT, "scripts/validate-games.mjs")]);
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const k = m[1];
    if (m[2] !== undefined) {
      out[k] = m[2];
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      out[k] = argv[++i];
    } else {
      out[k] = true;
    }
  }
  return out;
}

function assertSafeTarget(target) {
  const normalizedTarget = resolve(target);
  const normalizedGames = resolve(GAMES_DIR);
  if (normalizedTarget === normalizedGames) {
    fail("Refusing to operate on apps/web/public/games root");
  }
  if (!normalizedTarget.startsWith(normalizedGames + PATH_SEP)) {
    fail(`Refusing target outside apps/web/public/games: ${normalizedTarget}`);
  }
}

function captureSourceCommit(gd) {
  const r = spawnSync("git", ["-C", gd, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const sha = r.stdout.trim();
  return /^[a-f0-9]{7,40}$/.test(sha) ? sha : null;
}

/**
 * Deterministic sha256 over dist/.
 * Method: walk dist/, collect [relative path, file bytes], sort by relative
 * path (utf8 ascending), hash sequence of (path-utf8-length-as-LE-uint32 |
 * path-utf8-bytes | content-length-as-LE-uint64 | content-bytes) per file.
 * Skips OS metadata files (.DS_Store, Thumbs.db).
 */
function computeBuildHash(distDir) {
  const files = [];
  walk(distDir, (p) => {
    const base = p.split(PATH_SEP).pop();
    if (base === ".DS_Store" || base === "Thumbs.db") return;
    files.push(p);
  });
  files.sort((a, b) => {
    const ra = relative(distDir, a);
    const rb = relative(distDir, b);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });

  const h = createHash("sha256");
  const lenBuf32 = Buffer.alloc(4);
  const lenBuf64 = Buffer.alloc(8);
  for (const p of files) {
    const relPath = relative(distDir, p).split(PATH_SEP).join("/");
    const relBytes = Buffer.from(relPath, "utf8");
    lenBuf32.writeUInt32LE(relBytes.length, 0);
    h.update(lenBuf32);
    h.update(relBytes);
    const content = readFileSync(p);
    lenBuf64.writeBigUInt64LE(BigInt(content.length), 0);
    h.update(lenBuf64);
    h.update(content);
  }
  return h.digest("hex");
}

function scanDistForBrokenPaths(distDir) {
  const needles = [
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
  const exts = new Set([".html", ".css", ".js", ".mjs", ".cjs", ".map"]);
  const out = [];
  walk(distDir, (p) => {
    const ext = lowerExt(p);
    if (!exts.has(ext)) return;
    if (statSync(p).size > 4 * 1024 * 1024) return;
    let s;
    try {
      s = readFileSync(p, "utf8");
    } catch {
      return;
    }
    for (const n of needles) {
      if (s.includes(n)) out.push({ file: relative(distDir, p), needle: n });
    }
  });
  return out;
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

function runStep(cmd, argv) {
  log(`  → ${cmd} ${argv.map((a) => rel(a)).join(" ")}`);
  const r = spawnSync(cmd, argv, { stdio: "inherit", encoding: "utf8" });
  if (r.status !== 0) {
    log("");
    log(`✗ Step failed: ${cmd} ${argv.join(" ")}`);
    process.exit(r.status ?? 2);
  }
}

function rel(p) {
  return p.startsWith(ROOT + PATH_SEP) ? p.slice(ROOT.length + 1) : p;
}

function log(s) {
  process.stdout.write(s + "\n");
}

function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n\n`);
  process.exit(1);
}

#!/usr/bin/env node
// scripts/new-game.mjs
//
// Create a new speedrungames.net game repo that is born auto-deploying.
//
// This is THE canonical entrypoint. When an operator says "review my
// speedrungames repo and build me X", the agent runs this once:
//
//   pnpm new:game --slug space-blaster --title "Space Blaster" \
//                 --description "Top-down arcade shooter" --framework vite
//
// What it does (in order):
//   1. Validate slug (kebab-case, <=24 chars, not already a portal game/repo).
//   2. Create Brynrg/<slug> from the Brynrg/speedrungames-game-template repo.
//   3. Set the SPEEDRUNGAMES_TOKEN secret on the new repo so its CI can open
//      deploy PRs against this portal. The token is resolved automatically:
//      env SPEEDRUNGAMES_TOKEN → macOS Keychain (service SPEEDRUNGAMES_TOKEN) →
//      `gh auth token` (only with --use-gh-token). Store it ONCE in the Keychain
//      and every future `pnpm new:game` sets it for you:
//        security add-generic-password -a "$USER" -s SPEEDRUNGAMES_TOKEN -w
//   4. Clone the new repo, substitute slug/title/description/framework into
//      game.manifest.json + deploy.yml + index.html, commit, push.
//   5. First push triggers the game's deploy.yml -> reusable deploy workflow ->
//      portal auto-merge PR -> live at /games/<slug>/.
//
// After this, EVERY push to the game repo auto-deploys. No hand-copying, ever.
//
// Flags:
//   --slug <slug>           required, kebab-case
//   --title "<Title>"       required
//   --description "<text>"  recommended
//   --framework <fw>        vanilla|vite|vite-phaser|vite-pixi|vite-react|nextjs (default vite)
//   --emoji <emoji>         optional catalog emoji
//   --private               create a private repo (default public — keeps Actions free)
//   --owner <owner>         GitHub owner (default Brynrg)
//   --template <owner/name> template repo (default Brynrg/speedrungames-game-template)
//   --workdir <path>        where to clone (default alongside this portal checkout)
//   --dry-run               print the plan, create nothing

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

const OWNER = str(args.owner) || "Brynrg";
const TEMPLATE = str(args.template) || "Brynrg/speedrungames-game-template";
const slug = str(args.slug);
const title = str(args.title);
const description = str(args.description) || title;
const framework = str(args.framework) || "vite";
const emoji = str(args.emoji);
const isPrivate = !!args.private;
const dryRun = !!args["dry-run"];

const VALID_FRAMEWORKS = new Set([
  "vanilla", "vite", "vite-phaser", "vite-pixi", "vite-react", "nextjs", "other",
]);

// ── validate ─────────────────────────────────────────────────────────────────
if (!slug) fail("Missing --slug");
if (!title) fail("Missing --title");
if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) fail(`Slug "${slug}" must be kebab-case`);
if (slug.length > 24) fail(`Slug "${slug}" exceeds 24 chars`);
if (!VALID_FRAMEWORKS.has(framework)) {
  fail(`--framework "${framework}" must be one of: ${[...VALID_FRAMEWORKS].join(", ")}`);
}

ensureCmd("gh");
ensureCmd("git");

// slug collision: existing portal game?
const portalGameDir = resolve(ROOT, "apps/web/public/games", slug);
if (existsSync(portalGameDir)) {
  fail(`A portal game already exists at apps/web/public/games/${slug}/ — pick another slug or update that game instead.`);
}
// slug collision: existing repo?
if (repoExists(`${OWNER}/${slug}`)) {
  fail(`Repo ${OWNER}/${slug} already exists. Pick another slug, or push to that repo to update the game.`);
}

const repo = `${OWNER}/${slug}`;
const workdir = str(args.workdir) || resolve(ROOT, "..", slug);
const { token, tokenSource } = resolveToken();

log("");
log(`Plan:`);
log(`  repo:        ${repo} (${isPrivate ? "private" : "public"})`);
log(`  template:    ${TEMPLATE}`);
log(`  title:       ${title}`);
log(`  framework:   ${framework}`);
log(`  clone to:    ${workdir}`);
log(`  secret:      ${token ? `SPEEDRUNGAMES_TOKEN (from ${tokenSource}) -> set on new repo` : "NOT FOUND — see hint below"}`);
log(`  live URL:    https://speedrungames.net/games/${slug}/`);
log("");

if (dryRun) {
  log("(dry-run) nothing created.");
  process.exit(0);
}

// ── 1. create repo from template ──────────────────────────────────────────────
log(`→ Creating ${repo} from ${TEMPLATE} ...`);
gh([
  "repo", "create", repo,
  "--template", TEMPLATE,
  isPrivate ? "--private" : "--public",
  "--description", description,
]);

// ── 2. set deploy secret ───────────────────────────────────────────────────────
if (token) {
  log(`→ Setting SPEEDRUNGAMES_TOKEN secret on ${repo} ...`);
  execFileSync("gh", ["secret", "set", "SPEEDRUNGAMES_TOKEN", "-R", repo, "--body", token], {
    stdio: ["ignore", "inherit", "inherit"],
  });
} else {
  log("⚠ No SPEEDRUNGAMES_TOKEN found — the game cannot auto-deploy until the secret is set.");
  log("  Store the PAT ONCE (then every `pnpm new:game` sets it automatically), pick one:");
  log("    • macOS Keychain (recommended):  security add-generic-password -a \"$USER\" -s SPEEDRUNGAMES_TOKEN -w");
  log("    • shell profile:                 echo 'export SPEEDRUNGAMES_TOKEN=<PAT>' >> ~/.zshrc");
  log("    • this run only:                 re-run with --use-gh-token (uses your gh login token)");
  log(`  Or set it directly on the repo:  gh secret set SPEEDRUNGAMES_TOKEN -R ${repo} --body '<PAT>'`);
}

// ── 3. clone + substitute placeholders ─────────────────────────────────────────
if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
log(`→ Cloning ${repo} -> ${workdir} ...`);
gh(["repo", "clone", repo, workdir]);

substituteManifest(resolve(workdir, "game.manifest.json"));
substitutePlaceholders(resolve(workdir, "index.html"));
substitutePlaceholders(resolve(workdir, ".github/workflows/deploy.yml"));
substitutePlaceholders(resolve(workdir, "README.md"));

// ── 4. commit + push ───────────────────────────────────────────────────────────
log(`→ Committing scaffold + pushing (triggers first deploy) ...`);
git(workdir, ["add", "-A"]);
git(workdir, ["commit", "-m", `chore: scaffold ${slug} from template`]);
git(workdir, ["push", "origin", "HEAD"]);

log("");
log(`✓ Created ${repo}`);
log(`  local checkout:  ${workdir}`);
log(`  first deploy:    watch the game repo Actions tab; it opens an auto-merging PR on the portal`);
log(`  live URL:        https://speedrungames.net/games/${slug}/`);
log("");
log("From now on, every push to this repo auto-deploys. Iterate freely.");

// ── helpers ─────────────────────────────────────────────────────────────────────
function substituteManifest(p) {
  if (!existsSync(p)) {
    log(`⚠ ${p} not found in template — skipping manifest substitution`);
    return;
  }
  let m;
  try {
    m = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    m = {};
  }
  m.slug = slug;
  m.title = title;
  m.description = description;
  m.framework = framework;
  if (emoji) m.emoji = emoji;
  m.repo = repo;
  if (m.version == null) m.version = "0.1.0";
  writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
}

function substitutePlaceholders(p) {
  if (!existsSync(p)) return;
  let s = readFileSync(p, "utf8");
  s = s
    .replaceAll("__SLUG__", slug)
    .replaceAll("__TITLE__", title)
    .replaceAll("__DESCRIPTION__", description)
    .replaceAll("__FRAMEWORK__", framework);
  writeFileSync(p, s);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const k = m[1];
    if (m[2] !== undefined) out[k] = m[2];
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Resolve the deploy PAT once, automatically, so the operator never re-enters
 * it per game. Order: env var → macOS Keychain → (opt-in) gh login token.
 * Store it once with:
 *   security add-generic-password -a "$USER" -s SPEEDRUNGAMES_TOKEN -w
 */
function resolveToken() {
  if (process.env.SPEEDRUNGAMES_TOKEN) {
    return { token: process.env.SPEEDRUNGAMES_TOKEN.trim(), tokenSource: "env" };
  }
  try {
    const t = execFileSync(
      "security",
      ["find-generic-password", "-s", "SPEEDRUNGAMES_TOKEN", "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (t) return { token: t, tokenSource: "macOS Keychain" };
  } catch {
    // not on macOS, or not stored yet — fall through
  }
  if (args["use-gh-token"]) {
    try {
      const t = execFileSync("gh", ["auth", "token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (t) return { token: t, tokenSource: "gh auth token" };
    } catch {
      // gh not authenticated
    }
  }
  return { token: "", tokenSource: "" };
}

function repoExists(full) {
  try {
    execFileSync("gh", ["repo", "view", full], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gh(argv) {
  execFileSync("gh", argv, { stdio: ["ignore", "inherit", "inherit"] });
}

function git(cwd, argv) {
  execFileSync("git", ["-C", cwd, ...argv], { stdio: ["ignore", "inherit", "inherit"] });
}

function ensureCmd(cmd) {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
  } catch {
    fail(`Required command not found: ${cmd}`);
  }
}

function log(s) {
  process.stdout.write(s + "\n");
}

function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n\n`);
  process.exit(1);
}

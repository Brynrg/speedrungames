#!/usr/bin/env node
// Auto-discovery: queries GitHub for repos with the `speedrungames` topic,
// fetches each repo's speedrungames.json manifest, and merges them with
// the explicit overrides in games.data.json. Writes the result to
// games.generated.json (gitignored, regenerated on every build).
//
// Network failures are tolerated — we fall back to overrides-only.
// Set GITHUB_TOKEN to raise rate limits (unauth is 60 req/hr).
//
// Runs in prebuild BEFORE generate-redirects.mjs.

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OVERRIDES = resolve(ROOT, "src/lib/games.data.json");
const OUT = resolve(ROOT, "src/lib/games.generated.json");

const OWNER = "Brynrg";
const TOPIC = "speedrungames";
const EXCLUDE = new Set([
  "speedrungames",
  "speedrungames-game-template",
  "speedrungames-sdk",
]);

async function gh(path) {
  const url = `https://api.github.com${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "speedrungames-discover",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${url} → ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchManifest(repo) {
  try {
    const data = await gh(
      `/repos/${OWNER}/${repo}/contents/speedrungames.json`,
    );
    const decoded = Buffer.from(data.content, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function discover() {
  const q = encodeURIComponent(`topic:${TOPIC} user:${OWNER}`);
  const search = await gh(`/search/repositories?q=${q}&per_page=100`);
  const repos = (search.items || []).filter((r) => !EXCLUDE.has(r.name));

  const discovered = [];
  for (const repo of repos) {
    const manifest = await fetchManifest(repo.name);
    if (!manifest) continue;
    if (!manifest.slug || manifest.slug === "REPLACE_ME") continue;
    if (!manifest.title || !manifest.deployUrl) {
      console.warn(
        `discover-games: ${repo.full_name} manifest missing required field(s); skipping.`,
      );
      continue;
    }
    discovered.push({
      slug: manifest.slug,
      title: manifest.title,
      description: manifest.description ?? "",
      href: `/games/${manifest.slug}/`,
      emoji: manifest.emoji ?? "🎮",
      proxyTo: manifest.deployUrl,
      hidden: !!manifest.hidden,
      _source: { repo: repo.full_name, updatedAt: repo.updated_at },
    });
  }
  return discovered;
}

function stableSort(games) {
  return [...games].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const overrides = JSON.parse(readFileSync(OVERRIDES, "utf8"));
  const overrideSlugs = new Set(overrides.map((g) => g.slug));

  let discovered = [];
  const offline = process.env.SRG_DISCOVER === "off";
  if (offline) {
    console.log("discover-games: SRG_DISCOVER=off — using overrides only.");
  } else {
    try {
      discovered = await discover();
      console.log(
        `discover-games: found ${discovered.length} game(s) via GitHub topic "${TOPIC}".`,
      );
    } catch (err) {
      console.warn(
        `discover-games: discovery failed (${err.message}); falling back to overrides only.`,
      );
    }
  }

  // Overrides win on slug conflict.
  const newFromDiscovery = discovered.filter((g) => !overrideSlugs.has(g.slug));
  const merged = stableSort([...overrides, ...newFromDiscovery]);

  writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(
    `discover-games: wrote ${merged.length} game(s) to ${OUT.replace(ROOT + "/", "")} (overrides: ${overrides.length}, discovered: ${newFromDiscovery.length}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

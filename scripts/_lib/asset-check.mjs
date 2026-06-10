// scripts/_lib/asset-check.mjs
//
// Filesystem-presence check for a game's declared `expectedAssets`.
//
// A game may declare in its manifest which asset directories its build MUST
// contain, e.g.:
//
//   "expectedAssets": [
//     { "dir": "assets/gen1", "ext": ".png", "min": 151 }
//   ]
//
// This exists because a build can pass every structural check (dist/index.html
// present, no broken paths) yet still ship an EMPTY asset directory — which is
// exactly how "Pokémon Speedrun" went live with 0 of its 151 sprites: index.html
// loaded fine, the sprite paths are built dynamically, and nothing failed until
// every image 404'd in the player's browser. A declared-and-enforced asset
// contract turns that runtime 404 into a deploy-time failure.
//
// `validateExpectedAssetsShape` (pure) lives in manifest-validation.mjs.
// This module does the fs scan and is used by both ingest-game-build.mjs (against
// the freshly-built dist/) and validate-games.mjs (against the served game dir).

import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, sep as PATH_SEP } from "node:path";

/**
 * Verify each `expectedAssets` entry is satisfied under `baseDir`.
 * @param {string} baseDir - directory to resolve entry.dir against (dist/ or the served game dir)
 * @param {Array<{dir: string, ext?: string, min?: number}>|undefined} expectedAssets
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function checkExpectedAssets(baseDir, expectedAssets) {
  const errors = [];
  if (expectedAssets === undefined) return { ok: true, errors };
  if (!Array.isArray(expectedAssets)) {
    // Shape is validated upstream by manifest validation; be defensive anyway.
    return { ok: false, errors: ["expectedAssets: must be an array"] };
  }

  const base = resolve(baseDir);
  for (const entry of expectedAssets) {
    if (!entry || typeof entry.dir !== "string") {
      errors.push(`expectedAssets: each entry needs a string "dir"`);
      continue;
    }
    const dir = resolve(base, entry.dir);
    // Path-safety: the resolved dir must stay inside baseDir.
    if (dir !== base && !dir.startsWith(base + PATH_SEP)) {
      errors.push(`expectedAssets: "${entry.dir}" escapes the game directory`);
      continue;
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      errors.push(`expectedAssets: directory "${entry.dir}" is missing`);
      continue;
    }
    const min = entry.min ?? 1;
    const count = countFiles(dir, entry.ext);
    if (count < min) {
      const extLabel = entry.ext ? `${entry.ext} ` : "";
      errors.push(
        `expectedAssets: "${entry.dir}" has ${count} ${extLabel}file(s), expected at least ${min}`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Count non-empty files under `dir` (recursively), optionally filtered by a
 * lowercase extension match. Zero-byte files are NOT counted, so a 0-byte
 * placeholder (or a `.gitkeep`) can't satisfy the contract.
 */
function countFiles(dir, ext) {
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, ent.name);
    if (ent.isDirectory()) {
      n += countFiles(p, ext);
    } else if (ent.isFile()) {
      if (ext && !ent.name.toLowerCase().endsWith(ext.toLowerCase())) continue;
      try {
        if (statSync(p).size > 0) n++;
      } catch {
        /* unreadable file — don't count it */
      }
    }
  }
  return n;
}

#!/usr/bin/env node
// Postinstall guard: ensures games.generated.json exists so games.ts can
// import it during typecheck/dev even before the first prebuild runs.
// If missing, seeds from games.data.json. Idempotent.

import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src/lib/games.data.json");
const DEST = resolve(ROOT, "src/lib/games.generated.json");

if (!existsSync(DEST)) {
  copyFileSync(SRC, DEST);
  console.log("ensure-registry: seeded games.generated.json from games.data.json");
}

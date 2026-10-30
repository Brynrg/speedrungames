#!/usr/bin/env node
// Generates public/_redirects from canonical archival metadata, followed by
// legacy discovery proxies. Run by prebuild after registry and discovery.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRedirectLines } from "./redirect-rules.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA = resolve(ROOT, "src/lib/games.generated.json");
const REGISTRY = resolve(ROOT, "src/lib/games.registry.json");
const OUT = resolve(ROOT, "public/_redirects");

const games = JSON.parse(readFileSync(DATA, "utf8"));
const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
const lines = buildRedirectLines(games, registry);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"), "utf8");

console.log(`generate-redirects: wrote ${lines.filter((line) => line.startsWith("/")).length} rules to ${OUT.replace(ROOT + "/", "")}`);

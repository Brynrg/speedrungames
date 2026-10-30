// Read the actual prebuild output; never regenerate it in this verification step.
// Discovery may add proxies, so compare against checked-in overrides only.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRedirectLines } from "./redirect-rules.mjs";

function rules(text) {
  return text.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const fields = line.split(/\s+/);
      if (fields.length !== 3 || !fields[0].startsWith("/")) {
        throw new Error("Unsupported generated redirect syntax; publication requires review");
      }
      return fields;
    });
}

function matches(source, path) {
  const pattern = source.replace(/\/$/, "").split("/").map((segment) => {
    if (segment === "*") return ".*";
    if (/^:[a-zA-Z][a-zA-Z0-9_]*$/.test(segment)) return "[^/]+";
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("/");
  return new RegExp(`^${pattern}/?$`).test(path);
}

export function verifyPublicationRedirects(text, overrides, registry) {
  const actual = rules(text);
  const canonicalPaths = [
    "/games/shard-dominion", "/games/shard-dominion/",
    "/games/shard-dominion/index.html", "/games/shard-dominion/assets/entry.js",
  ];
  if (actual.some(([source]) => canonicalPaths.some((path) => matches(source, path)))) {
    throw new Error("Generated redirect/proxy interferes with canonical Shard Dominion; publication blocked");
  }
  const expected = rules(buildRedirectLines(overrides, registry).join("\n"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Generated redirects differ from approved offline rules; review network discovery or changed output before publication");
  }
  return {
    rules: actual.length,
    canonicalProtected: true,
    matchesApprovedOfflineRules: true,
    sha256: createHash("sha256").update(text).digest("hex"),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const artifact = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "public/_redirects");
  const registry = JSON.parse(readFileSync(resolve(root, "src/lib/games.registry.json"), "utf8"));
  const overrides = JSON.parse(readFileSync(resolve(root, "src/lib/games.data.json"), "utf8"));
  const result = verifyPublicationRedirects(readFileSync(artifact, "utf8"), overrides, registry);
  console.log(JSON.stringify({ artifact, ...result }, null, 2));
}

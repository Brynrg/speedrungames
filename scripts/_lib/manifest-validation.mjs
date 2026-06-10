// scripts/_lib/manifest-validation.mjs
//
// Hand-rolled validator for portal game manifests.
//
// Why hand-rolled instead of AJV: per AGENTS.md §10 "Prefer no new dependency
// if validation can be reasonably implemented without it." The portal-game
// manifest has ~15 fields with simple constraints. AJV adds a dep + ~250 KB
// node_modules for marginal benefit. Schema lives at
// schemas/portal-game-manifest.schema.json for IDE tooling and documentation;
// this file enforces the same rules at runtime.

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const GIT_SHA_RE = /^[a-f0-9]{7,40}$/;
const PLAY_URL_RE = /^\/games\/[a-z0-9][a-z0-9-]*[a-z0-9]\/$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const STATUSES = ["draft", "preview", "live", "archived", "broken"];
const FRAMEWORKS = [
  "vite",
  "vite-phaser",
  "vite-pixi",
  "vite-react",
  "vanilla",
  "nextjs",
  "other",
];

const REQUIRED_PORTAL_FIELDS = [
  "slug",
  "title",
  "description",
  "repo",
  "playUrl",
  "category",
  "status",
  "framework",
  "supportsMobile",
  "version",
  "sourceCommit",
  "buildHash",
  "buildTimestamp",
  "lastUpdated",
];

const REQUIRED_SOURCE_FIELDS = ["slug", "title", "description", "framework"];

const MULTIPLAYER_MODES = ["none", "local", "p2p", "realtime-server", "async"];
const MULTIPLAYER_MODES_REQUIRING_PROVIDER = new Set(["p2p", "realtime-server", "async"]);

/**
 * @param {unknown} manifest
 * @param {string} pathForErrors - file path used in error messages
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePortalManifest(manifest, pathForErrors = "<manifest>") {
  const errors = [];
  const at = (field) => `${pathForErrors}#${field}`;

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { valid: false, errors: [`${pathForErrors}: must be a JSON object`] };
  }

  for (const field of REQUIRED_PORTAL_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      errors.push(`${at(field)}: missing required field`);
    }
  }

  if (manifest.slug !== undefined) {
    if (typeof manifest.slug !== "string") {
      errors.push(`${at("slug")}: must be string`);
    } else if (!SLUG_RE.test(manifest.slug)) {
      errors.push(
        `${at("slug")}: "${manifest.slug}" must be kebab-case (lowercase + digits + hyphens, no leading/trailing hyphen)`,
      );
    } else if (manifest.slug.length > 48) {
      errors.push(`${at("slug")}: must be 48 chars or fewer`);
    }
  }

  if (manifest.title !== undefined && (typeof manifest.title !== "string" || manifest.title.length === 0)) {
    errors.push(`${at("title")}: must be non-empty string`);
  }
  if (manifest.description !== undefined && (typeof manifest.description !== "string" || manifest.description.length === 0)) {
    errors.push(`${at("description")}: must be non-empty string`);
  }
  if (manifest.repo !== undefined && (typeof manifest.repo !== "string" || manifest.repo.length === 0)) {
    errors.push(`${at("repo")}: must be non-empty string`);
  }
  if (manifest.category !== undefined && (typeof manifest.category !== "string" || manifest.category.length === 0)) {
    errors.push(`${at("category")}: must be non-empty string`);
  }
  if (manifest.version !== undefined && (typeof manifest.version !== "string" || manifest.version.length === 0)) {
    errors.push(`${at("version")}: must be non-empty string`);
  }

  if (manifest.playUrl !== undefined) {
    if (typeof manifest.playUrl !== "string") {
      errors.push(`${at("playUrl")}: must be string`);
    } else if (!PLAY_URL_RE.test(manifest.playUrl)) {
      errors.push(`${at("playUrl")}: "${manifest.playUrl}" must match /games/<slug>/ with trailing slash`);
    } else if (typeof manifest.slug === "string" && manifest.playUrl !== `/games/${manifest.slug}/`) {
      errors.push(
        `${at("playUrl")}: "${manifest.playUrl}" does not match slug — expected "/games/${manifest.slug}/"`,
      );
    }
  }

  if (manifest.status !== undefined && !STATUSES.includes(manifest.status)) {
    errors.push(`${at("status")}: "${manifest.status}" not one of ${STATUSES.join(", ")}`);
  }
  if (manifest.framework !== undefined && !FRAMEWORKS.includes(manifest.framework)) {
    errors.push(`${at("framework")}: "${manifest.framework}" not one of ${FRAMEWORKS.join(", ")}`);
  }
  if (manifest.supportsMobile !== undefined && typeof manifest.supportsMobile !== "boolean") {
    errors.push(`${at("supportsMobile")}: must be boolean`);
  }

  if (manifest.sourceCommit !== undefined) {
    if (typeof manifest.sourceCommit !== "string") {
      errors.push(`${at("sourceCommit")}: must be string`);
    } else if (!GIT_SHA_RE.test(manifest.sourceCommit)) {
      errors.push(`${at("sourceCommit")}: "${manifest.sourceCommit}" must be a 7-40 char hex git SHA`);
    }
  }

  if (manifest.buildHash !== undefined) {
    if (typeof manifest.buildHash !== "string") {
      errors.push(`${at("buildHash")}: must be string`);
    } else if (!SHA256_RE.test(manifest.buildHash)) {
      errors.push(`${at("buildHash")}: "${manifest.buildHash}" must be a 64-char lowercase hex sha256`);
    }
  }

  if (manifest.buildTimestamp !== undefined) {
    if (typeof manifest.buildTimestamp !== "string") {
      errors.push(`${at("buildTimestamp")}: must be string`);
    } else if (!ISO_DATETIME_RE.test(manifest.buildTimestamp)) {
      errors.push(`${at("buildTimestamp")}: "${manifest.buildTimestamp}" must be an ISO 8601 datetime`);
    }
  }

  if (manifest.lastUpdated !== undefined) {
    if (typeof manifest.lastUpdated !== "string") {
      errors.push(`${at("lastUpdated")}: must be string`);
    } else if (!ISO_DATETIME_RE.test(manifest.lastUpdated) && !ISO_DATE_RE.test(manifest.lastUpdated)) {
      errors.push(`${at("lastUpdated")}: "${manifest.lastUpdated}" must be an ISO 8601 date or datetime`);
    }
  }

  if (manifest.redirectTo !== undefined && typeof manifest.redirectTo !== "string") {
    errors.push(`${at("redirectTo")}: must be string when present`);
  }

  // multiplayer fields (optional; if present, must be valid; provider required for non-trivial modes)
  if (manifest.multiplayer !== undefined) {
    if (typeof manifest.multiplayer !== "string") {
      errors.push(`${at("multiplayer")}: must be string when present`);
    } else if (!MULTIPLAYER_MODES.includes(manifest.multiplayer)) {
      errors.push(`${at("multiplayer")}: "${manifest.multiplayer}" not one of ${MULTIPLAYER_MODES.join(", ")}`);
    } else if (
      MULTIPLAYER_MODES_REQUIRING_PROVIDER.has(manifest.multiplayer) &&
      (manifest.multiplayerProvider === undefined ||
        manifest.multiplayerProvider === null ||
        manifest.multiplayerProvider === "")
    ) {
      errors.push(
        `${at("multiplayerProvider")}: required when multiplayer is "${manifest.multiplayer}" — see docs/multiplayer-architecture.md`,
      );
    }
  }
  if (
    manifest.multiplayerProvider !== undefined &&
    manifest.multiplayerProvider !== null &&
    typeof manifest.multiplayerProvider !== "string"
  ) {
    errors.push(`${at("multiplayerProvider")}: must be string or null when present`);
  }
  if (manifest.multiplayerEndpoint !== undefined && typeof manifest.multiplayerEndpoint !== "string") {
    errors.push(`${at("multiplayerEndpoint")}: must be string when present`);
  }

  validateExpectedAssetsShape(manifest, at, errors);

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the optional `expectedAssets` declaration shape (pure; no fs).
 * Entries are { dir: string (relative, no ".."), ext?: ".xxx", min?: positive int }.
 * The fs-presence enforcement lives in _lib/asset-check.mjs.
 * @param {Record<string, unknown>} manifest
 * @param {(field: string) => string} at
 * @param {string[]} errors
 */
function validateExpectedAssetsShape(manifest, at, errors) {
  if (manifest.expectedAssets === undefined) return;
  if (!Array.isArray(manifest.expectedAssets)) {
    errors.push(`${at("expectedAssets")}: must be an array when present`);
    return;
  }
  manifest.expectedAssets.forEach((entry, i) => {
    const tag = `expectedAssets[${i}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${at(tag)}: must be an object { dir, ext?, min? }`);
      return;
    }
    if (typeof entry.dir !== "string" || entry.dir.length === 0) {
      errors.push(`${at(`${tag}.dir`)}: must be a non-empty string`);
    } else if (entry.dir.includes("..") || entry.dir.startsWith("/") || entry.dir.startsWith("\\")) {
      errors.push(`${at(`${tag}.dir`)}: must be a relative path inside the game (no "..", no leading slash)`);
    }
    if (entry.ext !== undefined && (typeof entry.ext !== "string" || !entry.ext.startsWith("."))) {
      errors.push(`${at(`${tag}.ext`)}: must be a string starting with "." (e.g. ".png")`);
    }
    if (entry.min !== undefined && (!Number.isInteger(entry.min) || entry.min < 1)) {
      errors.push(`${at(`${tag}.min`)}: must be a positive integer`);
    }
  });
}

/**
 * @param {unknown} manifest
 * @param {string} pathForErrors
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSourceManifest(manifest, pathForErrors = "<game.manifest.json>") {
  const errors = [];
  const at = (field) => `${pathForErrors}#${field}`;

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { valid: false, errors: [`${pathForErrors}: must be a JSON object`] };
  }

  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      errors.push(`${at(field)}: missing required field`);
    }
  }

  if (manifest.slug !== undefined) {
    if (typeof manifest.slug !== "string") errors.push(`${at("slug")}: must be string`);
    else if (!SLUG_RE.test(manifest.slug)) errors.push(`${at("slug")}: "${manifest.slug}" must be kebab-case`);
  }
  if (manifest.framework !== undefined && !FRAMEWORKS.includes(manifest.framework)) {
    errors.push(`${at("framework")}: "${manifest.framework}" not one of ${FRAMEWORKS.join(", ")}`);
  }
  if (manifest.supportsMobile !== undefined && typeof manifest.supportsMobile !== "boolean") {
    errors.push(`${at("supportsMobile")}: must be boolean`);
  }
  if (manifest.multiplayer !== undefined) {
    if (typeof manifest.multiplayer !== "string") {
      errors.push(`${at("multiplayer")}: must be string`);
    } else if (!MULTIPLAYER_MODES.includes(manifest.multiplayer)) {
      errors.push(`${at("multiplayer")}: "${manifest.multiplayer}" not one of ${MULTIPLAYER_MODES.join(", ")}`);
    } else if (
      MULTIPLAYER_MODES_REQUIRING_PROVIDER.has(manifest.multiplayer) &&
      (manifest.multiplayerProvider === undefined ||
        manifest.multiplayerProvider === null ||
        manifest.multiplayerProvider === "")
    ) {
      errors.push(
        `${at("multiplayerProvider")}: required when multiplayer is "${manifest.multiplayer}" — see docs/multiplayer-architecture.md`,
      );
    }
  }

  validateExpectedAssetsShape(manifest, at, errors);

  return { valid: errors.length === 0, errors };
}

export const STATUS_PRIORITY = {
  live: 0,
  preview: 1,
  draft: 2,
  archived: 3,
  broken: 4,
};

export { STATUSES, FRAMEWORKS };

// Halftone dot-shading — engineering-disciplined per the design spec: NEVER
// compute a dot grid per-entity per-frame. Instead pre-render a handful of
// density tiles ONCE (lazily, on first use — not at module import time, so
// this stays inert under the happy-dom test environment where render.js is
// pulled in transitively but never actually invoked), convert each to a
// ctx.createPattern(), and reuse the pattern object for the rest of the run.
//
// Callers pick a tile by a DISCRETE zoom tier (see HALFTONE_ZOOM_TIERS in
// palette.js), never by continuously scaling dot size with zoom, and skip
// painting entirely below the lowest tier.
import { HALFTONE_ZOOM_TIERS, INK } from "./palette.js";

const TILE_SPECS = [
  { spacing: 7, dot: 1.05 }, // sparse
  { spacing: 5.5, dot: 1.3 }, // medium
  { spacing: 4.2, dot: 1.55 }, // dense
];

let patterns = null; // built lazily, once, on first real draw call

function makeTileCanvas(size) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function buildTile(spacing, dotRadius) {
  const size = Math.max(2, Math.round(spacing));
  const tile = makeTileCanvas(size);
  const tctx = tile.getContext("2d");
  if (!tctx) {
    return null;
  }
  tctx.clearRect(0, 0, size, size);
  tctx.fillStyle = INK;
  tctx.globalAlpha = 0.62;
  // Four corner-anchored quarter-dots so the pattern tiles seamlessly.
  tctx.beginPath();
  tctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
  tctx.arc(size, 0, dotRadius, 0, Math.PI * 2);
  tctx.arc(0, size, dotRadius, 0, Math.PI * 2);
  tctx.arc(size, size, dotRadius, 0, Math.PI * 2);
  tctx.fill();
  return tile;
}

function ensurePatterns(ctx) {
  if (patterns) {
    return patterns;
  }
  patterns = TILE_SPECS.map((spec) => {
    const tile = buildTile(spec.spacing, spec.dot);
    if (!tile) {
      return null;
    }
    try {
      return ctx.createPattern(tile, "repeat");
    } catch {
      return null;
    }
  });
  return patterns;
}

// Returns a pattern for the given zoom, or null if below the lowest tier (or
// patterns can't be built in this environment) — callers must skip halftone
// entirely on null, never fall back to a per-frame dot loop.
export function getHalftonePattern(ctx, zoom) {
  const tiers = ensurePatterns(ctx);
  if (!tiers) {
    return null;
  }
  if (zoom < HALFTONE_ZOOM_TIERS[0]) {
    return null;
  }
  let idx = 0;
  for (let i = 0; i < HALFTONE_ZOOM_TIERS.length; i += 1) {
    if (zoom >= HALFTONE_ZOOM_TIERS[i]) {
      idx = i;
    }
  }
  return tiers[idx] || null;
}

// Paints a single shaded facet (a fixed pie-wedge on the lower-right of a
// circular body, consistent "sun from upper-left" poster lighting) clipped
// to the entity's silhouette circle. One facet only — never full-body.
export function paintHalftoneFacet(ctx, cx, cy, radius, zoom) {
  const pattern = getHalftonePattern(ctx, zoom);
  if (!pattern) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, -0.15, 1.35);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = pattern;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

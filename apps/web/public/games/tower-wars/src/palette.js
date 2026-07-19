// Ink & Iron — the war-room propaganda poster spot-color system. One source
// of truth for the palette so render.js / towers.js / minimap.js stay in
// sync. Flat spot colors only, no gradients (except the existing board wash
// and portal glow, which are explicitly kept).
//
// Board + terrain (deep indigo-navy, two-tone flat split — not a gradient).
export const BOARD_TOP = "#182644";
export const BOARD_BOTTOM = "#101a30";
export const BOARD_GRID_LIGHT = "rgba(120, 146, 196, 0.08)";
export const BOARD_GRID_DARK = "rgba(8, 13, 26, 0.22)";
export const BOARD_GRID_LINE = "rgba(10, 16, 30, 0.35)";

// Friendly-territory teal wash, pooled near spawn/portal safe zones.
export const FRIENDLY_WASH = "rgba(66, 189, 173, 0.16)";

// Path — rust/blood-red dashed "front line": vermillion top stroke over a
// warm-ink dark edge.
export const PATH_EDGE = "#2c1c14";
export const PATH_TOP = "#b23a2c";
export const PATH_DASH = "rgba(255, 214, 173, 0.55)";

// Ink/outline — never pure black. One consistent stroke weight, used on
// every entity (towers, enemies, projectiles, UI chrome echoes this too).
export const INK = "#241811";
export const STROKE_WEIGHT = 2;

// Universal hostile accent (grafted from Redline): every enemy gets one hot
// rim-light/eye/core element in this vermillion, regardless of family color.
export const HOSTILE_ACCENT = "#e2402a";

// Portals — teal for entry/friendly, vermillion for exit/boss.
export const PORTAL_ENTRY = "#3fc9b4";
export const PORTAL_EXIT = "#d6432f";
export const PORTAL_ENTRY_P2 = "#63d6c8"; // duel lane 2 entry, same family, lighter
export const PORTAL_EXIT_P2 = "#e2716a"; // duel lane 2 exit, same family, softer

// Tower spot colors — ONE saturated flat fill per family. `shade` is a
// darker tone of the same hue used only for the tier-1 interior detail pass
// (never a second competing hue).
export const TOWER_COLORS = {
  arrow: { fill: "#d9a521", shade: "#8f6a15" }, // mustard-gold
  frost: { fill: "#5fd0da", shade: "#2f7d86" }, // ice-cyan
  cannon: { fill: "#767c84", shade: "#464a50" }, // iron-gray
  arcane: { fill: "#7c5cc9", shade: "#4a3680" }, // violet
  venom: { fill: "#8fc31f", shade: "#57780f" }, // acid-green
  mortar: { fill: "#a83a2c", shade: "#6b2119" }, // brick-red
  obelisk: { fill: "#b68a3d", shade: "#7a5a24" }, // brass
};

// Plinth stone tone (shared across all towers — identity now comes from the
// silhouette + spot fill, not the base).
export const PLINTH_TOP = "#3a4256";
export const PLINTH_SIDE = "#262c3c";

// Rank pips / branch chevrons / hero medallion.
export const GOLD = "#e1c56e";
export const GOLD_BRIGHT = "#ffe9a0";
export const CYAN_CHEVRON = "#7fe0ea";
export const MEDAL_RIBBON = "#b23a2c";

// Projectile tint by damage type (kept in the same family hues as towers so
// a shot visually "belongs" to the tower that fired it).
export const PROJECTILE_COLORS = {
  piercing: "#e8c765",
  magic: "#7fe0ea",
  spell: "#b79bf2",
  siege: "#d9a06f",
};

// LOD zoom tiers. camera.zoom ranges roughly from ~0.7 (contain-fit) to
// ~2.8-5 (max). Fixed tiers, not continuous scaling — see HALFTONE notes.
export const TOWER_DETAIL_ZOOM = 1.15; // below this: silhouette + fill only
export const HALFTONE_ZOOM_TIERS = [1.0, 1.65, 2.3]; // sparse / medium / dense thresholds

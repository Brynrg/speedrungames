"use strict";
/*
 * Green Circle TD — web tower defense for speedrungames.net.
 *
 * Faithful to classic WC3 Green Circle TD: creeps spawn from the FOUR CORNERS
 * and follow concentric square rings inward to the center (the "green circle").
 * Leak = a creep reaches the center. Place towers in the gaps between the
 * rings; match damage type to enemy armor. 30 escalating waves to multi-phase bosses.
 *
 * The world is larger than the viewport: pan (drag / WASD / arrows) and zoom
 * (wheel) the field, while the top bar + sidebar stay fixed. Balance tables and
 * path geometry must stay in sync with Brynrg/gctd-server (sim.js).
 *
 * VISUAL IDENTITY — "Sector Scope": a Cold War PPI-radar plot. One green
 * "decay" ramp carries ALL aliveness (creeps, the sweep, beams/tracers) —
 * nothing else is filled with it. Everything static (bezels, tower housings,
 * HUD chrome) is brushed steel + sparse brass, cached once and blitted, never
 * redrawn per frame. Player identity (4) is ring/outline/corner-tick only,
 * never a fill. Threat-state (2, exclusive) marks armored/warning vs
 * boss/critical tiers by shape + pulse rate, not by adding more hue. See the
 * palette block below for the full ramp/const definitions.
 */

// ----------------------------------------------------------------- palette (Sector Scope)
// Tower-type hues (TOWERS[].color further down) are the pre-existing
// gameplay legend for the 11 tower kinds and are kept as-is — they are not
// part of the "6 authored hues" collision this palette resolves (that
// collision was player-identity vs. enemy-threat colors in the source
// pitches). Everything below IS new/authored for this pass.
const VOID_INNER = "#060a06", VOID_OUTER = "#0a120a";                 // world base, radial, cached once
const DECAY = { hot: "#cfffb8", core: "#7cfc8a", mid: "#3d9950", after: "#1c3d22" }; // the one "alive" ramp
const BEZEL = "#3a4238", BRASS = "#8a6a3a";                            // static chrome: steel + sparse rivets
const THREAT = { warn: "#d98a33", crit: "#a13a2e" };                   // armored/warning · boss/critical — exclusive, never a player color
const CALLSIGNS = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"];              // corner call-signs (co-op zones / lobby)

// ----------------------------------------------------------------- data (ported)
const ARMOR_MATRIX = {
  pierce: { light: 2.0, medium: 0.75, heavy: 1.0, fortified: 0.35, hero: 0.5 },
  siege:  { light: 1.0, medium: 0.5,  heavy: 1.0, fortified: 1.5,  hero: 0.5 },
  magic:  { light: 1.25,medium: 0.75, heavy: 2.0, fortified: 0.35, hero: 0.5 },
  normal: { light: 1.0, medium: 1.5,  heavy: 1.0, fortified: 0.7,  hero: 1.0 },
  chaos:  { light: 1.0, medium: 1.0, heavy: 1.0, fortified: 1.0, hero: 1.0 }, // WC3 Chaos — ignores all armor
};

// Enemy `color` is a render-only tier tag (base decay ramp vs. one of the two
// threat accents) — it carries no balance weight, so changing it needs no
// gctd-server changes. Archetypes stay legible via the unchanged 6-shape
// vocabulary in drawCreep, not via 9 different hues.
const ENEMIES = {
  Normal:    { color: DECAY.core,  count_bonus: 0,  health_mult: 1.0,  speed_mult: 1.0,  bounty_bonus: 0,  flags: [], armor: "medium" },
  Swift:     { color: DECAY.core,  count_bonus: 1,  health_mult: 0.85, speed_mult: 1.34, bounty_bonus: 1,  flags: [], armor: "light" },
  Armored:   { color: THREAT.warn, count_bonus: -1, health_mult: 1.75, speed_mult: 0.82, bounty_bonus: 5,  flags: [], armor: "heavy" },
  Swarm:     { color: DECAY.core,  count_bonus: 5,  health_mult: 0.62, speed_mult: 1.08, bounty_bonus: 0,  flags: [], armor: "light" },
  Air:       { color: DECAY.core,  count_bonus: 0,  health_mult: 0.95, speed_mult: 1.18, bounty_bonus: 3,  flags: ["air"], armor: "light" },
  Immune:    { color: THREAT.warn, count_bonus: -1, health_mult: 1.25, speed_mult: 0.95, bounty_bonus: 4,  flags: ["immune"], armor: "fortified" },
  Invisible: { color: DECAY.core,  count_bonus: 0,  health_mult: 1.05, speed_mult: 1.04, bounty_bonus: 6,  flags: ["invisible"], armor: "medium" },
  Hero:      { color: THREAT.crit, count_bonus: -3, health_mult: 2.65, speed_mult: 0.82, bounty_bonus: 12, flags: ["hero"], armor: "hero" },
  Boss:      { color: THREAT.crit, count_bonus: -4, health_mult: 4.2,  speed_mult: 0.72, bounty_bonus: 20, flags: ["boss", "immune"], armor: "fortified" },
};

const RANGE_SCALE = 0.78;
const T = (o) => ({ ...o, range: (o.range || 0) * RANGE_SCALE });
const TOWERS = {
  basic:    T({ name: "Basic",   key: "1", range: 200, damage: 25, cd: 30, cost: 100, color: "rgb(42,178,84)",  dtype: "normal", desc: "Normal dmg, cheap" }),
  sniper:   T({ name: "Sniper",  key: "2", range: 350, damage: 75, cd: 90, cost: 200, color: "rgb(64,215,255)", dtype: "pierce", canAir: true, desc: "Long-range pierce · ✈" }),
  rapid:    T({ name: "Rapid",   key: "3", range: 120, damage: 10, cd: 10, cost: 150, color: "rgb(255,146,41)", dtype: "pierce", canAir: true, desc: "Fast pierce · ✈" }),
  splash:   T({ name: "Splash",  key: "4", range: 180, damage: 40, cd: 60, cost: 180, color: "rgb(178,92,255)", dtype: "siege", splash: 80, desc: "Siege AoE" }),
  frost:    T({ name: "Frost",   key: "5", range: 175, damage: 14, cd: 34, cost: 165, color: "rgb(102,185,255)",dtype: "magic", slow: 0.55, slowDur: 95, canAir: true, desc: "Magic · slows 55% · ✈" }),
  poison:   T({ name: "Poison",  key: "6", range: 185, damage: 12, cd: 36, cost: 145, color: "rgb(100,224,66)", dtype: "magic", poison: 4, poisonDur: 140, desc: "Magic + poison DoT" }),
  detector: T({ name: "Detector",key: "7", range: 230, damage: 8,  cd: 24, cost: 125, color: "rgb(255,214,78)", dtype: "normal", detect: true, desc: "Reveals invisible" }),
  damage_aura: T({ name: "Dmg Aura", key: "8", range: 0, damage: 0, cd: 0, cost: 220, color: "rgb(220,70,70)",   dtype: null, aura: { type: "dmg", radius: 160, value: 0.20 }, desc: "+20% dmg nearby" }),
  speed_aura:  T({ name: "Spd Aura", key: "9", range: 0, damage: 0, cd: 0, cost: 200, color: "rgb(220,200,70)",  dtype: null, aura: { type: "cd", radius: 150, value: 0.15 }, desc: "-15% cooldown nearby" }),
  mint:        T({ name: "Mint",    key: "0", range: 0, damage: 0, cd: 0, cost: 150, color: "rgb(253,224,71)", dtype: null, income: 8, desc: "+8g per wave cleared" }),
  void:        T({ name: "Void",    key: "v", range: 155, damage: 32, cd: 50, cost: 380, color: "rgb(192,85,255)", dtype: "chaos", desc: "Chaos dmg · ignores armor" }),
};

// ---- tower progression: linear Lv1→2→3, then a 2-way spec on the attackers
const MAX_LEVEL = 3;
const LVL = [null, { dmg: 1.0, rng: 1.0, cd: 1.0 }, { dmg: 1.7, rng: 1.08, cd: 0.88 }, { dmg: 2.6, rng: 1.16, cd: 0.80 }];
function scaled(base, level) {
  const m = LVL[level], k = level - 1, s = { ...base };
  if (s.damage) s.damage = Math.round(s.damage * m.dmg);
  if (s.range) s.range = Math.round(s.range * m.rng);
  if (s.cd) s.cd = Math.max(4, Math.round(s.cd * m.cd));
  if (s.splash) s.splash = Math.round(s.splash * (1 + k * 0.12));
  if (s.poison) s.poison = +(s.poison * (1 + k * 0.6)).toFixed(1);
  if (s.poisonDur) s.poisonDur = Math.round(s.poisonDur * (1 + k * 0.15));
  if (s.slowDur) s.slowDur = Math.round(s.slowDur * (1 + k * 0.15));
  if (s.aura) s.aura = { ...s.aura, radius: Math.round(s.aura.radius * (1 + k * 0.12)), value: +(s.aura.value * (1 + k * 0.45)).toFixed(3) };
  if (s.income) s.income = Math.round(s.income * (1 + k * 0.5)); // Lv1: 8g, Lv2: 12g, Lv3: 16g
  return s;
}
// each spec takes the Lv3 stat object and returns a specialized copy
const SPECS = {
  basic: [
    { id: "gatling", name: "Gatling", desc: "Rapid pierce stream", mod: (s) => ({ ...s, cd: Math.max(4, Math.round(s.cd * 0.4)), damage: Math.round(s.damage * 0.55), range: Math.round(s.range * 1.1), dtype: "pierce" }) },
    { id: "cannon", name: "Cannon", desc: "Heavy siege splash", mod: (s) => ({ ...s, splash: 95, damage: Math.round(s.damage * 1.5), cd: Math.round(s.cd * 1.5), dtype: "siege" }) },
  ],
  sniper: [
    { id: "railgun", name: "Railgun", desc: "Massive single hit", mod: (s) => ({ ...s, damage: Math.round(s.damage * 2.0), range: Math.round(s.range * 1.25), cd: Math.round(s.cd * 1.5) }) },
    { id: "marksman", name: "Marksman", desc: "Fires at 3 targets", mod: (s) => ({ ...s, multishot: 3, damage: Math.round(s.damage * 0.7), cd: Math.max(4, Math.round(s.cd * 0.85)) }) },
  ],
  rapid: [
    { id: "tempest", name: "Tempest", desc: "Blistering multi-shot · ✈", mod: (s) => ({ ...s, multishot: 2, cd: Math.max(3, Math.round(s.cd * 0.7)), canAir: true }) },
    { id: "shredder", name: "Shredder", desc: "Siege AA shred · ✈", mod: (s) => ({ ...s, dtype: "siege", damage: Math.round(s.damage * 1.6), cd: Math.round(s.cd * 1.2), canAir: true }) },
  ],
  splash: [
    { id: "mortar", name: "Mortar", desc: "Long-range artillery", mod: (s) => ({ ...s, splash: Math.round(s.splash * 1.6), range: Math.round(s.range * 1.3), damage: Math.round(s.damage * 1.1) }) },
    { id: "inferno", name: "Inferno", desc: "Splash that ignites", mod: (s) => ({ ...s, poison: 9, poisonDur: 150 }) },
  ],
  frost: [
    { id: "glacier", name: "Glacier", desc: "Slows a whole area", mod: (s) => ({ ...s, splash: 120, slow: 0.62 }) },
    { id: "shatter", name: "Shatter", desc: "Heavy magic burst", mod: (s) => ({ ...s, damage: Math.round(s.damage * 2.4), slow: 0.45 }) },
  ],
  poison: [
    { id: "plague", name: "Plague", desc: "Poison spreads on hit", mod: (s) => ({ ...s, splash: 110 }) },
    { id: "venom", name: "Venom", desc: "Potent fast toxin", mod: (s) => ({ ...s, poison: +(s.poison * 2.4).toFixed(1), poisonDur: Math.round(s.poisonDur * 1.3) }) },
  ],
  void: [
    { id: "obliterator", name: "Obliterator", desc: "Massive chaos burst",  mod: (s) => ({ ...s, damage: Math.round(s.damage * 2.4), cd: Math.round(s.cd * 1.6) }) },
    { id: "voidstorm",   name: "Voidstorm",   desc: "Rapid chaos barrage",  mod: (s) => ({ ...s, cd: Math.max(3, Math.round(s.cd * 0.38)), damage: Math.round(s.damage * 0.58), multishot: 2 }) },
  ],
  detector: [
    { id: "sentinel", name: "Sentinel", desc: "Longer detect + punch", mod: (s) => ({ ...s, range: Math.round(s.range * 1.35), detect: true, damage: Math.round(s.damage * 1.4) }) },
    { id: "pulse", name: "Pulse", desc: "Detect + splash ping", mod: (s) => ({ ...s, splash: 90, damage: Math.round(s.damage * 1.2), detect: true }) },
  ],
  damage_aura: [
    { id: "warhorn", name: "Warhorn", desc: "Stronger wider dmg aura", mod: (s) => ({ ...s, aura: { ...s.aura, value: +(s.aura.value * 1.5).toFixed(3), radius: Math.round(s.aura.radius * 1.2) } }) },
    { id: "overcharge", name: "Overcharge", desc: "Aura + light shots", mod: (s) => ({ ...s, aura: { ...s.aura, value: +(s.aura.value * 1.25).toFixed(3) }, damage: 12, cd: 40, dtype: "normal", range: Math.round((s.aura?.radius || 160) * 0.7) }) },
  ],
  speed_aura: [
    { id: "chrono", name: "Chrono", desc: "Stronger wider speed aura", mod: (s) => ({ ...s, aura: { ...s.aura, value: +(s.aura.value * 1.45).toFixed(3), radius: Math.round(s.aura.radius * 1.15) } }) },
    { id: "haste", name: "Haste", desc: "Tighter, hotter haste", mod: (s) => ({ ...s, aura: { type: "cd", radius: Math.round(s.aura.radius * 0.9), value: Math.min(0.35, +(s.aura.value * 1.2).toFixed(3)) } }) },
  ],
  mint: [
    { id: "vault", name: "Vault", desc: "Big wave income", mod: (s) => ({ ...s, income: Math.round(s.income * 1.75) }) },
    { id: "bourse", name: "Bourse", desc: "Income + light defense", mod: (s) => ({ ...s, income: Math.round(s.income * 1.25), range: 140, damage: 10, cd: 36, dtype: "normal" }) },
  ],
};
function statsFor(type, level, spec) {
  let s = scaled(TOWERS[type], level);
  if (spec && SPECS[type]) { const sp = SPECS[type].find((x) => x.id === spec); if (sp) s = sp.mod(s); }
  return s;
}
const hasSpec = (type) => !!SPECS[type];
const upgradeCost = (type, level) => Math.round(TOWERS[type].cost * (level === 1 ? 0.8 : 1.3)); // level → level+1
const specCost = (type) => Math.round(TOWERS[type].cost * 1.8);

const WAVES = [
  { id: 1, name: "First Light", hint: "Light infantry. Build any tower.", reward: 50, spawns: [{ e: "Normal", n: 8, iv: 0.7, at: 0 }] },
  { id: 2, name: "Patrol", hint: "Two corners. Spread your defenses.", reward: 60, spawns: [{ e: "Normal", n: 10, iv: 0.7, at: 0 }, { e: "Normal", n: 10, iv: 0.7, at: 2 }] },
  { id: 3, name: "Swift Strike", hint: "Fast enemies. Freeze or pierce them.", reward: 55, spawns: [{ e: "Swift", n: 12, iv: 0.5, at: 0 }] },
  { id: 4, name: "First Mass", hint: "Swarm of small enemies. AoE shines.", reward: 55, spawns: [{ e: "Swarm", n: 18, iv: 0.3, at: 0 }] },
  { id: 5, name: "Iron Probe", hint: "Heavy armor — Pierce penalty. Try Siege/Magic.", reward: 70, spawns: [{ e: "Armored", n: 8, iv: 0.8, at: 0 }] },
  { id: 6, name: "Choirs", hint: "Mixed speed. Balance your army.", reward: 65, spawns: [{ e: "Normal", n: 10, iv: 0.7, at: 0 }, { e: "Swift", n: 4, iv: 0.4, at: 3 }] },
  { id: 7, name: "The Steel Tide", hint: "Heavy mass. Pierce is weak here.", reward: 80, spawns: [{ e: "Armored", n: 14, iv: 0.8, at: 0 }, { e: "Armored", n: 3, iv: 1.6, at: 5 }] },
  { id: 8, name: "Ghost Patrol", hint: "Invisible enemies. Build a Detector.", reward: 65, spawns: [{ e: "Invisible", n: 6, iv: 0.9, at: 0 }, { e: "Normal", n: 4, iv: 0.7, at: 2 }] },
  { id: 9, name: "Pyre Air", hint: "Flying enemies.", reward: 70, spawns: [{ e: "Air", n: 10, iv: 0.6, at: 0 }] },
  { id: 10, name: "First Sentinel", hint: "BOSS — a single powerful foe with escorts.", boss: true, reward: 250, spawns: [{ e: "Boss", n: 1, iv: 0, at: 0 }, { e: "Normal", n: 6, iv: 0.7, at: 0.5 }] },
  { id: 11, name: "Frost Burn", hint: "Immune to slow. Frost loses its edge.", reward: 75, spawns: [{ e: "Immune", n: 12, iv: 0.7, at: 0 }] },
  { id: 12, name: "Razor Wing", hint: "Fast flyers. Sniper/Frost help.", reward: 80, spawns: [{ e: "Air", n: 14, iv: 0.4, at: 0 }] },
  { id: 13, name: "Ghost Stampede", hint: "Invisible + fast. Detector + AoE.", reward: 85, spawns: [{ e: "Invisible", n: 12, iv: 0.4, at: 0 }, { e: "Swift", n: 8, iv: 0.3, at: 2 }] },
  { id: 14, name: "Dread Cavalry", hint: "Heavy + swift. Diversify.", reward: 80, spawns: [{ e: "Armored", n: 8, iv: 0.8, at: 0 }, { e: "Swift", n: 4, iv: 0.4, at: 4 }] },
  { id: 15, name: "Bound Watchers", hint: "Flyer pairs. Anti-air mandatory.", reward: 90, spawns: [{ e: "Air", n: 8, iv: 0.7, at: 0 }, { e: "Air", n: 4, iv: 0.7, at: 0 }] },
  { id: 16, name: "The Pulse", hint: "Immune + invisible. Detector + non-slow.", reward: 85, spawns: [{ e: "Immune", n: 5, iv: 0.9, at: 0 }, { e: "Invisible", n: 3, iv: 0.9, at: 0 }] },
  { id: 17, name: "The Bound Flame", hint: "Hero creeps from many corners.", reward: 250, spawns: [{ e: "Hero", n: 4, iv: 4.0, at: 0 }, { e: "Hero", n: 4, iv: 4.0, at: 1 }] },
  { id: 18, name: "Ash Swarm", hint: "Swarm of flyers. AoE + anti-air.", reward: 90, spawns: [{ e: "Air", n: 24, iv: 0.25, at: 0 }] },
  { id: 19, name: "Iron Ghosts", hint: "Invisible mass. Detector + Siege/Magic.", reward: 95, spawns: [{ e: "Invisible", n: 10, iv: 0.7, at: 0 }] },
  { id: 20, name: "The Verdant Maw", hint: "MEGA BOSS.", boss: true, reward: 500, spawns: [{ e: "Armored", n: 6, iv: 0.6, at: 0 }, { e: "Invisible", n: 4, iv: 0.6, at: 0 }, { e: "Boss", n: 1, iv: 0, at: 4 }] },
  { id: 21, name: "Hollow March", hint: "Hero + swarm.", reward: 100, spawns: [{ e: "Hero", n: 1, iv: 0, at: 0 }, { e: "Swarm", n: 18, iv: 0.25, at: 1 }] },
  { id: 22, name: "Spectral Wing", hint: "Flyers. Detector + Sniper.", reward: 95, spawns: [{ e: "Air", n: 12, iv: 0.5, at: 0 }] },
  { id: 23, name: "The Brand", hint: "Immune + heavy. Magic/Siege dominate.", reward: 100, spawns: [{ e: "Immune", n: 10, iv: 0.7, at: 0 }] },
  { id: 24, name: "Storm Tide", hint: "All four corners flooding. Defend everywhere.", reward: 120, spawns: [{ e: "Normal", n: 8, iv: 0.5, at: 0 }, { e: "Swift", n: 8, iv: 0.5, at: 0 }, { e: "Armored", n: 8, iv: 0.5, at: 0 }, { e: "Swarm", n: 8, iv: 0.5, at: 0 }] },
  { id: 25, name: "The Crucible", hint: "Mixed armor, all corners. Tower diversity mandatory.", reward: 130, spawns: [{ e: "Normal", n: 6, iv: 0.5, at: 0 }, { e: "Swift", n: 6, iv: 0.5, at: 0 }, { e: "Armored", n: 6, iv: 0.5, at: 0 }, { e: "Immune", n: 6, iv: 0.5, at: 0 }] },
  { id: 26, name: "Final Sentinels", hint: "Heroes + escorts.", reward: 150, spawns: [{ e: "Hero", n: 4, iv: 3.0, at: 0 }, { e: "Hero", n: 4, iv: 3.0, at: 0 }, { e: "Armored", n: 8, iv: 0.5, at: 2 }] },
  { id: 27, name: "The Long Dark", hint: "Immune + invisible puzzle.", reward: 120, spawns: [{ e: "Immune", n: 8, iv: 0.5, at: 0 }, { e: "Invisible", n: 8, iv: 0.4, at: 0 }] },
  { id: 28, name: "Sky Plague", hint: "Flyers + fast.", reward: 110, spawns: [{ e: "Air", n: 10, iv: 0.4, at: 0 }, { e: "Swift", n: 4, iv: 0.3, at: 2 }] },
  { id: 29, name: "The Coronation", hint: "Heroes from every corner + swarm.", reward: 200, spawns: [{ e: "Hero", n: 5, iv: 3.0, at: 0 }, { e: "Hero", n: 5, iv: 3.0, at: 0 }, { e: "Swarm", n: 20, iv: 0.2, at: 1 }] },
  { id: 30, name: "The Pale Crown", hint: "FINAL BOSS.", boss: true, reward: 1000, spawns: [{ e: "Boss", n: 1, iv: 0, at: 0 }, { e: "Armored", n: 6, iv: 0.5, at: 3 }, { e: "Invisible", n: 4, iv: 0.5, at: 3 }, { e: "Hero", n: 2, iv: 2.0, at: 5 }] },
];

function shuffleWaveOrder() {
  const fisher = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = 0 | (Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return [...fisher(WAVES.slice(0, 9)), WAVES[9], ...fisher(WAVES.slice(10, 19)), WAVES[19], ...fisher(WAVES.slice(20, 29)), WAVES[29]];
}

// ----------------------------------------------------------------- world geometry
// TABLES: keep in sync with gctd-server/sim.js (path + economy + difficulty).
const WORLD = 1600;            // square world (px), larger than the viewport
const CENTER = { x: WORLD / 2, y: WORLD / 2 };
const CELL = 40, GRID = WORLD / CELL;
const PATH_W = 34;             // visual path width
const PATH_CLEAR = 28;         // min distance from any path to build
const BASE_SPEED = 145;        // px/s before speed_mult (~70s track after P2 tune)

const START_GOLD = 250, START_LIVES = 20;
const PB_KEY = "speedrungames:green-circle-td:pb";
const MIN_ZOOM = 0.35, MAX_ZOOM = 2.2;

const DIFFICULTY = {
  normal:  { hp: 1.0, gold: 1.0, bounty: 1.0 },
  hard:    { hp: 1.25, gold: 0.9, bounty: 0.95 },
  intense: { hp: 1.55, gold: 0.8, bounty: 0.9 },
};
const PRIORITIES = ["furthest", "closest", "strongest", "weakest"];
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- The maze --------------------------------------------------------
// Concentric square rings: spawn at a corner, full lap, L-notch inward, repeat,
// then axis-aligned approach to the green circle. Fork 0 = CW, fork 1 = CCW
// (seeded junction variance). All streams share the same rings so every creep
// passes every player zone.
const MAZE_IN = 200;
const MAZE_STEP = 220;
const cornersAt = (i) => [[i, i], [WORLD - i, i], [WORLD - i, WORLD - i], [i, WORLD - i]]; // CW: NW,NE,SE,SW

function mazeInsets() {
  const out = [];
  for (let inset = MAZE_IN; WORLD - 2 * inset > MAZE_STEP * 1.4; inset += MAZE_STEP) out.push(inset);
  return out;
}

function loopPath(k, fork = 0) {
  const pts = [];
  const ins = mazeInsets();
  const dir = fork ? -1 : 1;
  for (let ri = 0; ri < ins.length; ri++) {
    const c = cornersAt(ins[ri]);
    for (let j = 0; j <= 4; j++) pts.push(c[((k + dir * j) % 4 + 4) % 4]);
    if (ri < ins.length - 1) {
      const at = c[k], from = c[((k - dir) % 4 + 4) % 4], next = cornersAt(ins[ri + 1])[k];
      const arrX = Math.sign(at[0] - from[0]);
      const dx = next[0] - at[0], dy = next[1] - at[1];
      const midH = [at[0] + dx, at[1]], midV = [at[0], at[1] + dy];
      const hRev = dx !== 0 && Math.sign(dx) === -arrX;
      pts.push(hRev ? midV : midH);
    }
  }
  const last = pts[pts.length - 1];
  const from = pts[pts.length - 2];
  const arrX = Math.sign(last[0] - from[0]);
  const dx = CENTER.x - last[0], dy = CENTER.y - last[1];
  const midH = [last[0] + dx, last[1]], midV = [last[0], last[1] + dy];
  const hRev = dx !== 0 && Math.sign(dx) === -arrX;
  const mid = hRev ? midV : midH;
  if (mid[0] !== last[0] || mid[1] !== last[1]) pts.push(mid);
  const p = pts[pts.length - 1];
  if (p[0] !== CENTER.x || p[1] !== CENTER.y) pts.push([CENTER.x, CENTER.y]);
  return pts;
}
const PATH_VARIANTS = [0, 1, 2, 3].map((k) => [loopPath(k, 0), loopPath(k, 1)]);
const PATHS = PATH_VARIANTS.map((v) => v[0]);
const ENTRIES = cornersAt(MAZE_IN);

function pathHash() {
  let h = 0;
  for (const variants of PATH_VARIANTS)
    for (const path of variants)
      for (const [x, y] of path)
        h = ((h * 31 + (x | 0)) * 31 + (y | 0)) | 0;
  return h >>> 0;
}

// Starter pockets + inner landmarks (WC3 "where your worker starts").
const POSITIONS = (() => {
  const oc = cornersAt(MAZE_IN), mid = MAZE_IN + MAZE_STEP, lo = mid, hi = WORLD - mid;
  return [
    { x: oc[0][0] + 70, y: oc[0][1] + 70 }, { x: oc[1][0] - 70, y: oc[1][1] + 70 },
    { x: oc[2][0] - 70, y: oc[2][1] - 70 }, { x: oc[3][0] + 70, y: oc[3][1] - 70 },
    { x: CENTER.x, y: lo + 80 }, { x: hi - 80, y: CENTER.y },
    { x: CENTER.x, y: hi - 80 }, { x: lo + 80, y: CENTER.y },
  ];
})();

// Motion tokens (Sector Scope) — wall-clock vs sim-tied handled at call sites.
const MOTION = { snap: 0.1, servo: 0.22, pulse: 1.1, sweep: 5, event: 0.7 };

// ----------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const nowMs = () => performance.now();
function fmt(ms) {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor(ms % 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(x).padStart(3, "0")}`;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToPaths(px, py) {
  let m = Infinity;
  for (const variants of PATH_VARIANTS)
    for (const path of variants)
      for (let i = 0; i < path.length - 1; i++)
        m = Math.min(m, distToSeg(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
  return m;
}
const loadPB = () => { try { const v = localStorage.getItem(PB_KEY); return v ? +v : null; } catch { return null; } };
const savePB = (ms) => { try { localStorage.setItem(PB_KEY, String(ms)); } catch {} };

// ----------------------------------------------------------------- multiplayer
// Player identity — ring/outline/corner-tick ONLY, never a fill (see palette).
const PLAYER_COLORS = ["#e8e3d3", "#4a6b8a", "#8a7ba3", "#5c8a72"]; // chalk · china-blue · muted violet · muted sage
function cellOwner(c, r, numPlayers) {
  if (numPlayers <= 1) return 0;
  const half = GRID / 2;
  if (numPlayers === 2) return c < half ? 0 : 1;
  if (numPlayers === 3) return r < half ? (c < half ? 0 : 1) : 2;
  return r < half ? (c < half ? 0 : 1) : (c < half ? 3 : 2);
}

// ----------------------------------------------------------------- game
class Game {
  get gold() { return this.players?.[this.activePlayer]?.gold ?? 0; }
  set gold(v) { if (this.players?.[this.activePlayer]) this.players[this.activePlayer].gold = v; }

  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.stage = document.getElementById("stage");
    this.dpr = 1; this.cssW = 0; this.cssH = 0;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.keys = new Set();
    this.hoverWorld = null;
    this.speed = 1;             // 1× / 2× / 3× game speed (persists across restarts)
    this.numPlayers = 1;
    this.difficulty = "normal";
    this.fixedPath = false;
    this.reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.addEventListener) mq.addEventListener("change", (e) => { this.reducedMotion = e.matches; });
    } catch {}
    // Sector Scope rendering: a cached world-space layer for everything static
    // (rings/bezel/paths/border), a screen-space "trail" layer for phosphor
    // persistence (fed each frame, faded not cleared), and the global PPI
    // sweep angle. See buildStaticLayer()/drawTrailLayer().
    this.staticLayer = document.createElement("canvas");
    this.trailCanvas = document.createElement("canvas");
    this.trailCtx = this.trailCanvas.getContext("2d");
    this.sweepAngle = -Math.PI / 2;
    this._decayGrad = {};
    this._shellFlash = 0;
    this._centerThreat = 0;
    this.reset();
    this.pb = loadPB();
    this.selected = "basic";
    this.bindUI();
    this.bindInput();
    this.resize();
    this.centerCamera();
    this.renderPB();
    this.last = nowMs();
    this.showStart();
    window.addEventListener("resize", () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(this.stage);
    requestAnimationFrame(() => this.loop());
  }

  reset() {
    const n = this.numPlayers || 1;
    const diff = DIFFICULTY[this.difficulty] || DIFFICULTY.normal;
    const gold0 = Math.round(START_GOLD * diff.gold);
    this.players = Array.from({ length: n }, (_, i) => ({ gold: gold0, color: PLAYER_COLORS[i], name: `P${i + 1}` }));
    this.activePlayer = 0;
    this.lives = START_LIVES;
    this.towers = [];
    this.selectedTower = null;
    this.occupied = new Set();
    this.enemies = [];
    this.bullets = [];
    this.fx = [];
    this._shake = null;
    this._shellFlash = 0;
    this._centerThreat = 0;
    this.waveIndex = 0;
    this.seed = (Date.now() >>> 0) ^ (n * 0x9E3779B9);
    this.rng = mulberry32(this.seed);
    this.waves = shuffleWaveOrder();
    this.spawnQueue = [];
    this.activeWaves = [];
    this.state = "ready";
    this.started = false;
    this.runMs = 0;
    this.elapsed = 0;
    this.gameTime = 0;
    if (this.staticLayer) this.buildStaticLayer();
  }

  // ---- camera / viewport
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.stage.clientWidth || 800, h = this.stage.clientHeight || 600;
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.trailCanvas.width = this.canvas.width;
    this.trailCanvas.height = this.canvas.height;
    if (!this._zoomInit) {
      // fit a chunk of the world, but keep tiles big enough to tap on phones
      this.cam.zoom = clamp(Math.max(Math.min(w, h) / 1050, 0.55), MIN_ZOOM, MAX_ZOOM);
      this._zoomInit = true;
    }
    this.clampCamera();
  }
  centerCamera() {
    this.cam.x = CENTER.x - this.cssW / this.cam.zoom / 2;
    this.cam.y = CENTER.y - this.cssH / this.cam.zoom / 2;
    this.clampCamera();
  }
  clampCamera() {
    const vw = this.cssW / this.cam.zoom, vh = this.cssH / this.cam.zoom;
    this.cam.x = vw >= WORLD ? (WORLD - vw) / 2 : clamp(this.cam.x, 0, WORLD - vw);
    this.cam.y = vh >= WORLD ? (WORLD - vh) / 2 : clamp(this.cam.y, 0, WORLD - vh);
  }
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.cam.x + (clientX - rect.left) / this.cam.zoom,
      y: this.cam.y + (clientY - rect.top) / this.cam.zoom,
    };
  }
  zoomAt(clientX, clientY, factor) {
    const before = this.screenToWorld(clientX, clientY);
    this.cam.zoom = clamp(this.cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const after = this.screenToWorld(clientX, clientY);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCamera();
  }

  // ---- buildable grid
  cellOf(wx, wy) { return { c: Math.floor(wx / CELL), r: Math.floor(wy / CELL) }; }
  cellCenter(c, r) { return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; }
  cellBuildable(c, r) {
    if (c < 0 || c >= GRID || r < 0 || r >= GRID) return false;
    if (this.occupied.has(c + "," + r)) return false;
    if (this.players.length > 1 && cellOwner(c, r, this.players.length) !== this.activePlayer) return false;
    const ctr = this.cellCenter(c, r);
    return distToPaths(ctr.x, ctr.y) > PATH_CLEAR;
  }

  // ---- UI
  bindUI() {
    const tb = document.getElementById("towerButtons");
    tb.innerHTML = "";
    for (const [id, d] of Object.entries(TOWERS)) {
      const b = document.createElement("button");
      b.className = "gbtn"; b.dataset.tower = id;
      b.innerHTML =
        `<span class="dot" style="background:${d.color}"></span>` +
        `<span class="nm"><kbd>${d.key}</kbd>${d.name}<span class="ds">${d.desc}</span></span>` +
        `<span class="ct">${d.cost}</span>`;
      b.onclick = () => this.select(id);
      tb.appendChild(b);
    }
    document.getElementById("startWave").onclick = () => this.startNextWave();
    document.querySelectorAll("#speedSeg .seg-btn").forEach((b) => {
      b.onclick = () => {
        if (this.net) { this.net.send({ t: "speed", v: +b.dataset.speed }); return; } // host-only, server enforces
        this.speed = +b.dataset.speed; this.syncSpeedSeg();
      };
    });
    this.syncSpeedSeg();
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
    const restartBtn = document.getElementById("restartBtn");
    if (restartBtn) restartBtn.onclick = () => this.restart();
    const nextPlayerBtn = document.getElementById("nextPlayerBtn");
    if (nextPlayerBtn) nextPlayerBtn.onclick = () => this.cyclePlayer();
    this.refreshButtons();
  }
  syncSpeedSeg() {
    document.querySelectorAll("#speedSeg .seg-btn").forEach((b) => {
      const on = +b.dataset.speed === this.speed;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  select(id) { this.selected = id; this.refreshButtons(); }
  refreshButtons() {
    document.querySelectorAll("[data-tower]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.tower === this.selected);
      b.disabled = this.gold < TOWERS[b.dataset.tower].cost;
    });
    const sw = document.getElementById("startWave");
    sw.disabled = (this.state !== "running" && this.state !== "paused") || this.waveIndex >= WAVES.length;
    const live = this.activeWaves.length;
    sw.textContent = this.waveIndex >= WAVES.length
      ? (live ? `Final waves live (${live})` : "All waves done")
      : `Send wave ${this.waveIndex + 1} ▶${live ? ` · ${live} live` : ""}`;
    document.getElementById("wave").textContent = `Wave ${Math.min(this.waveIndex, WAVES.length)} / ${WAVES.length}`;
    document.getElementById("gold").textContent = this.players.length > 1
      ? `${this.players[this.activePlayer].name} ${Math.floor(this.gold)}g`
      : `${Math.floor(this.gold)}g`;
    const livesEl = document.getElementById("lives");
    livesEl.textContent = `Lives ${Math.max(0, this.lives)}`;
    livesEl.classList.toggle("low", this.lives <= 5 && this.state !== "won");
    if (this.selectedTower) this.renderInspector();
    if (this.renderPlayerPanel) this.renderPlayerPanel();
  }
  renderPB() { document.getElementById("pb").textContent = this.pb == null ? "PB —" : "PB " + fmt(this.pb); }
  setWaveText(name, hint) {
    document.getElementById("waveName").textContent = name;
    document.getElementById("waveHint").textContent = hint;
  }
  setArmorPill(types, hasAir = false) {
    const el = document.getElementById("armorPill");
    if (!el) return;
    if (!types || !types.length) { el.classList.add("hidden"); return; }
    // Distinct from PLAYER_COLORS and THREAT (never reuse those two families
    // for an unrelated legend) — same tactical-instrument tonal family though.
    const ARMOR_INFO = {
      light:     { color: "#8fd0c9", counter: "Pierce best" },
      medium:    { color: "#a8d98f", counter: "Normal best" },
      heavy:     { color: "#c9a35c", counter: "Siege / Magic" },
      fortified: { color: "#9aa8c4", counter: "Siege best" },
      hero:      { color: "#e8c468", counter: "Normal best" },
    };
    const unique = [...new Set(types)];
    el.innerHTML = unique.map((a) => {
      const info = ARMOR_INFO[a] || { color: "#e8f3ea", counter: "?" };
      return `<span class="apill" style="border-color:${info.color}77;color:${info.color};background:${info.color}18">${a[0].toUpperCase()}${a.slice(1)} · ${info.counter}</span>`;
    }).join("");
    if (hasAir) el.innerHTML += `<span class="apill" style="border-color:#8fd0c977;color:#8fd0c9;background:#8fd0c918">✈ Air · anti-air only</span>`;
    el.classList.remove("hidden");
  }

  hideOverlay() { const o = document.getElementById("overlay"); o.className = "overlay hidden"; o.innerHTML = ""; }
  overlay(html, stateClass = "") { const o = document.getElementById("overlay"); o.className = "overlay" + (stateClass ? " " + stateClass : ""); o.innerHTML = html; return o; }
  showStart() {
    this.numPlayers = this.numPlayers || 1;
    this.difficulty = this.difficulty || "normal";
    const mkpsb = (n) => `<button class="psb${n === this.numPlayers ? " psel" : ""}" data-n="${n}">${n}P</button>`;
    const mkdiff = (id, label) => `<button class="psb${id === this.difficulty ? " psel" : ""}" data-diff="${id}">${label}</button>`;
    const o = this.overlay(
      `<h2>Green Circle TD</h2>` +
      `<p>Creeps spawn at the four corners and circle inward. Build towers to stop them — match damage type to armor. Survive all 30 waves as fast as you can.</p>` +
      `<div class="prow"><span class="phint">Players:</span><div class="pbtns">${[1, 2, 3, 4].map(mkpsb).join("")}</div></div>` +
      `<div class="prow"><span class="phint">Difficulty:</span><div class="pbtns">${mkdiff("normal", "Normal")}${mkdiff("hard", "Hard")}${mkdiff("intense", "Intense")}</div></div>` +
      `<label class="prow pathopt"><input type="checkbox" id="fixedPathChk"${this.fixedPath ? " checked" : ""}/> Fixed Path <span class="phint">(speedrun — no fork variance)</span></label>` +
      `<button id="goBtn">Begin</button>` +
      `<button id="onlineBtn" class="nonline">Online Multiplayer</button>`,
    );
    o.querySelector("#onlineBtn").onclick = () => window.GCTDNet?.openLobby(this);
    o.querySelectorAll(".psb[data-n]").forEach(b => {
      b.onclick = () => { this.numPlayers = +b.dataset.n; o.querySelectorAll(".psb[data-n]").forEach(bb => bb.classList.toggle("psel", bb === b)); };
    });
    o.querySelectorAll(".psb[data-diff]").forEach(b => {
      b.onclick = () => { this.difficulty = b.dataset.diff; o.querySelectorAll(".psb[data-diff]").forEach(bb => bb.classList.toggle("psel", bb === b)); };
    });
    o.querySelector("#fixedPathChk").onchange = (e) => { this.fixedPath = !!e.target.checked; };
    o.querySelector("#goBtn").onclick = () => {
      this.numPlayers = this.numPlayers || 1;
      this.reset();
      this.hideOverlay();
      this.state = "running";
      this.shellEvent("ready");
      if (this.renderPlayerPanel) this.renderPlayerPanel();
    };
  }
  end(won) {
    this.state = won ? "won" : "lost";
    this.elapsed = this.runMs;
    this.updatePauseBtn();
    let sub = "";
    if (won) {
      if (this.pb == null || this.elapsed < this.pb) { this.pb = this.elapsed; savePB(this.pb); this.renderPB(); sub = "🏆 New personal best!"; }
      else sub = this.pb != null ? `PB ${fmt(this.pb)}` : "";
    } else sub = `Reached wave ${Math.min(this.waveIndex, WAVES.length)} / ${WAVES.length}.`;
    const o = this.overlay(
      `<h2>${won ? "The Crown is Yours!" : "Overrun"}</h2><p>Time ${fmt(this.elapsed)}</p><p>${sub}</p><p id="lbStatus" class="hint"></p><button id="rsBtn">${won ? "Play again" : "Retry"}</button>`,
      won ? "state-won" : "state-lost",
    );
    o.querySelector("#rsBtn").onclick = () => this.restart();
    if (won) this.submitRun(o);
    this.refreshButtons();
  }
  // Fire-and-forget leaderboard submit to the portal (POST /api/runs).
  // Solo/local runs only: in online mode every client would double-submit the
  // same shared win. Standalone hosting (no portal API) fails silently.
  submitRun(overlayEl) {
    if (this.net) return;
    let runner = "";
    try { runner = (localStorage.getItem("gctd:name") || "").slice(0, 32); } catch {}
    const body = { slug: "green-circle-td", ms: Math.round(this.elapsed) };
    if (runner) body.runner = runner;
    fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        const el = overlayEl?.querySelector("#lbStatus");
        if (el && res.ok) el.textContent = runner ? `Run submitted to the leaderboard as ${runner}.` : "Run submitted to the leaderboard.";
      })
      .catch(() => {});
  }
  restart() {
    if (this.net) { location.reload(); return; } // leave the online game
    this.reset();
    this.state = "running";
    this.hideOverlay();
    this.renderPB();
    this.updatePauseBtn();
    this.refreshButtons();
    this.setWaveText("Ready", "Build towers, then start the first wave.");
    const wavePanel = document.getElementById("wavePanel");
    if (wavePanel) wavePanel.classList.remove("boss-wave");
  }
  togglePause() {
    if (this.net) return; // no pausing an online game
    if (this.state === "running") this.state = "paused";
    else if (this.state === "paused") { this.state = "running"; this.last = nowMs(); }
    else return;
    this.updatePauseBtn();
    this.refreshButtons();
  }
  cyclePlayer() {
    if (this.net) return; // online: you ARE one fixed player
    if (this.players.length <= 1) return;
    this.activePlayer = (this.activePlayer + 1) % this.players.length;
    this.deselectTower();
    this.refreshButtons();
  }
  renderPlayerPanel() {
    const panel = document.getElementById("playerPanel");
    if (!panel) return;
    if (this.players.length <= 1) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    document.getElementById("playerGolds").innerHTML = this.players.map((p, i) =>
      `<div class="pgrow${i === this.activePlayer ? " pgactive" : ""}">` +
      `<span class="pgdot" style="border-color:${p.color}"></span>` +
      `<span class="pgcs" style="color:${p.color}">${CALLSIGNS[i] || ""}</span>` +
      `<span class="pgname">${p.name}</span>` +
      `<span class="pgcoin">${Math.floor(p.gold)}g</span></div>`
    ).join("");
  }
  shellEvent(kind) {
    const app = document.getElementById("app");
    if (!app) return;
    app.classList.remove("ev-wave", "ev-boss", "ev-phase", "ev-clear", "ev-leak");
    void app.offsetWidth;
    if (kind === "wave") app.classList.add("ev-wave");
    else if (kind === "boss") app.classList.add("ev-boss");
    else if (kind === "phase") app.classList.add("ev-phase");
    else if (kind === "clear") app.classList.add("ev-clear");
    else if (kind === "leak") app.classList.add("ev-leak");
    this._shellFlash = MOTION.event;
  }
  updatePauseBtn() {
    const b = document.getElementById("pauseBtn");
    if (b) { b.textContent = this.state === "paused" ? "Resume" : "Pause"; b.classList.toggle("active", this.state === "paused"); }
  }

  // ---- input (drag-to-pan vs click-to-build, wheel zoom, keyboard pan)
  bindInput() {
    const c = this.canvas;
    // Unified Pointer Events drive both mouse and touch. One pointer = tap
    // (build) / drag (pan); two pointers = pinch (zoom + pan). Mouse keeps its
    // exact desktop behaviour (drag-pan, click-build, wheel-zoom, right-click
    // sell); touch adds pinch-zoom and long-press-to-sell.
    const pointers = new Map(); // id -> {x, y}
    let mode = null;            // "tap" | "pan" | "pinch" | "done"
    let downX = 0, downY = 0, lastX = 0, lastY = 0;
    let pinchDist = 1, pinchMidX = 0, pinchMidY = 0;
    let longPress = null;
    const clearLong = () => { if (longPress) { clearTimeout(longPress); longPress = null; } };

    c.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // let right-click → contextmenu
      try { c.setPointerCapture(e.pointerId); } catch {} // can throw if already released
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        mode = "tap";
        downX = lastX = e.clientX; downY = lastY = e.clientY;
        if (e.pointerType === "touch") {
          const sx = e.clientX, sy = e.clientY;
          longPress = setTimeout(() => {
            if (mode === "tap" && this.state === "running") {
              const w = this.screenToWorld(sx, sy);
              const { c: cc, r } = this.cellOf(w.x, w.y);
              this.sellAt(cc, r);
              mode = "done"; // consumed — don't also build on release
            }
          }, 500);
        }
      } else if (pointers.size === 2) {
        clearLong();
        mode = "pinch";
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        pinchMidX = (a.x + b.x) / 2; pinchMidY = (a.y + b.y) / 2;
        c.classList.add("panning");
      }
    });

    c.addEventListener("pointermove", (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size <= 1) this.hoverWorld = this.screenToWorld(e.clientX, e.clientY);

      if (mode === "pinch" && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const nd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const nmx = (a.x + b.x) / 2, nmy = (a.y + b.y) / 2;
        this.cam.x -= (nmx - pinchMidX) / this.cam.zoom; // two-finger pan
        this.cam.y -= (nmy - pinchMidY) / this.cam.zoom;
        this.clampCamera();
        this.zoomAt(nmx, nmy, nd / pinchDist);           // pinch zoom toward midpoint
        pinchDist = nd; pinchMidX = nmx; pinchMidY = nmy;
        return;
      }
      if (mode === "tap" || mode === "pan") {
        if (mode === "tap" && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
          mode = "pan"; clearLong(); c.classList.add("panning");
        }
        if (mode === "pan") {
          this.cam.x -= (e.clientX - lastX) / this.cam.zoom;
          this.cam.y -= (e.clientY - lastY) / this.cam.zoom;
          this.clampCamera();
        }
        lastX = e.clientX; lastY = e.clientY;
      }
    });

    const endPointer = (e) => {
      const wasTap = mode === "tap";
      const px = e.clientX, py = e.clientY;
      pointers.delete(e.pointerId);
      clearLong();
      if (mode === "pinch") {
        if (pointers.size === 1) {
          const p = [...pointers.values()][0]; lastX = p.x; lastY = p.y; mode = "pan";
        } else { mode = null; c.classList.remove("panning"); }
        return;
      }
      c.classList.remove("panning");
      if (pointers.size === 0) {
        if (wasTap) this.onClick(px, py); // a tap/click, not a drag → build
        mode = null;
      }
    };
    c.addEventListener("pointerup", endPointer);
    c.addEventListener("pointercancel", (e) => {
      pointers.delete(e.pointerId);
      clearLong();
      c.classList.remove("panning");
      mode = pointers.size ? mode : null;
    });
    c.addEventListener("mouseleave", () => { this.hoverWorld = null; });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    // right-click sells the hovered tower (keeps WASD free for panning)
    c.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.state !== "running") return;
      const w = this.screenToWorld(e.clientX, e.clientY);
      const { c: cc, r } = this.cellOf(w.x, w.y);
      this.sellAt(cc, r);
    });

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) this.keys.add(k);
      for (const [id, d] of Object.entries(TOWERS)) if (d.key === k) this.select(id);
      if (k === "escape") { this.selected = "basic"; this.deselectTower(); this.refreshButtons(); }
      else if (k === "p") this.togglePause();
      else if (k === "tab") { e.preventDefault(); this.cyclePlayer(); }
      else if (k === " " || e.code === "Space") {
        e.preventDefault();
        if (this.state === "running") this.startNextWave();
        else if (this.state === "won" || this.state === "lost") this.restart();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  onClick(clientX, clientY) {
    if (this.state === "ready") { this.hideOverlay(); this.state = "running"; return; }
    if (this.state !== "running" && this.state !== "paused") return;
    const w = this.screenToWorld(clientX, clientY);
    const { c, r } = this.cellOf(w.x, w.y);
    const existing = this.towers.find((t) => t.c === c && t.r === r);
    if (existing) { this.selectTower(existing); return; }  // click a tower → inspect/upgrade
    if (this.state === "running" && this.build(c, r, this.selected)) this.deselectTower();
  }

  panFromKeys(dt) {
    const v = 520 / this.cam.zoom * dt; // world px/s
    if (this.keys.has("w") || this.keys.has("arrowup")) this.cam.y -= v;
    if (this.keys.has("s") || this.keys.has("arrowdown")) this.cam.y += v;
    if (this.keys.has("a") || this.keys.has("arrowleft")) this.cam.x -= v;
    if (this.keys.has("d") || this.keys.has("arrowright")) this.cam.x += v;
    this.clampCamera();
  }

  build(c, r, type) {
    const def = TOWERS[type];
    if (this.gold < def.cost || !this.cellBuildable(c, r)) return false;
    if (this.net) { this.net.send({ t: "build", c, r, tower: type }); return true; } // server confirms via towers sync
    const ctr = this.cellCenter(c, r);
    this.towers.push({ c, r, x: ctr.x, y: ctr.y, type, def, level: 1, spec: null, invested: def.cost, s: statsFor(type, 1, null), lastFire: -999, dmgMult: 1, cdMult: 1, angle: -Math.PI / 2, player: this.activePlayer, priority: "furthest", recoil: 0 });
    this.occupied.add(c + "," + r);
    this.players[this.activePlayer].gold -= def.cost;
    this.spawnFx(ctr.x, ctr.y, BRASS, "build");
    this.recomputeAuras();
    this.refreshButtons();
    return true;
  }
  // upgrade the selected tower: "level" (Lv+1) or a spec id at max level
  upgradeTower(tw, choice) {
    if (!tw || this.state !== "running") return;
    if (this.net) { this.net.send({ t: "upgrade", c: tw.c, r: tw.r, choice }); return; }
    if (this.players.length > 1 && tw.player !== this.activePlayer) return;
    if (choice === "level" && tw.level < MAX_LEVEL) {
      const cost = upgradeCost(tw.type, tw.level);
      if (this.gold < cost) return;
      this.players[this.activePlayer].gold -= cost; tw.invested += cost; tw.level++;
    } else if (tw.level >= MAX_LEVEL && !tw.spec && hasSpec(tw.type) && SPECS[tw.type].some((x) => x.id === choice)) {
      const cost = specCost(tw.type);
      if (this.gold < cost) return;
      this.players[this.activePlayer].gold -= cost; tw.invested += cost; tw.spec = choice;
    } else return;
    tw.s = statsFor(tw.type, tw.level, tw.spec);
    this.recomputeAuras();
    this.refreshButtons();
    this.renderInspector();
  }
  sellAt(c, r) {
    const idx = this.towers.findIndex((t) => t.c === c && t.r === r);
    if (idx < 0) return;
    if (this.net) { this.net.send({ t: "sell", c, r }); return; }
    const tw = this.towers[idx];
    if (this.players.length > 1 && tw.player !== this.activePlayer) return;
    this.players[tw.player ?? 0].gold += Math.floor(tw.invested * 0.7);
    this.occupied.delete(c + "," + r);
    if (this.selectedTower === tw) this.deselectTower();
    this.towers.splice(idx, 1);
    this.recomputeAuras();
    this.refreshButtons();
  }
  recomputeAuras() {
    for (const t of this.towers) { t.dmgMult = 1; t.cdMult = 1; }
    for (const a of this.towers) {
      if (!a.s.aura) continue;
      for (const t of this.towers) {
        if (t === a) continue;
        if (Math.hypot(t.x - a.x, t.y - a.y) <= a.s.aura.radius) {
          if (a.s.aura.type === "dmg") t.dmgMult += a.s.aura.value;
          else if (a.s.aura.type === "cd") t.cdMult = Math.max(0.3, t.cdMult - a.s.aura.value);
        }
      }
    }
  }
  // ---- tower inspect / upgrade panel
  selectTower(tw) { this.selectedTower = tw; this.renderInspector(); }
  deselectTower() { this.selectedTower = null; this.renderInspector(); }
  renderInspector() {
    const panel = document.getElementById("inspector");
    if (!panel) return;
    const tw = this.selectedTower;
    if (!tw || !this.towers.includes(tw)) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    const s = tw.s, specName = tw.spec ? SPECS[tw.type].find((x) => x.id === tw.spec)?.name : null;
    const tier = tw.spec ? specName : `Lv ${tw.level}`;
    document.getElementById("inspName").innerHTML = `<span class="idot" style="background:${tw.def.color}"></span>${tw.def.name} <span class="lvtag">${tier}</span>`;
    const rate = s.cd ? (60 / (s.cd * tw.cdMult)).toFixed(1) : "—";
    const dmg = s.damage ? Math.round(s.damage * tw.dmgMult) : "—";
    const rows = [];
    if (s.aura) rows.push([s.aura.type === "dmg" ? "Dmg aura" : "Speed aura", `${Math.round(s.aura.value * 100)}% · r${s.aura.radius}`]);
    else if (s.income) rows.push(["Income", `+${s.income}g/wave`], ["Type", "Economy"]);
    else { rows.push(["Damage", dmg], ["Range", Math.round(s.range)], ["Rate", `${rate}/s`]); }
    if (s.splash) rows.push(["Splash", `r${s.splash}`]);
    if (s.slow) rows.push(["Slow", `${Math.round(s.slow * 100)}%`]);
    if (s.poison) rows.push(["Poison", `${s.poison}/t`]);
    if (s.multishot) rows.push(["Targets", s.multishot]);
    if (s.canAir) rows.push(["Anti-Air", "✓"]);
    document.getElementById("inspStats").innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
    const actions = document.getElementById("inspActions");
    actions.innerHTML = "";
    const mkBtn = (label, cost, fn, sub) => {
      const b = document.createElement("button");
      b.className = "ibtn";
      b.innerHTML = `<span>${label}${sub ? `<span class="isub">${sub}</span>` : ""}</span><span class="icost">${cost}g</span>`;
      b.disabled = this.gold < cost || this.state !== "running";
      b.onclick = fn;
      actions.appendChild(b);
    };
    if (tw.level < MAX_LEVEL) {
      mkBtn(`Upgrade → Lv ${tw.level + 1}`, upgradeCost(tw.type, tw.level), () => this.upgradeTower(tw, "level"));
    } else if (!tw.spec && hasSpec(tw.type)) {
      for (const sp of SPECS[tw.type]) mkBtn(sp.name, specCost(tw.type), () => this.upgradeTower(tw, sp.id), sp.desc);
    } else {
      const max = document.createElement("div"); max.className = "imax"; max.textContent = "Fully upgraded"; actions.appendChild(max);
    }
    if (tw.s.dtype || tw.s.detect) {
      const row = document.createElement("div");
      row.className = "prio-row";
      row.innerHTML = `<span class="phint">Target</span>`;
      for (const p of PRIORITIES) {
        const b = document.createElement("button");
        b.className = "prio-btn" + ((tw.priority || "furthest") === p ? " on" : "");
        b.textContent = p[0].toUpperCase() + p.slice(1);
        b.onclick = () => this.setTowerPriority(tw, p);
        row.appendChild(b);
      }
      actions.appendChild(row);
    }
    const sell = document.createElement("button");
    sell.className = "ibtn sell";
    sell.innerHTML = `<span>Sell</span><span class="icost">+${Math.floor(tw.invested * 0.7)}g</span>`;
    sell.onclick = () => this.sellAt(tw.c, tw.r);
    actions.appendChild(sell);
  }
  setTowerPriority(tw, prio) {
    if (!tw || !PRIORITIES.includes(prio)) return;
    if (this.net) { this.net.send({ t: "priority", c: tw.c, r: tw.r, prio }); return; }
    if (this.players.length > 1 && tw.player !== this.activePlayer) return;
    tw.priority = prio;
    this.renderInspector();
  }

  // ---- effects (typed Sector Scope emitters)
  spawnFx(x, y, color, kind, angle = 0, extra = {}) {
    const cap = this.speed >= 3 ? 160 : this.speed >= 2 ? 220 : 280;
    if (this.fx.length > cap) return;
    const push = (o) => this.fx.push(o);
    if (kind === "muzzle") {
      const dtype = extra.dtype || "normal";
      const len = dtype === "siege" ? 10 : dtype === "magic" ? 6 : dtype === "chaos" ? 8 : 12;
      push({ x: x + Math.cos(angle) * 14, y: y + Math.sin(angle) * 14, vx: Math.cos(angle) * 55, vy: Math.sin(angle) * 55, t: MOTION.snap, max: MOTION.snap, color, r: len * 0.35, kind, angle, dtype });
    } else if (kind === "spark") {
      for (let i = 0; i < 4; i++) { const a = Math.random() * 7, sp = 45 + Math.random() * 70; push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.18, max: 0.18, color, r: 2.4, kind }); }
    } else if (kind === "puff") {
      for (let i = 0; i < 8; i++) { const a = Math.random() * 7, sp = 25 + Math.random() * 80; push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.32, max: 0.32, color, r: 3.6, kind }); }
    } else if (kind === "splash") {
      push({ x, y, vx: 0, vy: 0, t: 0.28, max: 0.28, color, r: extra.r || 40, kind });
    } else if (kind === "frost") {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: 0.22, max: 0.22, color: "#67e8f9", r: 2.2, kind }); }
    } else if (kind === "ring") {
      push({ x, y, vx: 0, vy: 0, t: 0.45, max: 0.45, color, r: extra.r || 30, kind });
    } else if (kind === "build") {
      push({ x, y, vx: 0, vy: 0, t: 0.3, max: 0.3, color: BRASS, r: 18, kind });
    } else if (kind === "bossburst") {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, sp = 60 + Math.random() * 90; push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.5, max: 0.5, color: THREAT.crit, r: 4, kind: "puff" }); }
      push({ x, y, vx: 0, vy: 0, t: 0.6, max: 0.6, color: THREAT.crit, r: 80, kind: "ring" });
    }
  }

  // ---- waves (multiple may run at once — you can send the next early)
  startNextWave() {
    if (this.state !== "running" || this.waveIndex >= WAVES.length) return;
    if (this.net) { this.net.send({ t: "wave" }); return; }
    // Aggressive-stacking bonus: +15g for sending while a wave is still live
    const stackBonus = this.activeWaves.length > 0 ? 15 : 0;
    if (stackBonus) this.players[this.activePlayer].gold += stackBonus;
    const w = this.waves[this.waveIndex];
    this.waveIndex++;
    this.started = true;
    const rec = { id: w.id, name: w.name, reward: w.reward, pending: 0, alive: 0, done: false };
    const diff = DIFFICULTY[this.difficulty] || DIFFICULTY.normal;
    const hpBase = Math.round(40 * Math.pow(1.1, this.waveIndex - 1) * diff.hp);
    w.spawns.forEach((sp, gi) => {
      const e = ENEMIES[sp.e];
      const count = Math.max(1, sp.n + e.count_bonus);
      const corner = (sp.corner ?? (w.id + gi)) % 4;
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({
          time: this.gameTime + sp.at + i * sp.iv,
          enemy: sp.e, def: e, corner,
          hp: hpBase * e.health_mult,
          speed: BASE_SPEED * e.speed_mult,
          bounty: Math.max(1, Math.round((3 + Math.floor(this.waveIndex / 3) + e.bounty_bonus) * diff.bounty)),
          rec,
        });
        rec.pending++;
      }
    });
    this.activeWaves.push(rec);
    this.spawnQueue.sort((a, b) => a.time - b.time);
    const waveTitle = stackBonus ? `Wave ${w.id}: ${w.name}  +${stackBonus}g` : `Wave ${w.id}: ${w.name}`;
    this.setWaveText(waveTitle, w.hint);
    const armorTypes = [...new Set(w.spawns.map((sp) => ENEMIES[sp.e].armor))];
    const hasAir = w.spawns.some(sp => ENEMIES[sp.e].flags?.includes("air"));
    this.setArmorPill(armorTypes, hasAir);
    const wavePanel = document.getElementById("wavePanel");
    if (wavePanel) wavePanel.classList.toggle("boss-wave", !!w.boss);
    if (w.boss) { this.shakeCamera(0.55, 10); this.shellEvent("boss"); }
    else this.shellEvent("wave");
    this.refreshButtons();
  }

  spawnEnemy(s) {
    const fork = this.fixedPath ? 0 : ((this.rng?.() ?? Math.random()) < 0.5 ? 0 : 1);
    const path = PATH_VARIANTS[s.corner][fork];
    s.rec.pending--; s.rec.alive++;
    const en = {
      x: path[0][0], y: path[0][1], wp: 0, path, fork, corner: s.corner,
      hp: s.hp, maxHp: s.hp, speed: s.speed, baseSpeed: s.speed,
      def: s.def, enemy: s.enemy, bounty: s.bounty, rec: s.rec,
      flags: s.def.flags, armor: s.def.armor, color: s.def.color,
      slowUntil: 0, slowFactor: 0, poison: 0, poisonUntil: 0, revealed: false,
      phase: s.def.flags.includes("boss") ? 1 : 0,
      revealFlash: 0,
    };
    this.enemies.push(en);
  }

  // ---- simulation
  update(dt) {
    if (this.net) {
      // Online: the server simulates; this advances visuals only — enemy
      // positions ease toward the latest snapshot, tracers/fx decay locally.
      this.gameTime += dt;
      if (this.started && this.state === "running") this.runMs += dt * 1000; // smoothed; snapshots correct drift
      const k = Math.min(1, dt * 10);
      for (const en of this.enemies) { en.x += (en.tx - en.x) * k; en.y += (en.ty - en.y) * k; }
      for (const b of this.bullets) b.t -= dt;
      this.bullets = this.bullets.filter((b) => b.t > 0);
      for (const p of this.fx) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
      if (this.fx.length) this.fx = this.fx.filter((p) => p.t > 0);
      if (this._shake && this._shake.t > 0) { this._shake.t -= dt; if (this._shake.t <= 0) this._shake = null; }
      return;
    }
    if (this.state !== "running") return;
    this.gameTime += dt;
    if (this.started) this.runMs += dt * 1000; // score in sim-time, so game-speed never cheeses the PB
    while (this.spawnQueue.length && this.spawnQueue[0].time <= this.gameTime) this.spawnEnemy(this.spawnQueue.shift());

    const detectors = this.towers.filter((t) => t.s.detect);
    for (const en of this.enemies) {
      if (en.flags.includes("invisible")) {
        const was = en.revealed;
        en.revealed = detectors.some((d) => Math.hypot(d.x - en.x, d.y - en.y) <= d.s.range);
        if (en.revealed && !was) {
          en.revealFlash = this.gameTime + 0.4;
          const d0 = detectors.find((d) => Math.hypot(d.x - en.x, d.y - en.y) <= d.s.range);
          if (d0) this.spawnFx(d0.x, d0.y, DECAY.hot, "ring", 0, { r: 40 });
        }
      } else en.revealed = true;
    }

    this.moveEnemies(dt);
    this.fireTowers();
    for (const b of this.bullets) b.t -= dt;
    this.bullets = this.bullets.filter((b) => b.t > 0);
    for (const p of this.fx) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    if (this.fx.length) this.fx = this.fx.filter((p) => p.t > 0);

    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.poison > 0 && this.gameTime < en.poisonUntil) {
        en.hp -= en.poison * dt;
        this.checkBossPhase(en);
      }
      if (en.hp <= 0) this.onKill(en);
    }
    this.enemies = this.enemies.filter((e) => {
      const keep = e.hp > 0 && !e.leaked;
      if (!keep && e.rec) e.rec.alive--;   // released from its wave's live count
      return keep;
    });

    // a wave is cleared once all its creeps have spawned and are gone
    const cleared = this.activeWaves.filter((r) => !r.done && r.pending <= 0 && r.alive <= 0);
    if (cleared.length) {
      for (const r of cleared) {
        r.done = true;
        const share = Math.max(1, Math.floor(r.reward / this.players.length));
        this.players.forEach(p => p.gold += share);
      }
      this.activeWaves = this.activeWaves.filter((r) => !r.done);
      const reward = cleared.reduce((s, r) => s + r.reward, 0);
      const last = cleared[cleared.length - 1];

      // Mint income: each Mint tower pays out on wave clear (per-owner)
      const mintIncome = this.towers.reduce((s, tw) => s + (tw.s.income || 0), 0);
      if (mintIncome > 0) {
        for (const tw of this.towers) { if (tw.s.income) this.players[tw.player ?? 0].gold += tw.s.income; }
      }

      // Interest economy (2% of current gold, capped +80) — rewards saving
      let interest = 0;
      this.players.forEach(p => { const pi = Math.min(60, Math.floor(p.gold * 0.02)); if (pi > 0) { p.gold += pi; interest += pi; } });

      // Income benchmarks: show "on pace / behind" at key waves (per Legion TD design)
      const BENCHMARKS = { 5: 400, 10: 700, 15: 1000, 20: 1400 };
      const benchTarget = this.players.length === 1 ? BENCHMARKS[last.id] : null;
      let benchMsg = benchTarget ? (this.gold >= benchTarget ? " · ✦ On pace!" : ` · ⚠ Behind (target ${benchTarget}g)`) : "";

      // Build the extras string
      const extras = [];
      if (mintIncome > 0) extras.push(`+${mintIncome}g mint`);
      if (interest > 0) extras.push(`+${interest}g interest`);
      const extStr = extras.length ? ` · ${extras.join(", ")}` : "";

      const wavePanel = document.getElementById("wavePanel");
      if (wavePanel) wavePanel.classList.remove("boss-wave");
      if (this.waveIndex >= WAVES.length && this.activeWaves.length === 0 && this.lives > 0) { this.setWaveText("All clear", "Final wave done!"); this.setArmorPill([]); this.end(true); return; }
      const nextName = this.waves[this.waveIndex]?.name ?? "";
      const clearHint = this.waveIndex >= WAVES.length
        ? `+${reward}g${extStr}. Last waves still in flight.`
        : `+${reward}g${extStr}. Next: ${nextName}${benchMsg}`;
      this.setWaveText(`Wave ${last.id} cleared`, clearHint);
      this.setArmorPill([]);
      this.shellEvent("clear");
      this.refreshButtons();
    }
    if (this.lives <= 0) this.end(false);
    if (this._shake && this._shake.t > 0) { this._shake.t -= dt; if (this._shake.t <= 0) this._shake = null; }
  }

  moveEnemies(dt) {
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const speed = en.speed * (this.gameTime < en.slowUntil ? (1 - (en.slowFactor || 0)) : 1);
      let remaining = speed * dt;
      const path = en.path, last = path.length - 1;
      while (remaining > 0 && en.wp < last) {
        const tx = path[en.wp + 1][0], ty = path[en.wp + 1][1];
        const dx = tx - en.x, dy = ty - en.y, d = Math.hypot(dx, dy) || 1;
        if (d <= remaining) { en.x = tx; en.y = ty; en.wp++; remaining -= d; }
        else { en.x += (dx / d) * remaining; en.y += (dy / d) * remaining; remaining = 0; }
      }
      if (en.wp >= last) { en.leaked = true; this.onLeak(en); }
    }
  }

  fireTowers() {
    const t = this.gameTime;
    for (const tw of this.towers) {
      const d = tw.s;
      if (!d.dtype && !d.detect) continue;
      const eff = (d.cd / 60) * tw.cdMult;
      if (t - tw.lastFire < eff) continue;
      const targets = this.pickTargets(tw, d.multishot || 1);
      if (!targets.length) continue;
      tw.lastFire = t;
      const base = d.damage * tw.dmgMult;
      if (d.dtype) this.spawnFx(tw.x, tw.y, DECAY.hot, "muzzle", Math.atan2(targets[0].y - tw.y, targets[0].x - tw.x), { dtype: d.dtype });
      tw.recoil = 1;
      for (const target of targets) {
        this.bullets.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: tw.def.color, t: 0.09, dtype: d.dtype });
        if (d.splash) {
          this.spawnFx(target.x, target.y, tw.def.color, "splash", 0, { r: d.splash });
          for (const en of this.enemies) {
            if (en.hp <= 0) continue;
            if (Math.hypot(en.x - target.x, en.y - target.y) <= d.splash) this.hit(en, base, d, tw);
          }
        } else this.hit(target, base, d, tw);
      }
    }
  }
  pickTargets(tw, n) {
    const inRange = [];
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.flags.includes("invisible") && !en.revealed) continue;
      if (en.flags.includes("air") && !tw.s.canAir) continue;
      if (Math.hypot(en.x - tw.x, en.y - tw.y) > tw.s.range) continue;
      if (en.path) {
        const last = en.path.length - 1;
        const next = en.path[Math.min(en.wp + 1, last)];
        en._prog = en.wp * 10000 - Math.hypot(en.x - next[0], en.y - next[1]);
      } else en._prog = en.netProg ?? 0;
      en._dist = Math.hypot(en.x - tw.x, en.y - tw.y);
      inRange.push(en);
    }
    const prio = tw.priority || "furthest";
    if (inRange.length > 1) {
      inRange.sort((a, b) => {
        if (prio === "closest") return a._dist - b._dist;
        if (prio === "strongest") return b.hp - a.hp;
        if (prio === "weakest") return a.hp - b.hp;
        return b._prog - a._prog;
      });
    }
    return n <= 1 ? (inRange.length ? [inRange[0]] : []) : inRange.slice(0, n);
  }
  checkBossPhase(en) {
    if (!en.flags.includes("boss") || en.hp <= 0) return;
    const frac = en.hp / en.maxHp;
    if (en.phase < 2 && frac <= 0.6) {
      en.phase = 2;
      en.speed *= 1.25;
      this.shellEvent("phase");
      this.shakeCamera(0.35, 8);
      this.spawnFx(en.x, en.y, THREAT.crit, "bossburst");
      this.setWaveText("PHASE 2", "Boss accelerating — hold the line.");
    } else if (en.phase < 3 && frac <= 0.25) {
      en.phase = 3;
      en.speed *= 1.15;
      this.shellEvent("phase");
      this.shakeCamera(0.45, 10);
      this.spawnFx(en.x, en.y, THREAT.crit, "bossburst");
      this.setWaveText("PHASE 3", "Adds inbound — finish it.");
      const path = en.path || PATH_VARIANTS[en.corner || 0][en.fork || 0];
      const diff = DIFFICULTY[this.difficulty] || DIFFICULTY.normal;
      for (let i = 0; i < 2; i++) {
        const e = ENEMIES.Armored;
        const hp = Math.round(40 * Math.pow(1.1, Math.max(0, this.waveIndex - 1)) * diff.hp * e.health_mult);
        this.enemies.push({
          x: path[0][0], y: path[0][1], wp: 0, path, fork: en.fork || 0, corner: en.corner || 0,
          hp, maxHp: hp, speed: BASE_SPEED * e.speed_mult, baseSpeed: BASE_SPEED * e.speed_mult,
          def: e, enemy: "Armored", bounty: Math.round((3 + Math.floor(this.waveIndex / 3) + e.bounty_bonus) * diff.bounty),
          rec: en.rec, flags: e.flags, armor: e.armor, color: e.color,
          slowUntil: 0, slowFactor: 0, poison: 0, poisonUntil: 0, revealed: true, phase: 0, revealFlash: 0,
        });
        if (en.rec) en.rec.alive++;
      }
    }
  }
  hit(en, base, d, tw) {
    if (en.hp <= 0) return;
    const mult = d.dtype ? (ARMOR_MATRIX[d.dtype][en.armor] ?? 1) : 1;
    if (tw) en.lastHitPlayer = tw.player ?? 0;
    en.hp -= base * mult;
    const immune = en.flags.includes("immune");
    if (d.slow && !immune) {
      const activeSlow = (en.slowUntil > this.gameTime) ? (en.slowFactor || 0) : 0;
      en.slowFactor = Math.max(activeSlow, d.slow);
      en.slowUntil = this.gameTime + d.slowDur / 60;
      this.spawnFx(en.x, en.y, "#67e8f9", "frost");
    } else if (d.slow && immune) {
      // crossed frost glyph handled in draw
      en._immuneFlash = this.gameTime + 0.25;
    }
    if (d.poison && !immune) {
      const activePoison = (en.poisonUntil > this.gameTime) ? en.poison : 0;
      en.poison = Math.max(activePoison, d.poison);
      en.poisonUntil = this.gameTime + d.poisonDur / 60;
    }
    if (en.hp > 0) this.spawnFx(en.x, en.y, DECAY.hot, "spark");
    this.checkBossPhase(en);
    if (en.hp <= 0) this.onKill(en);
  }
  onKill(en) {
    if (en._dead) return; en._dead = true;
    this.players[en.lastHitPlayer ?? 0].gold += en.bounty;
    if (en.flags.includes("boss")) { this.spawnFx(en.x, en.y, en.color, "bossburst"); this.shakeCamera(0.38, 7); }
    else {
      this.spawnFx(en.x, en.y, en.color, "puff");
      if (en.flags.includes("hero")) this.shakeCamera(0.18, 3);
    }
    this.refreshButtons();
  }
  shakeCamera(duration, intensity) {
    if (this.reducedMotion) { intensity *= 0.35; duration *= 0.7; }
    if (this._shake && this._shake.t > 0 && intensity < this._shake.intensity) return;
    this._shake = { t: duration, dur: duration, intensity };
  }
  onLeak(en) {
    const cost = en.flags.includes("boss") ? 10 : en.flags.includes("hero") ? 4 : 1;
    this.lives -= cost;
    this.shellEvent("leak");
    this.spawnFx(CENTER.x, CENTER.y, THREAT.crit, "ring", 0, { r: 60 });
    this.refreshButtons();
  }

  // ---- loop + render
  loop() {
    const t = nowMs();
    let dt = (t - this.last) / 1000; this.last = t;
    if (dt > 0.05) dt = 0.05;
    this.panFromKeys(dt);
    // Global PPI sweep — wall-clock. Reduced-motion: freeze sweep.
    if (!this.reducedMotion) this.sweepAngle = (this.sweepAngle + dt * (Math.PI * 2 / MOTION.sweep)) % (Math.PI * 2);
    if (this._shellFlash > 0) this._shellFlash -= dt;
    // Center threat: nearest enemy progress toward leak
    let threat = 0;
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const prog = en.path ? en.wp / Math.max(1, en.path.length - 1) : (en.netProg || 0);
      threat = Math.max(threat, prog);
      if (en.flags.includes("boss")) threat = Math.max(threat, 0.55 + (en.phase || 1) * 0.12);
    }
    this._centerThreat = threat;
    if (this.lives <= 5) this._centerThreat = Math.max(this._centerThreat, 0.7);
    // 2×/3× = run the fixed-step sim multiple times per frame (keeps physics stable)
    const steps = this.net ? 1 : this.state === "running" ? this.speed : 1;
    for (let i = 0; i < steps; i++) this.update(dt);
    document.getElementById("timer").textContent = fmt(this.runMs);
    this.draw(dt);
    requestAnimationFrame(() => this.loop());
  }

  // Everything static (world-border range rings, degree-tick bezel + numerals,
  // the spiral-path groove+core, spawn/landmark ticks, zone-divider geometry)
  // is rendered ONCE here into a world-space offscreen canvas and blitted
  // every frame in draw() — never recomputed per frame.
  buildStaticLayer() {
    const cv = this.staticLayer;
    cv.width = WORLD; cv.height = WORLD;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, WORLD, WORLD);

    // void base — radial gradient, drawn once per rebuild, not per frame
    const vg = g.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, WORLD * 0.8);
    vg.addColorStop(0, VOID_INNER); vg.addColorStop(1, VOID_OUTER);
    g.fillStyle = vg; g.fillRect(0, 0, WORLD, WORLD);

    // PPI range rings — concentric distance rings, brass/steel, low alpha
    const ringCount = 5, maxR = WORLD * 0.7;
    g.lineWidth = 1; g.strokeStyle = BEZEL;
    g.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "left"; g.textBaseline = "middle";
    for (let i = 1; i <= ringCount; i++) {
      const r = (maxR / ringCount) * i;
      g.globalAlpha = 0.38;
      g.beginPath(); g.arc(CENTER.x, CENTER.y, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.55; g.fillStyle = BRASS;
      g.fillText(String(Math.round(r)), CENTER.x + 6, CENTER.y - r);
    }
    g.globalAlpha = 1;

    // degree-tick bezel around the outer ring
    const bezelR = maxR;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180, long = deg % 30 === 0;
      const r0 = bezelR - (long ? 14 : 7);
      g.globalAlpha = long ? 0.65 : 0.32;
      g.lineWidth = long ? 1.6 : 1;
      g.strokeStyle = BEZEL;
      g.beginPath();
      g.moveTo(CENTER.x + Math.cos(a) * r0, CENTER.y + Math.sin(a) * r0);
      g.lineTo(CENTER.x + Math.cos(a) * bezelR, CENTER.y + Math.sin(a) * bezelR);
      g.stroke();
    }
    g.globalAlpha = 1;

    // world border — brushed-steel double frame + brass corner rivets
    g.strokeStyle = BEZEL; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, WORLD - 3, WORLD - 3);
    g.strokeStyle = "rgba(58,66,56,.5)"; g.lineWidth = 1;
    g.strokeRect(6, 6, WORLD - 12, WORLD - 12);
    g.fillStyle = BRASS;
    for (const [cx, cy] of [[10, 10], [WORLD - 10, 10], [WORLD - 10, WORLD - 10], [10, WORLD - 10]]) {
      g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    }

    // multiplayer zone dividers — geometry only; live labels drawn per-frame
    if (this.players.length > 1) {
      const half = WORLD / 2;
      g.save(); g.setLineDash([10, 6]); g.strokeStyle = "rgba(232,227,211,.12)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(half, 0); g.lineTo(half, WORLD); g.stroke();
      if (this.players.length >= 3) { g.beginPath(); g.moveTo(0, half); g.lineTo(WORLD, half); g.stroke(); }
      g.restore();
    }

    // path trenches — groove + floor + phosphor core; fork-1 as dashed alternate
    g.lineCap = "round"; g.lineJoin = "round";
    for (let k = 0; k < 4; k++) {
      for (let f = 0; f < 2; f++) {
        const path = PATH_VARIANTS[k][f];
        const alt = f === 1;
        g.strokeStyle = alt ? "rgba(20,36,23,.28)" : "rgba(20,36,23,.6)";
        g.lineWidth = PATH_W;
        if (alt) g.setLineDash([8, 10]);
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length; i++) g.lineTo(path[i][0], path[i][1]);
        g.stroke();
        if (!alt) {
          g.setLineDash([]);
          g.strokeStyle = "rgba(10,20,12,.65)"; g.lineWidth = PATH_W - 10; g.stroke();
          g.strokeStyle = DECAY.after; g.globalAlpha = 0.9; g.lineWidth = 2.2; g.stroke();
          g.globalAlpha = 1;
          // hatch marks every ~cell along trench
          g.strokeStyle = "rgba(58,66,56,.35)"; g.lineWidth = 1;
          for (let i = 0; i < path.length - 1; i++) {
            const ax = path[i][0], ay = path[i][1], bx = path[i + 1][0], by = path[i + 1][1];
            const len = Math.hypot(bx - ax, by - ay) || 1;
            const nx = -(by - ay) / len, ny = (bx - ax) / len;
            for (let d = 20; d < len; d += 40) {
              const x = ax + (bx - ax) * (d / len), y = ay + (by - ay) * (d / len);
              g.beginPath(); g.moveTo(x + nx * 6, y + ny * 6); g.lineTo(x - nx * 6, y - ny * 6); g.stroke();
            }
          }
        } else {
          g.strokeStyle = DECAY.after; g.globalAlpha = 0.35; g.lineWidth = 1.5; g.stroke();
          g.globalAlpha = 1; g.setLineDash([]);
        }
      }
    }

    // corner spawn pads — brass rivet + ring + call-sign
    g.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    ENTRIES.forEach((c, i) => {
      const [sx, sy] = c;
      g.fillStyle = "rgba(20,36,23,.8)"; g.beginPath(); g.arc(sx, sy, 14, 0, Math.PI * 2); g.fill();
      g.fillStyle = BRASS; g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = BRASS; g.globalAlpha = 0.75; g.lineWidth = 1.5;
      g.beginPath(); g.arc(sx, sy, 10, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.55; g.fillStyle = BRASS;
      const cOff = [[-28, -28], [28, -28], [28, 28], [-28, 28]];
      g.fillText(CALLSIGNS[i], sx + cOff[i][0], sy + cOff[i][1]);
      g.globalAlpha = 1;
    });

    // starter-pocket ticks (WC3 worker spots)
    g.strokeStyle = BRASS; g.globalAlpha = 0.5; g.lineWidth = 1.4;
    for (const p of POSITIONS) {
      g.beginPath();
      g.moveTo(p.x - 7, p.y); g.lineTo(p.x + 7, p.y);
      g.moveTo(p.x, p.y - 7); g.lineTo(p.x, p.y + 7);
      g.stroke();
      g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.stroke();
    }
    g.globalAlpha = 1;

    // center bezel dish — green circle landmark housing
    g.strokeStyle = BEZEL; g.lineWidth = 3;
    g.beginPath(); g.arc(CENTER.x, CENTER.y, 28, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = BRASS; g.globalAlpha = 0.45; g.lineWidth = 1.5;
    g.beginPath(); g.arc(CENTER.x, CENTER.y, 34, 0, Math.PI * 2); g.stroke();
    g.fillStyle = BRASS; g.globalAlpha = 0.65;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath(); g.arc(CENTER.x + Math.cos(a) * 28, CENTER.y + Math.sin(a) * 28, 1.8, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // Phosphor-trail layer: faded (not cleared) each frame, so bright marks —
  // the PPI sweep, creep blips, bullet tracers — persist and decay like a
  // real scope. Composited under the sharp live-render layer in draw().
  drawTrailLayer() {
    const tctx = this.trailCtx;
    tctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    tctx.fillStyle = "rgba(6,10,6,0.19)";
    tctx.fillRect(0, 0, this.cssW, this.cssH);

    tctx.save();
    tctx.scale(this.cam.zoom, this.cam.zoom);
    tctx.translate(-this.cam.x, -this.cam.y);
    if (this._shake && this._shake.t > 0) {
      const pct = this._shake.t / this._shake.dur;
      const s = this._shake.intensity * pct / this.cam.zoom;
      tctx.translate((Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
    }
    tctx.globalCompositeOperation = "lighter";

    // global sweep arm — alpha-stepped triangular slices trailing the beam
    // (deliberately not a conic gradient — crisper trailing-wedge read)
    const slices = 14, sliceW = (Math.PI * 2) / 90, sweepR = WORLD * 0.78;
    tctx.fillStyle = DECAY.hot;
    for (let i = 0; i < slices; i++) {
      const a0 = this.sweepAngle - i * sliceW, a1 = a0 - sliceW;
      tctx.globalAlpha = 0.05 * (1 - i / slices);
      tctx.beginPath();
      tctx.moveTo(CENTER.x, CENTER.y);
      tctx.arc(CENTER.x, CENTER.y, sweepR, a0, a1, true);
      tctx.closePath(); tctx.fill();
    }

    // creep phosphor blips — leave a brief bright trace as they move
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      tctx.globalAlpha = 0.5;
      tctx.fillStyle = en.color;
      tctx.beginPath(); tctx.arc(en.x, en.y, 3, 0, Math.PI * 2); tctx.fill();
    }

    // bullet tracer afterglow
    tctx.globalAlpha = 0.45; tctx.strokeStyle = DECAY.hot; tctx.lineWidth = 3;
    for (const b of this.bullets) {
      tctx.beginPath(); tctx.moveTo(b.x1, b.y1); tctx.lineTo(b.x2, b.y2); tctx.stroke();
    }

    tctx.globalAlpha = 1;
    tctx.globalCompositeOperation = "source-over";
    tctx.restore();
  }

  draw(dt) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = VOID_OUTER; ctx.fillRect(0, 0, this.cssW, this.cssH);

    this.drawTrailLayer();
    // composite the trail (device-pixel 1:1 blit, screen space) UNDER the sharp layer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.trailCanvas, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    ctx.save();
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    // Screen shake — world-space offset only, HUD unaffected
    if (this._shake && this._shake.t > 0) {
      const pct = this._shake.t / this._shake.dur;
      const s = this._shake.intensity * pct / this.cam.zoom;
      ctx.translate((Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
    }

    // cached static world layer (void gradient + range rings + bezel + paths + ticks)
    ctx.drawImage(this.staticLayer, 0, 0, WORLD, WORLD);

    // the green circle — beacon intensity tracks leak threat / boss / low lives
    const threat = this._centerThreat || 0;
    const cpulse = this.reducedMotion ? 0.5 : (0.5 + 0.5 * Math.sin(this.gameTime * (2.4 + threat * 2)));
    const cr = 8 + cpulse * 3 + threat * 6;
    ctx.fillStyle = threat > 0.75 ? THREAT.crit : DECAY.hot;
    ctx.globalAlpha = 0.85 + threat * 0.15;
    ctx.beginPath(); ctx.arc(CENTER.x, CENTER.y, cr, 0, 7); ctx.fill();
    ctx.strokeStyle = DECAY.core; ctx.globalAlpha = 0.35 + threat * 0.4; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(CENTER.x, CENTER.y, 18 + cpulse * 4 + threat * 8, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;

    // multiplayer zone call-signs — live (active-player emphasis changes every frame)
    if (this.players.length > 1) {
      ctx.font = "700 20px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const lp = { 2: [[MAZE_IN + 70, WORLD / 2], [WORLD - MAZE_IN - 70, WORLD / 2]], 3: [[MAZE_IN + 70, MAZE_IN + 70], [WORLD - MAZE_IN - 70, MAZE_IN + 70], [WORLD / 2, WORLD - MAZE_IN - 70]], 4: [[MAZE_IN + 70, MAZE_IN + 70], [WORLD - MAZE_IN - 70, MAZE_IN + 70], [WORLD - MAZE_IN - 70, WORLD - MAZE_IN - 70], [MAZE_IN + 70, WORLD - MAZE_IN - 70]] }[this.players.length] || [];
      lp.forEach((pos, i) => {
        ctx.globalAlpha = i === this.activePlayer ? 0.92 : 0.28;
        ctx.fillStyle = this.players[i].color;
        ctx.fillText(CALLSIGNS[i] || this.players[i].name, pos[0], pos[1]);
      });
      ctx.globalAlpha = 1;
    }

    // build hover preview
    if (this.hoverWorld && this.state === "running") {
      const { c, r } = this.cellOf(this.hoverWorld.x, this.hoverWorld.y);
      const def = TOWERS[this.selected];
      const ok = this.gold >= def.cost && this.cellBuildable(c, r);
      ctx.fillStyle = ok ? "rgba(124,252,138,.22)" : "rgba(161,58,46,.26)";
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      const ctr = this.cellCenter(c, r);
      if (ok && def.range > 0) {
        ctx.strokeStyle = "rgba(232,227,211,.22)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, def.range, 0, 7); ctx.stroke();
      }
      if (ok && def.aura) {
        ctx.strokeStyle = "rgba(232,227,211,.16)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, def.aura.radius, 0, 7); ctx.stroke();
      }
    }

    // towers
    for (const tw of this.towers) this.drawTower(ctx, tw, dt || 0.016);
    // selected-tower highlight + range
    const sel = this.selectedTower;
    if (sel && this.towers.includes(sel)) {
      ctx.strokeStyle = "rgba(232,227,211,.85)"; ctx.lineWidth = 2;
      this.round(sel.c * CELL + 3, sel.r * CELL + 3, CELL - 6, CELL - 6, 7); ctx.stroke();
      if (sel.s.range > 0) { ctx.strokeStyle = "rgba(124,252,138,.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.range, 0, 7); ctx.stroke(); }
      if (sel.s.aura) { ctx.strokeStyle = "rgba(232,227,211,.22)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.aura.radius, 0, 7); ctx.stroke(); }
    }

    // bullets/beams — the decay ramp carries all "aliveness"; 'lighter' composite
    // makes overlapping shots accumulate into bright phosphor beams
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      const a = clamp(b.t / 0.09, 0, 1);
      ctx.strokeStyle = DECAY.core; ctx.lineWidth = 5; ctx.globalAlpha = a * 0.4;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = DECAY.hot; ctx.lineWidth = 2; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // enemies
    for (const en of this.enemies) { if (en.hp > 0) this.drawCreep(ctx, en); }

    // effects on top — 'lighter' makes death puffs and muzzle flashes additively glow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawFx(ctx);
    ctx.restore();

    ctx.restore(); // end world transform

    this.drawVignette(); // screen-space radial gradient — darkens edges, focuses center
    this.drawMinimap();  // minimap draws over vignette
    ctx.lineWidth = 1;
  }

  // ---- procedural sprites
  // Radial decay-ramp gradients are defined in LOCAL (untranslated) space and
  // reused every frame for every creep of a given radius bucket — the canvas
  // resolves gradient coordinates against the CTM at fill time, so one cached
  // gradient per radius correctly re-centers under each creep's translate().
  getDecayGradient(ctx, rad) {
    const key = Math.round(rad * 4);
    let grad = this._decayGrad[key];
    if (!grad) {
      grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      grad.addColorStop(0, DECAY.hot);
      grad.addColorStop(0.45, DECAY.core);
      grad.addColorStop(0.8, DECAY.mid);
      grad.addColorStop(1, DECAY.after);
      this._decayGrad[key] = grad;
    }
    return grad;
  }

  // Static tick-marked bezel housing — built once per tower instance (cheap:
  // one small offscreen canvas), then just blitted every frame instead of
  // re-stroking the ring/rivets each time.
  buildTowerBezel() {
    const S = 30, R = S / 2;
    const cv = document.createElement("canvas"); cv.width = S; cv.height = S;
    const g = cv.getContext("2d");
    g.fillStyle = "#0e1a12";
    this.round(1, 1, S - 2, S - 2, 7, g); g.fill();
    g.fillStyle = "#16271b"; g.beginPath(); g.arc(R, R, 12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = BEZEL; g.lineWidth = 1.4; g.globalAlpha = 0.85;
    g.beginPath(); g.arc(R, R, 13.5, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1; g.strokeStyle = BRASS; g.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r1 = i % 2 === 0 ? 16 : 15;
      g.beginPath();
      g.moveTo(R + Math.cos(a) * 13.5, R + Math.sin(a) * 13.5);
      g.lineTo(R + Math.cos(a) * r1, R + Math.sin(a) * r1);
      g.stroke();
    }
    return cv;
  }
  drawTower(ctx, tw, dt) {
    const x = tw.x, y = tw.y, s = tw.s, col = tw.def.color, t = this.gameTime;
    const kind = s.aura ? "aura" : s.income && !s.dtype ? "mint" : tw.type === "frost" ? "crystal" : (tw.type === "poison" && !s.splash) ? "orb" : tw.type === "detector" ? "radar" : tw.type === "void" ? "void" : "barrel";
    const selected = this.selectedTower === tw;
    let target = null;
    if (kind === "barrel" || kind === "crystal" || kind === "orb" || (kind === "void")) {
      target = this.pickTargets(tw, 1)[0];
      if (target) {
        let a = Math.atan2(target.y - y, target.x - x), d = a - tw.angle;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        tw.angle += d * (this.reducedMotion ? 1 : 0.28);
      }
    } else if (kind === "radar" && !this.reducedMotion) tw.angle += 0.06;
    if (tw.recoil > 0) tw.recoil = Math.max(0, tw.recoil - dt * 6);

    if (!tw._bezel) tw._bezel = this.buildTowerBezel();
    ctx.drawImage(tw._bezel, x - 15, y - 15, 30, 30);

    // Range wedge only when selected/hovered/placing — cuts clutter
    const hover = this.hoverWorld && Math.hypot(this.hoverWorld.x - x, this.hoverWorld.y - y) < CELL;
    if (s.range > 0 && (selected || hover)) {
      if (target === null) target = this.pickTargets(tw, 1)[0];
      if (tw._wedgeAngle == null) tw._wedgeAngle = -Math.PI / 2;
      if (target) {
        let a = Math.atan2(target.y - y, target.x - x), d = a - tw._wedgeAngle;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        tw._wedgeAngle += d * 0.35;
      } else if (!this.reducedMotion) tw._wedgeAngle += dt * 0.7;
      const firing = t - tw.lastFire < MOTION.snap;
      const wedgeW = firing ? 0.28 : 0.48;
      ctx.save();
      ctx.globalAlpha = firing ? 0.22 : 0.12;
      ctx.fillStyle = DECAY.hot;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, s.range, tw._wedgeAngle - wedgeW / 2, tw._wedgeAngle + wedgeW / 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (s.aura) {
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = col;
      ctx.globalAlpha = selected ? 0.35 : 0.14;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, s.aura.radius, 0, 7); ctx.stroke();
      ctx.restore();
    }

    // Level glow via alpha ring (avoid per-frame shadowBlur)
    ctx.strokeStyle = col;
    ctx.globalAlpha = tw.spec ? 0.95 : tw.level === 3 ? 0.8 : tw.level === 2 ? 0.55 : 0.35;
    ctx.lineWidth = tw.spec ? 2.6 : 2;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = col;
    const recoil = (tw.recoil || 0) * 3;
    if (kind === "barrel") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tw.angle);
      const n = s.multishot || (tw.type === "rapid" ? 2 : 1), len = 9 + Math.min(15, s.range / 42) - recoil;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 4.2; ctx.fillRect(2, off - 1.7, len, 3.4); }
      if (s.splash) { ctx.beginPath(); ctx.arc(2 + len, 0, 4, 0, 7); ctx.fill(); }
      ctx.restore();
    } else if (kind === "crystal") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.reducedMotion ? 0 : t * 0.7);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 0); ctx.lineTo(0, 9); ctx.lineTo(-6.5, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3.2, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (kind === "orb") {
      const swirl = this.reducedMotion ? 0 : Math.sin(t * 3) * 1.2;
      ctx.beginPath(); ctx.arc(x, y - 1 + swirl * 0.3, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(x - 2, y - 3, 2, 0, 7); ctx.fill();
    } else if (kind === "radar") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tw.angle);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(13, 0, 2.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(0, 0, 11, -0.4, 0.4); ctx.stroke();
      ctx.restore();
    } else if (kind === "mint") {
      const coinColors = ["#92400e", "#ca8a04", "#fde047"];
      for (let i = 0; i < 3; i++) {
        const cy = y + (1 - i) * 3.2;
        ctx.fillStyle = coinColors[i]; ctx.beginPath(); ctx.ellipse(x, cy, 7, 3.6, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.fillStyle = "#713f12"; ctx.font = "bold 7px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("g", x, y - 3);
    } else if (kind === "void") {
      const pulse = this.reducedMotion ? 0.5 : (0.5 + 0.5 * Math.sin(t * 3.5));
      ctx.fillStyle = "#1a0a22"; ctx.beginPath(); ctx.arc(x, y, 7 + pulse * 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, 5 + pulse, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.reducedMotion ? 0 : t * 1.9);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 3.5, 0, 0, 7); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (kind === "aura") {
      const pulse = this.reducedMotion ? 0.5 : (0.5 + 0.5 * Math.sin(t * 2.2));
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + 0.4 * pulse; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 9 + pulse * 2, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const tx = tw.c * CELL, ty = tw.r * CELL;
    if (tw.spec) { ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.moveTo(x, ty + 3); ctx.lineTo(x + 5, ty + 8); ctx.lineTo(x, ty + 13); ctx.lineTo(x - 5, ty + 8); ctx.closePath(); ctx.fill(); }
    else for (let i = 0; i < tw.level; i++) { ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.arc(tx + 9 + i * 7, ty + 8, 2.1, 0, 7); ctx.fill(); }
  }

  drawCreep(ctx, en) {
    const t = this.gameTime, boss = en.flags.includes("boss"), hero = en.flags.includes("hero"), air = en.flags.includes("air");
    const rad = boss ? 17 : hero ? 12 : en.enemy === "Swarm" ? 6 : 9;
    const inv = en.flags.includes("invisible") && !en.revealed;
    const ang = en.path
      ? Math.atan2(en.path[Math.min(en.wp + 1, en.path.length - 1)][1] - en.y, en.path[Math.min(en.wp + 1, en.path.length - 1)][0] - en.x)
      : (en.netAng ?? 0); // online: server-sent heading
    const bob = Math.sin(t * 6 + (en.x + en.y) * 0.05);
    const lift = air ? 7 + bob * 2 : 0;
    // Threat tier — shape (unchanged 6-shape vocabulary) still does the
    // primary identification; tier only adds a rim/tick/pulse accent, never
    // a new fill hue. base = decay ramp only · warn = armored/immune (amber)
    // · crit = hero/boss (grease-red).
    const tier = boss || hero ? "crit" : (en.flags.includes("immune") || en.enemy === "Armored") ? "warn" : "base";
    const rim = tier === "crit" ? THREAT.crit : tier === "warn" ? THREAT.warn : DECAY.hot;
    if (air) { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(en.x, en.y + rad + 4, rad * 0.9, rad * 0.4, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.globalAlpha = inv ? 0.22 : 1; ctx.translate(en.x, en.y - lift);
    ctx.fillStyle = this.getDecayGradient(ctx, rad);
    if (en.enemy === "Swift") {
      ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(rad * 1.1, 0); ctx.lineTo(-rad * 0.65, rad * 0.7); ctx.lineTo(-rad * 0.25, 0); ctx.lineTo(-rad * 0.65, -rad * 0.7); ctx.closePath(); ctx.fill();
    } else if (air) {
      ctx.save(); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(0, 0, rad * 0.55, rad * 0.28, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-rad * 0.2, 0); ctx.lineTo(rad * 0.1, -rad * 1.15); ctx.lineTo(rad * 0.55, -rad * 0.25); ctx.lineTo(rad * 0.1, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-rad * 0.2, 0); ctx.lineTo(rad * 0.1, rad * 1.15); ctx.lineTo(rad * 0.55, rad * 0.25); ctx.lineTo(rad * 0.1, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (en.enemy === "Swarm") {
      ctx.beginPath(); ctx.moveTo(0, -rad * 1.15); ctx.lineTo(rad * 0.85, 0); ctx.lineTo(0, rad * 1.15); ctx.lineTo(-rad * 0.85, 0); ctx.closePath(); ctx.fill();
    } else if (en.enemy === "Armored") {
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const px = Math.cos(a) * rad, py = Math.sin(a) * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55); ctx.stroke(); }
      { const ga = ctx.globalAlpha; ctx.strokeStyle = rim; ctx.globalAlpha = ga * 0.7;
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; i ? ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad) : ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad); } ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = ga; }
    } else if (en.flags.includes("immune")) {
      ctx.beginPath(); ctx.moveTo(0, -rad * 1.2); ctx.lineTo(rad * 0.95, -rad * 0.45); ctx.lineTo(rad * 0.95, rad * 0.25); ctx.quadraticCurveTo(0, rad * 1.45, -rad * 0.95, rad * 0.25); ctx.lineTo(-rad * 0.95, -rad * 0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.moveTo(0, -rad * 0.75); ctx.lineTo(rad * 0.55, -rad * 0.2); ctx.lineTo(rad * 0.55, rad * 0.1); ctx.quadraticCurveTo(0, rad * 0.85, -rad * 0.55, rad * 0.1); ctx.lineTo(-rad * 0.55, -rad * 0.2); ctx.closePath(); ctx.fill();
    } else if (hero) {
      const r = rad * (1 + 0.05 * Math.sin(t * 4));
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2; const rr = i % 2 === 0 ? r : r * 0.42; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2; const rr = i % 2 === 0 ? r * 0.52 : r * 0.22; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    } else if (boss) {
      const r = rad * (1 + 0.07 * Math.sin(t * 3));
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const rr = i % 2 === 0 ? r * 1.38 : r * 0.68; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.arc(-rad * 0.28, -rad * 0.28, rad * 0.38, 0, 7); ctx.fill();
    }
    // thin bright rim stroke (base tier: dim decay-hot edge · warn/crit: the
    // tier accent) — every archetype gets one, boss/hero read widest
    {
      const ga = ctx.globalAlpha, ringR = rad + (boss ? 3 : hero ? 2.5 : 1.8);
      ctx.strokeStyle = rim; ctx.lineWidth = tier === "base" ? 1.2 : 1.8;
      ctx.globalAlpha = ga * (tier === "base" ? 0.55 : 0.9);
      ctx.beginPath(); ctx.arc(0, 0, ringR, 0, 7); ctx.stroke();
      // 1-2 short corner tick marks — circuit-trace detail (Bearing Zero graft)
      ctx.lineWidth = 1;
      for (const da of [-0.55, 0.55]) {
        const a = -Math.PI / 2 + da;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * ringR, Math.sin(a) * ringR);
        ctx.lineTo(Math.cos(a) * (ringR + 3.5), Math.sin(a) * (ringR + 3.5));
        ctx.stroke();
      }
      ctx.globalAlpha = ga;
    }
    // hazard-chevron corner tick for the two threat tiers — pulse rate (not
    // hue) separates armored/warning from boss/critical
    if (tier !== "base") {
      const pr = tier === "crit" ? 5.5 : 3.2, p = 0.5 + 0.5 * Math.sin(t * pr);
      const ga = ctx.globalAlpha, cy = -(rad + 6.5);
      ctx.globalAlpha = ga * (0.45 + p * 0.5);
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.moveTo(-3.2, cy + 3.4); ctx.lineTo(0, cy); ctx.lineTo(3.2, cy + 3.4); ctx.lineTo(0, cy + 1.7); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = ga;
    }
    ctx.restore();
    // Status glyphs (phosphor ticks, not candy dots)
    if (t < en.slowUntil) {
      ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.arc(en.x, en.y - lift, rad + 3.5, a - 0.25, a + 0.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (en.poison > 0 && t < en.poisonUntil) {
      ctx.fillStyle = "rgba(132,204,22,.75)";
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        const px = en.x + Math.cos(a) * rad * 0.7;
        const py = en.y - lift - rad - 2 - ((t * 20 + i * 5) % 10);
        ctx.fillRect(px - 1, py - 2, 2, 3);
      }
    }
    if (en.revealFlash && t < en.revealFlash) {
      ctx.strokeStyle = DECAY.hot; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(en.x, en.y - lift, rad + 2, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (inv) {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(214,175,255,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(en.x, en.y - lift, rad + 1.5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    // Boss phase ring segments
    if (boss && en.phase >= 2) {
      ctx.strokeStyle = THREAT.crit; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      const segs = en.phase >= 3 ? 3 : 2;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2 + t * 0.8;
        ctx.beginPath(); ctx.arc(en.x, en.y - lift, rad + 6, a0, a0 + Math.PI / segs); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const hpf = clamp(en.hp / en.maxHp, 0, 1);
    if (hpf < 0.999) {
      const w = rad * 2 + 6, yb = en.y - lift - rad - 8;
      ctx.fillStyle = "rgba(0,0,0,.6)"; this.round(en.x - w / 2, yb, w, 3.6, 1.6); ctx.fill();
      if (boss) {
        // segmented phase bar
        ctx.fillStyle = hpf > 0.6 ? DECAY.core : hpf > 0.25 ? THREAT.warn : THREAT.crit;
        this.round(en.x - w / 2, yb, w * hpf, 3.6, 1.6); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(en.x - w / 2 + w * 0.6, yb); ctx.lineTo(en.x - w / 2 + w * 0.6, yb + 3.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(en.x - w / 2 + w * 0.25, yb); ctx.lineTo(en.x - w / 2 + w * 0.25, yb + 3.6); ctx.stroke();
      } else {
        ctx.fillStyle = hpf > 0.5 ? "#4ade80" : hpf > 0.25 ? "#facc15" : "#f87171";
        this.round(en.x - w / 2, yb, w * hpf, 3.6, 1.6); ctx.fill();
      }
    }
  }

  drawFx(ctx) {
    for (const p of this.fx) {
      const a = clamp(p.t / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === "splash" || p.kind === "ring" || p.kind === "build") {
        const r = p.r * (1.2 - a * 0.4);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.kind === "build" ? 2 : 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
      } else if (p.kind === "muzzle" && p.angle != null) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.dtype === "chaos") {
          ctx.fillStyle = "#0a060c"; ctx.beginPath(); ctx.arc(0, 0, p.r * a + 3, 0, 7); ctx.fill();
          ctx.strokeStyle = DECAY.hot; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r * a + 4, 0, 7); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.ellipse(0, 0, (p.r * a + 4) * (p.dtype === "siege" ? 1.4 : 1), p.r * a * 0.5 + 1.5, 0, 0, 7); ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === "muzzle" ? p.r * a + 2 : p.r * a, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // small fixed minimap so you always know where the action is while panning
  drawMinimap() {
    const ctx = this.ctx, S = 116, pad = 10;
    const x0 = this.cssW - S - pad, y0 = this.cssH - S - pad, k = S / WORLD;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = VOID_INNER; ctx.strokeStyle = BEZEL; ctx.lineWidth = 1;
    ctx.fillRect(x0, y0, S, S); ctx.strokeRect(x0, y0, S, S);
    ctx.strokeStyle = "rgba(28,61,34,.7)"; // afterglow-tone, dimmer than the live layer
    for (const path of PATHS) {
      ctx.beginPath(); ctx.moveTo(x0 + path[0][0] * k, y0 + path[0][1] * k);
      for (let i = 1; i < path.length; i++) ctx.lineTo(x0 + path[i][0] * k, y0 + path[i][1] * k);
      ctx.stroke();
    }
    ctx.fillStyle = DECAY.hot; ctx.fillRect(x0 + CENTER.x * k - 2, y0 + CENTER.y * k - 2, 4, 4);
    // enemy dots already carry their threat-tier color — a quick-read legend for free
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      ctx.fillStyle = en.color; ctx.fillRect(x0 + en.x * k - 1, y0 + en.y * k - 1, 2, 2);
    }
    // viewport rectangle
    const vw = this.cssW / this.cam.zoom, vh = this.cssH / this.cam.zoom;
    ctx.strokeStyle = "rgba(232,227,211,.5)";
    ctx.strokeRect(x0 + this.cam.x * k, y0 + this.cam.y * k, vw * k, vh * k);
    ctx.restore();
  }

  drawVignette() {
    // Screen-space radial vignette — pulls the eye toward the field center
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    const inner = Math.min(W, H) * 0.26, outer = Math.max(W, H) * 0.78;
    const g = ctx.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, outer);
    g.addColorStop(0, "rgba(6,10,6,0)");
    g.addColorStop(1, "rgba(6,10,6,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  round(x, y, w, h, r, ctx = this.ctx) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}

window.__gctd = new Game();

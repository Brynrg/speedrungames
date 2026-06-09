"use strict";
/*
 * Green Circle TD — web tower defense for speedrungames.net.
 *
 * Faithful to the original: creeps spawn from the FOUR CORNERS and follow
 * logarithmic spiral paths that wind inward to the center (the "green circle").
 * Leak = a creep reaches the center. Place towers in the gaps between the
 * spiral arms; match damage type to enemy armor. 30 escalating waves to a boss.
 *
 * The world is larger than the viewport: pan (drag / WASD / arrows) and zoom
 * (wheel) the field, while the top bar + sidebar stay fixed. Content
 * (towers/enemies/armor/waves) and the spiral geometry are ported from the
 * original Python game's data + core/path.py.
 */

// ----------------------------------------------------------------- data (ported)
const ARMOR_MATRIX = {
  pierce: { light: 2.0, medium: 0.75, heavy: 1.0, fortified: 0.35, hero: 0.5 },
  siege:  { light: 1.0, medium: 0.5,  heavy: 1.0, fortified: 1.5,  hero: 0.5 },
  magic:  { light: 1.25,medium: 0.75, heavy: 2.0, fortified: 0.35, hero: 0.5 },
  normal: { light: 1.0, medium: 1.5,  heavy: 1.0, fortified: 0.7,  hero: 1.0 },
};

const ENEMIES = {
  Normal:    { color: "rgb(138,255,148)", count_bonus: 0,  health_mult: 1.0,  speed_mult: 1.0,  bounty_bonus: 0,  flags: [], armor: "medium" },
  Swift:     { color: "rgb(112,220,255)", count_bonus: 1,  health_mult: 0.85, speed_mult: 1.34, bounty_bonus: 1,  flags: [], armor: "light" },
  Armored:   { color: "rgb(255,196,90)",  count_bonus: -1, health_mult: 1.75, speed_mult: 0.82, bounty_bonus: 5,  flags: [], armor: "heavy" },
  Swarm:     { color: "rgb(142,255,121)", count_bonus: 5,  health_mult: 0.62, speed_mult: 1.08, bounty_bonus: 0,  flags: [], armor: "light" },
  Air:       { color: "rgb(132,220,255)", count_bonus: 0,  health_mult: 0.95, speed_mult: 1.18, bounty_bonus: 3,  flags: ["air"], armor: "light" },
  Immune:    { color: "rgb(255,235,120)", count_bonus: -1, health_mult: 1.25, speed_mult: 0.95, bounty_bonus: 4,  flags: ["immune"], armor: "fortified" },
  Invisible: { color: "rgb(214,175,255)", count_bonus: 0,  health_mult: 1.05, speed_mult: 1.04, bounty_bonus: 6,  flags: ["invisible"], armor: "medium" },
  Hero:      { color: "rgb(255,155,72)",  count_bonus: -3, health_mult: 2.65, speed_mult: 0.82, bounty_bonus: 12, flags: ["hero"], armor: "hero" },
  Boss:      { color: "rgb(255,94,94)",   count_bonus: -4, health_mult: 4.2,  speed_mult: 0.72, bounty_bonus: 20, flags: ["boss", "immune"], armor: "fortified" },
};

const RANGE_SCALE = 0.78;
const T = (o) => ({ ...o, range: (o.range || 0) * RANGE_SCALE });
const TOWERS = {
  basic:    T({ name: "Basic",   key: "1", range: 200, damage: 25, cd: 30, cost: 100, color: "rgb(42,178,84)",  dtype: "normal", desc: "Normal dmg, cheap" }),
  sniper:   T({ name: "Sniper",  key: "2", range: 350, damage: 75, cd: 90, cost: 200, color: "rgb(64,215,255)", dtype: "pierce", desc: "Long-range pierce" }),
  rapid:    T({ name: "Rapid",   key: "3", range: 120, damage: 10, cd: 10, cost: 150, color: "rgb(255,146,41)", dtype: "pierce", desc: "Fast pierce" }),
  splash:   T({ name: "Splash",  key: "4", range: 180, damage: 40, cd: 60, cost: 180, color: "rgb(178,92,255)", dtype: "siege", splash: 80, desc: "Siege AoE" }),
  frost:    T({ name: "Frost",   key: "5", range: 175, damage: 14, cd: 34, cost: 165, color: "rgb(102,185,255)",dtype: "magic", slow: 0.55, slowDur: 95, desc: "Magic · slows 55%" }),
  poison:   T({ name: "Poison",  key: "6", range: 185, damage: 12, cd: 36, cost: 145, color: "rgb(100,224,66)", dtype: "magic", poison: 4, poisonDur: 140, desc: "Magic + poison DoT" }),
  detector: T({ name: "Detector",key: "7", range: 230, damage: 8,  cd: 24, cost: 125, color: "rgb(255,214,78)", dtype: "normal", detect: true, desc: "Reveals invisible" }),
  damage_aura: T({ name: "Dmg Aura", key: "8", range: 0, damage: 0, cd: 0, cost: 220, color: "rgb(220,70,70)",   dtype: null, aura: { type: "dmg", radius: 160, value: 0.20 }, desc: "+20% dmg nearby" }),
  speed_aura:  T({ name: "Spd Aura", key: "9", range: 0, damage: 0, cd: 0, cost: 200, color: "rgb(220,200,70)",  dtype: null, aura: { type: "cd", radius: 150, value: 0.15 }, desc: "-15% cooldown nearby" }),
  mint:        T({ name: "Mint",    key: "0", range: 0, damage: 0, cd: 0, cost: 150, color: "rgb(253,224,71)", dtype: null, income: 8, desc: "+8g per wave cleared" }),
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
    { id: "tempest", name: "Tempest", desc: "Blistering multi-shot", mod: (s) => ({ ...s, multishot: 2, cd: Math.max(3, Math.round(s.cd * 0.7)) }) },
    { id: "shredder", name: "Shredder", desc: "Shreds heavy armor", mod: (s) => ({ ...s, dtype: "siege", damage: Math.round(s.damage * 1.6), cd: Math.round(s.cd * 1.2) }) },
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
  { id: 15, name: "Bound Watchers", hint: "Heavy flyers. Pierce anti-air weak.", reward: 90, spawns: [{ e: "Air", n: 8, iv: 0.7, at: 0 }, { e: "Air", n: 4, iv: 0.7, at: 0 }] },
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

// ----------------------------------------------------------------- world geometry
const WORLD = 1600;            // square world (px), larger than the viewport
const CENTER = { x: WORLD / 2, y: WORLD / 2 };
const CELL = 40, GRID = WORLD / CELL;
const PATH_W = 34;             // visual path width
const PATH_CLEAR = 30;         // min distance from any path to build
const BASE_SPEED = 92;         // px/s before speed_mult

const START_GOLD = 250, START_LIVES = 20;
const PB_KEY = "speedrungames:green-circle-td:pb";
const MIN_ZOOM = 0.35, MAX_ZOOM = 2.2;

// ---- The maze --------------------------------------------------------
// Faithful to the classic "Green Circle TD" board: creeps spawn in the FOUR
// corners and "run in circles to the center". Each stream circles the full
// ring (its own player first, then the other three), steps inward a notch,
// circles again — down to the leak. All four trace the same concentric
// squares, so every creep passes every player position.
const MAZE_IN = 160;              // outermost loop inset from the border
const MAZE_STEP = 150;            // spacing between loops (leaves a build gap)
const cornersAt = (i) => [[i, i], [WORLD - i, i], [WORLD - i, WORLD - i], [i, WORLD - i]]; // CW: NW,NE,SE,SW

// One creep path: enter at corner k, full loop, right-angle step inward, repeat.
function loopPath(k) {
  const pts = [];
  let inset = MAZE_IN;
  while (WORLD - 2 * inset > MAZE_STEP * 1.4) {
    const c = cornersAt(inset);
    for (let j = 0; j <= 4; j++) pts.push(c[(k + j) % 4]); // full lap, start+end at corner k
    const ci = cornersAt(inset + MAZE_STEP);
    pts.push([ci[k][0], c[k][1]]);     // notch inward (right angle, no diagonal spoke)
    inset += MAZE_STEP;                // next loop's first push completes the notch
  }
  pts.push([CENTER.x, CENTER.y]);      // leak point — the green circle
  return pts;
}
const PATHS = [0, 1, 2, 3].map(loopPath);
const ENTRIES = cornersAt(MAZE_IN);    // four spawn corners

// Eight colored "player" positions: four flanking the outer corners (each
// first-shots its nearest spawn), four deeper on an inner loop.
const POS_COLORS = ["#f87171", "#a78bfa", "#60a5fa", "#22d3ee", "#fb923c", "#4ade80", "#facc15", "#f472b6"];
const POSITIONS = (() => {
  const oc = cornersAt(MAZE_IN), mid = MAZE_IN + MAZE_STEP * 2, lo = mid, hi = WORLD - mid;
  const out = [
    { x: oc[0][0] + 58, y: oc[0][1] + 58 }, { x: oc[1][0] - 58, y: oc[1][1] + 58 },
    { x: oc[2][0] - 58, y: oc[2][1] - 58 }, { x: oc[3][0] + 58, y: oc[3][1] - 58 },
    { x: CENTER.x, y: lo + 75 }, { x: hi - 75, y: CENTER.y },
    { x: CENTER.x, y: hi - 75 }, { x: lo + 75, y: CENTER.y },
  ];
  return out.map((p, i) => ({ ...p, color: POS_COLORS[i] }));
})();

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
  for (const path of PATHS)
    for (let i = 0; i < path.length - 1; i++)
      m = Math.min(m, distToSeg(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
  return m;
}
const loadPB = () => { try { const v = localStorage.getItem(PB_KEY); return v ? +v : null; } catch { return null; } };
const savePB = (ms) => { try { localStorage.setItem(PB_KEY, String(ms)); } catch {} };

// ----------------------------------------------------------------- game
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.stage = document.getElementById("stage");
    this.dpr = 1; this.cssW = 0; this.cssH = 0;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.keys = new Set();
    this.hoverWorld = null;
    this.speed = 1;             // 1× / 2× / 3× game speed (persists across restarts)
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
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.towers = [];
    this.selectedTower = null;
    this.occupied = new Set();
    this.enemies = [];
    this.bullets = [];
    this.fx = [];                // muzzle flashes, hit sparks, death puffs
    this._shake = null;          // screen-shake state {t, dur, intensity}
    this.waveIndex = 0;
    this.spawnQueue = [];        // {time(abs sim sec), corner, hp, speed, bounty, def, enemy, rec}
    this.activeWaves = [];       // wave records in flight: {id,name,reward,pending,alive,done}
    this.state = "ready";
    this.started = false;        // becomes true on the first wave
    this.runMs = 0;              // sim-time score (independent of game-speed multiplier)
    this.elapsed = 0;
    this.gameTime = 0;
  }

  // ---- camera / viewport
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.stage.clientWidth || 800, h = this.stage.clientHeight || 600;
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
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
      b.onclick = () => { this.speed = +b.dataset.speed; this.syncSpeedSeg(); };
    });
    this.syncSpeedSeg();
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
    const restartBtn = document.getElementById("restartBtn");
    if (restartBtn) restartBtn.onclick = () => this.restart();
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
    document.getElementById("gold").textContent = `💰 ${Math.floor(this.gold)}`;
    const livesEl = document.getElementById("lives");
    livesEl.textContent = `❤ ${Math.max(0, this.lives)}`;
    livesEl.classList.toggle("low", this.lives <= 5 && this.state !== "won");
    if (this.selectedTower) this.renderInspector();
  }
  renderPB() { document.getElementById("pb").textContent = this.pb == null ? "PB —" : "PB " + fmt(this.pb); }
  setWaveText(name, hint) {
    document.getElementById("waveName").textContent = name;
    document.getElementById("waveHint").textContent = hint;
  }
  setArmorPill(types) {
    const el = document.getElementById("armorPill");
    if (!el) return;
    if (!types || !types.length) { el.classList.add("hidden"); return; }
    const ARMOR_INFO = {
      light:     { color: "#67e8f9", counter: "Pierce best" },
      medium:    { color: "#86efac", counter: "Normal best" },
      heavy:     { color: "#fb923c", counter: "Siege / Magic" },
      fortified: { color: "#a78bfa", counter: "Siege best" },
      hero:      { color: "#fbbf24", counter: "Normal best" },
    };
    const unique = [...new Set(types)];
    el.innerHTML = unique.map((a) => {
      const info = ARMOR_INFO[a] || { color: "#e8f3ea", counter: "?" };
      return `<span class="apill" style="border-color:${info.color}77;color:${info.color};background:${info.color}18">${a[0].toUpperCase()}${a.slice(1)} · ${info.counter}</span>`;
    }).join("");
    el.classList.remove("hidden");
  }

  hideOverlay() { const o = document.getElementById("overlay"); o.className = "overlay hidden"; o.innerHTML = ""; }
  overlay(html, stateClass = "") { const o = document.getElementById("overlay"); o.className = "overlay" + (stateClass ? " " + stateClass : ""); o.innerHTML = html; return o; }
  showStart() {
    const o = this.overlay(
      `<h2>🟢 Green Circle TD</h2><p>Creeps spawn at the four corners and circle inward to the center, passing every position on the way. Build towers in the gaps to stop them — match damage type to armor. Send waves early to stack them, change game speed, and survive all 30 as fast as you can.</p><button id="goBtn">Begin</button>`,
    );
    o.querySelector("#goBtn").onclick = () => { this.hideOverlay(); this.state = "running"; };
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
      `<h2>${won ? "The Crown is Yours!" : "Overrun"}</h2><p>Time ${fmt(this.elapsed)}</p><p>${sub}</p><button id="rsBtn">${won ? "Play again" : "Retry"}</button>`,
      won ? "state-won" : "state-lost",
    );
    o.querySelector("#rsBtn").onclick = () => this.restart();
    this.refreshButtons();
  }
  restart() {
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
    if (this.state === "running") this.state = "paused";
    else if (this.state === "paused") { this.state = "running"; this.last = nowMs(); }
    else return;
    this.updatePauseBtn();
    this.refreshButtons();
  }
  updatePauseBtn() {
    const b = document.getElementById("pauseBtn");
    if (b) { b.textContent = this.state === "paused" ? "▶ Resume" : "⏸ Pause"; b.classList.toggle("active", this.state === "paused"); }
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
    const ctr = this.cellCenter(c, r);
    this.towers.push({ c, r, x: ctr.x, y: ctr.y, type, def, level: 1, spec: null, invested: def.cost, s: statsFor(type, 1, null), lastFire: -999, dmgMult: 1, cdMult: 1, angle: -Math.PI / 2 });
    this.occupied.add(c + "," + r);
    this.gold -= def.cost;
    this.recomputeAuras();
    this.refreshButtons();
    return true;
  }
  // upgrade the selected tower: "level" (Lv+1) or a spec id at max level
  upgradeTower(tw, choice) {
    if (!tw || this.state !== "running") return;
    if (choice === "level" && tw.level < MAX_LEVEL) {
      const cost = upgradeCost(tw.type, tw.level);
      if (this.gold < cost) return;
      this.gold -= cost; tw.invested += cost; tw.level++;
    } else if (tw.level >= MAX_LEVEL && !tw.spec && hasSpec(tw.type) && SPECS[tw.type].some((x) => x.id === choice)) {
      const cost = specCost(tw.type);
      if (this.gold < cost) return;
      this.gold -= cost; tw.invested += cost; tw.spec = choice;
    } else return;
    tw.s = statsFor(tw.type, tw.level, tw.spec);
    this.recomputeAuras();
    this.refreshButtons();
    this.renderInspector();
  }
  sellAt(c, r) {
    const idx = this.towers.findIndex((t) => t.c === c && t.r === r);
    if (idx < 0) return;
    const tw = this.towers[idx];
    this.gold += Math.floor(tw.invested * 0.7);
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
    const sell = document.createElement("button");
    sell.className = "ibtn sell";
    sell.innerHTML = `<span>Sell</span><span class="icost">+${Math.floor(tw.invested * 0.7)}g</span>`;
    sell.onclick = () => this.sellAt(tw.c, tw.r);
    actions.appendChild(sell);
  }

  // ---- effects (muzzle flashes, hit sparks, death puffs)
  spawnFx(x, y, color, kind, angle = 0) {
    if (this.fx.length > 280) return; // cap for 3× speed / mass waves
    if (kind === "muzzle") {
      this.fx.push({ x: x + Math.cos(angle) * 14, y: y + Math.sin(angle) * 14, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30, t: 0.07, max: 0.07, color, r: 5, kind });
    } else if (kind === "spark") {
      for (let i = 0; i < 4; i++) { const a = Math.random() * 7, sp = 45 + Math.random() * 70; this.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.18, max: 0.18, color, r: 2.4, kind }); }
    } else if (kind === "puff") {
      for (let i = 0; i < 8; i++) { const a = Math.random() * 7, sp = 25 + Math.random() * 80; this.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.32, max: 0.32, color, r: 3.6, kind }); }
    }
  }

  // ---- waves (multiple may run at once — you can send the next early)
  startNextWave() {
    if (this.state !== "running" || this.waveIndex >= WAVES.length) return;
    // Aggressive-stacking bonus: +15g for sending while a wave is still live
    const stackBonus = this.activeWaves.length > 0 ? 15 : 0;
    if (stackBonus) this.gold += stackBonus;
    const w = WAVES[this.waveIndex];
    this.waveIndex++;
    this.started = true;
    const rec = { id: w.id, name: w.name, reward: w.reward, pending: 0, alive: 0, done: false };
    // Geometric HP scaling: ~+10% per wave — mid-game stays manageable, late-game gets brutal
    const hpBase = Math.round(40 * Math.pow(1.1, this.waveIndex - 1));
    w.spawns.forEach((sp, gi) => {
      const e = ENEMIES[sp.e];
      const count = Math.max(1, sp.n + e.count_bonus);
      // spread spawn groups across the four corners (faithful 4-corner play)
      const corner = (sp.corner ?? (w.id + gi)) % 4;
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({
          time: this.gameTime + sp.at + i * sp.iv, // absolute sim time → waves stack cleanly
          enemy: sp.e, def: e, corner,
          hp: hpBase * e.health_mult,
          speed: BASE_SPEED * e.speed_mult,
          bounty: 3 + Math.floor(this.waveIndex / 3) + e.bounty_bonus,
          rec,
        });
        rec.pending++;
      }
    });
    this.activeWaves.push(rec);
    this.spawnQueue.sort((a, b) => a.time - b.time);
    const waveTitle = stackBonus ? `Wave ${w.id}: ${w.name}  +${stackBonus}g ★` : `Wave ${w.id}: ${w.name}`;
    this.setWaveText(waveTitle, w.hint);
    // Show armor type pill so players know what's coming
    const armorTypes = [...new Set(w.spawns.map((sp) => ENEMIES[sp.e].armor))];
    this.setArmorPill(armorTypes);
    // Boss wave: signal danger on the wave panel + screen shake
    const wavePanel = document.getElementById("wavePanel");
    if (wavePanel) wavePanel.classList.toggle("boss-wave", !!w.boss);
    if (w.boss) this.shakeCamera(0.55, 10);
    this.refreshButtons();
  }

  spawnEnemy(s) {
    const path = PATHS[s.corner];
    s.rec.pending--; s.rec.alive++;
    this.enemies.push({
      x: path[0][0], y: path[0][1], wp: 0, path,
      hp: s.hp, maxHp: s.hp, speed: s.speed,
      def: s.def, enemy: s.enemy, bounty: s.bounty, rec: s.rec,
      flags: s.def.flags, armor: s.def.armor, color: s.def.color,
      slowUntil: 0, poison: 0, poisonUntil: 0, revealed: false,
    });
  }

  // ---- simulation
  update(dt) {
    if (this.state !== "running") return;
    this.gameTime += dt;
    if (this.started) this.runMs += dt * 1000; // score in sim-time, so game-speed never cheeses the PB
    while (this.spawnQueue.length && this.spawnQueue[0].time <= this.gameTime) this.spawnEnemy(this.spawnQueue.shift());

    const detectors = this.towers.filter((t) => t.s.detect);
    for (const en of this.enemies) {
      if (en.flags.includes("invisible"))
        en.revealed = detectors.some((d) => Math.hypot(d.x - en.x, d.y - en.y) <= d.s.range);
      else en.revealed = true;
    }

    this.moveEnemies(dt);
    this.fireTowers();
    for (const b of this.bullets) b.t -= dt;
    this.bullets = this.bullets.filter((b) => b.t > 0);
    for (const p of this.fx) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    if (this.fx.length) this.fx = this.fx.filter((p) => p.t > 0);

    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.poison > 0 && this.gameTime < en.poisonUntil) en.hp -= en.poison * dt;
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
      for (const r of cleared) { r.done = true; this.gold += r.reward; }
      this.activeWaves = this.activeWaves.filter((r) => !r.done);
      const reward = cleared.reduce((s, r) => s + r.reward, 0);
      const last = cleared[cleared.length - 1];

      // Mint income: each Mint tower pays out on wave clear
      const mintIncome = this.towers.reduce((s, tw) => s + (tw.s.income || 0), 0);
      if (mintIncome > 0) this.gold += mintIncome;

      // Interest economy (2% of current gold, capped +80) — rewards saving
      const interest = Math.min(80, Math.floor(this.gold * 0.02));
      if (interest > 0) this.gold += interest;

      // Income benchmarks: show "on pace / behind" at key waves (per Legion TD design)
      const BENCHMARKS = { 5: 400, 10: 700, 15: 1000, 20: 1400 };
      const benchTarget = BENCHMARKS[last.id];
      let benchMsg = benchTarget ? (this.gold >= benchTarget ? " · ✦ On pace!" : ` · ⚠ Behind (target ${benchTarget}g)`) : "";

      // Build the extras string
      const extras = [];
      if (mintIncome > 0) extras.push(`+${mintIncome}g mint`);
      if (interest > 0) extras.push(`+${interest}g interest`);
      const extStr = extras.length ? ` · ${extras.join(", ")}` : "";

      const wavePanel = document.getElementById("wavePanel");
      if (wavePanel) wavePanel.classList.remove("boss-wave");
      if (this.waveIndex >= WAVES.length && this.activeWaves.length === 0) { this.setWaveText("All clear", "Final wave done!"); this.setArmorPill([]); this.end(true); return; }
      const nextName = this.waveIndex < WAVES.length ? WAVES[this.waveIndex].name : "";
      const clearHint = this.waveIndex >= WAVES.length
        ? `+${reward}g${extStr}. Last waves still in flight.`
        : `+${reward}g${extStr}. Next: ${nextName}${benchMsg}`;
      this.setWaveText(`Wave ${last.id} cleared`, clearHint);
      this.setArmorPill([]);
      this.refreshButtons();
    }
    if (this.lives <= 0) this.end(false);
    if (this._shake && this._shake.t > 0) { this._shake.t -= dt; if (this._shake.t <= 0) this._shake = null; }
  }

  moveEnemies(dt) {
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const speed = en.speed * (this.gameTime < en.slowUntil ? 0.45 : 1);
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
      if (d.dtype) this.spawnFx(tw.x, tw.y, tw.def.color, "muzzle", Math.atan2(targets[0].y - tw.y, targets[0].x - tw.x));
      for (const target of targets) {
        this.bullets.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: tw.def.color, t: 0.09 });
        if (d.splash) {
          for (const en of this.enemies) {
            if (en.hp <= 0) continue;
            if (Math.hypot(en.x - target.x, en.y - target.y) <= d.splash) this.hit(en, base, d);
          }
        } else this.hit(target, base, d);
      }
    }
  }
  pickTargets(tw, n) {
    const inRange = [];
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.flags.includes("invisible") && !en.revealed) continue;
      if (Math.hypot(en.x - tw.x, en.y - tw.y) > tw.s.range) continue;
      const last = en.path.length - 1;
      const next = en.path[Math.min(en.wp + 1, last)];
      en._prog = en.wp * 10000 - Math.hypot(en.x - next[0], en.y - next[1]);
      inRange.push(en);
    }
    if (inRange.length > 1) inRange.sort((a, b) => b._prog - a._prog);
    return n <= 1 ? (inRange.length ? [inRange[0]] : []) : inRange.slice(0, n);
  }
  hit(en, base, d) {
    if (en.hp <= 0) return;
    const mult = d.dtype ? (ARMOR_MATRIX[d.dtype][en.armor] ?? 1) : 1;
    en.hp -= base * mult;
    const immune = en.flags.includes("immune");
    if (d.slow && !immune) en.slowUntil = this.gameTime + d.slowDur / 60;
    if (d.poison && !immune) { en.poison = d.poison; en.poisonUntil = this.gameTime + d.poisonDur / 60; }
    if (en.hp > 0) this.spawnFx(en.x, en.y, "#fde68a", "spark");
    if (en.hp <= 0) this.onKill(en);
  }
  onKill(en) {
    if (en._dead) return; en._dead = true;
    this.gold += en.bounty;
    this.spawnFx(en.x, en.y, en.color, "puff");
    if (en.flags.includes("boss")) this.shakeCamera(0.38, 7);
    else if (en.flags.includes("hero")) this.shakeCamera(0.18, 3);
    this.refreshButtons();
  }
  shakeCamera(duration, intensity) {
    if (this._shake && this._shake.t > 0 && intensity < this._shake.intensity) return; // don't downgrade
    this._shake = { t: duration, dur: duration, intensity };
  }
  onLeak(en) {
    const cost = en.flags.includes("boss") ? 10 : en.flags.includes("hero") ? 4 : 1;
    this.lives -= cost;
    this.refreshButtons();
  }

  // ---- loop + render
  loop() {
    const t = nowMs();
    let dt = (t - this.last) / 1000; this.last = t;
    if (dt > 0.05) dt = 0.05;
    this.panFromKeys(dt);
    // 2×/3× = run the fixed-step sim multiple times per frame (keeps physics stable)
    const steps = this.state === "running" ? this.speed : 1;
    for (let i = 0; i < steps; i++) this.update(dt);
    document.getElementById("timer").textContent = fmt(this.runMs);
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Semi-transparent fill instead of clearRect: moving enemies/bullets accumulate
    // 1-2 frame motion trails; static towers & paths are redrawn fresh → stay sharp.
    ctx.fillStyle = "rgba(12,19,13,0.87)";
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    // Screen shake — world-space offset only, HUD unaffected
    if (this._shake && this._shake.t > 0) {
      const pct = this._shake.t / this._shake.dur;
      const s = this._shake.intensity * pct / this.cam.zoom;
      ctx.translate((Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
    }

    // world border
    ctx.strokeStyle = "#152017"; ctx.lineWidth = 2; ctx.strokeRect(0, 0, WORLD, WORLD);

    // spiral paths (the green circle)
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const path of PATHS) {
      ctx.strokeStyle = "#243a29"; ctx.lineWidth = PATH_W;
      ctx.beginPath(); ctx.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
      ctx.stroke();
      ctx.strokeStyle = "#172419"; ctx.lineWidth = PATH_W - 8; ctx.stroke();
      // Worn centre highlight — gives dirt-track depth without any asset
      ctx.strokeStyle = "rgba(134,239,172,.048)"; ctx.lineWidth = 2; ctx.stroke();
    }
    // corner spawn markers
    for (const path of PATHS) {
      ctx.fillStyle = "rgba(248,113,113,.8)";
      ctx.beginPath(); ctx.arc(path[0][0], path[0][1], 9, 0, 7); ctx.fill();
    }
    // player positions (the colored marks every creep passes)
    ctx.font = "bold 26px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const p of POSITIONS) { ctx.fillStyle = p.color; ctx.fillText("✶", p.x, p.y); }

    // center base
    ctx.fillStyle = "#86efac"; ctx.beginPath(); ctx.arc(CENTER.x, CENTER.y, 18, 0, 7); ctx.fill();
    ctx.fillStyle = "#07120a"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("◎", CENTER.x, CENTER.y);

    // build hover preview
    if (this.hoverWorld && this.state === "running") {
      const { c, r } = this.cellOf(this.hoverWorld.x, this.hoverWorld.y);
      const def = TOWERS[this.selected];
      const ok = this.gold >= def.cost && this.cellBuildable(c, r);
      ctx.fillStyle = ok ? "rgba(134,239,172,.22)" : "rgba(248,113,113,.22)";
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      const ctr = this.cellCenter(c, r);
      if (ok && def.range > 0) {
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, def.range, 0, 7); ctx.stroke();
      }
      if (ok && def.aura) {
        ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, def.aura.radius, 0, 7); ctx.stroke();
      }
    }

    // towers
    for (const tw of this.towers) this.drawTower(ctx, tw);
    // selected-tower highlight + range
    const sel = this.selectedTower;
    if (sel && this.towers.includes(sel)) {
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
      this.round(sel.c * CELL + 3, sel.r * CELL + 3, CELL - 6, CELL - 6, 7); ctx.stroke();
      if (sel.s.range > 0) { ctx.strokeStyle = "rgba(134,239,172,.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.range, 0, 7); ctx.stroke(); }
      if (sel.s.aura) { ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.aura.radius, 0, 7); ctx.stroke(); }
    }

    // bullets — 'lighter' additive composite: overlapping shots accumulate into bright beams
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.globalAlpha = b.t / 0.09;
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
  drawTower(ctx, tw) {
    const x = tw.x, y = tw.y, s = tw.s, col = tw.def.color, t = this.gameTime;
    const kind = s.aura ? "aura" : s.income ? "mint" : tw.type === "frost" ? "crystal" : (tw.type === "poison" && !s.splash) ? "orb" : tw.type === "detector" ? "radar" : "barrel";
    // aim
    if (kind === "barrel") {
      const tgt = this.pickTargets(tw, 1)[0];
      if (tgt) { let a = Math.atan2(tgt.y - y, tgt.x - x), d = a - tw.angle; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tw.angle += d * 0.3; }
    } else if (kind === "radar") tw.angle += 0.06;
    // base platform
    ctx.fillStyle = "#0e1a12"; this.round(tw.c * CELL + 4, tw.r * CELL + 4, CELL - 8, CELL - 8, 7); ctx.fill();
    // base disc
    ctx.fillStyle = "#16271b"; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    // Ring — shadowBlur scales with level: Lv1 clean, Lv2 soft glow, Lv3 bright, spec blazing
    // shadowBlur NOT expensive per spec; refuted by MDN perf research (canvas-performance)
    ctx.shadowBlur = tw.spec ? 22 : tw.level === 3 ? 14 : tw.level === 2 ? 7 : 0;
    ctx.shadowColor = col;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    // turret
    ctx.fillStyle = col;
    if (kind === "barrel") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tw.angle);
      const n = s.multishot || (tw.type === "rapid" ? 2 : 1), len = 9 + Math.min(15, s.range / 42);
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 4.2; ctx.fillRect(2, off - 1.7, len, 3.4); }
      if (s.splash) { ctx.beginPath(); ctx.arc(2 + len, 0, 4, 0, 7); ctx.fill(); }
      ctx.restore();
    } else if (kind === "crystal") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.7);
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (kind === "orb") {
      ctx.beginPath(); ctx.arc(x, y - 1, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(x - 2, y - 3, 2, 0, 7); ctx.fill();
    } else if (kind === "radar") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tw.angle); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(13, 0, 2.5, 0, 7); ctx.fill(); ctx.restore();
    } else if (kind === "mint") {
      // Three stacked coins — top coin shines
      const coinColors = ["#92400e", "#ca8a04", "#fde047"];
      for (let i = 0; i < 3; i++) {
        const cy = y + (1 - i) * 3.2; // bottom to top
        ctx.fillStyle = coinColors[i]; ctx.beginPath(); ctx.ellipse(x, cy, 7, 3.6, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.fillStyle = "#713f12"; ctx.font = "bold 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("g", x, y - 3);
    } else if (kind === "aura") {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2); ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + 0.4 * pulse; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // tier marks
    const tx = tw.c * CELL, ty = tw.r * CELL;
    if (tw.spec) { ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.moveTo(x, ty + 3); ctx.lineTo(x + 5, ty + 8); ctx.lineTo(x, ty + 13); ctx.lineTo(x - 5, ty + 8); ctx.closePath(); ctx.fill(); }
    else for (let i = 0; i < tw.level; i++) { ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.arc(tx + 9 + i * 7, ty + 8, 2.1, 0, 7); ctx.fill(); }
  }

  drawCreep(ctx, en) {
    const t = this.gameTime, boss = en.flags.includes("boss"), hero = en.flags.includes("hero"), air = en.flags.includes("air");
    const rad = boss ? 17 : hero ? 12 : en.enemy === "Swarm" ? 6 : 9;
    const inv = en.flags.includes("invisible") && !en.revealed;
    const last = en.path.length - 1, nx = en.path[Math.min(en.wp + 1, last)];
    const ang = Math.atan2(nx[1] - en.y, nx[0] - en.x);
    const bob = Math.sin(t * 6 + (en.x + en.y) * 0.05);
    const lift = air ? 7 + bob * 2 : 0;
    if (air) { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(en.x, en.y + rad + 4, rad * 0.9, rad * 0.4, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.globalAlpha = inv ? 0.22 : 1; ctx.translate(en.x, en.y - lift);
    ctx.fillStyle = en.color;
    if (en.enemy === "Swift" || air) {
      ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(rad, 0); ctx.lineTo(-rad * 0.7, rad * 0.7); ctx.lineTo(-rad * 0.3, 0); ctx.lineTo(-rad * 0.7, -rad * 0.7); ctx.closePath(); ctx.fill();
    } else if (en.enemy === "Armored" || en.enemy === "Immune") {
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, px = Math.cos(a) * rad, py = Math.sin(a) * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      const r = rad * (boss ? 1 + 0.06 * Math.sin(t * 3) : 1); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.arc(-rad * 0.28, -rad * 0.28, rad * 0.38, 0, 7); ctx.fill();
    }
    if (boss || hero) { ctx.strokeStyle = boss ? "#fca5a5" : "#fdba74"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rad + 3, 0, 7); ctx.stroke(); }
    ctx.restore();
    // status overlays
    if (t < en.slowUntil) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(en.x, en.y - lift, rad + 2.5, 0, 7); ctx.stroke(); }
    if (en.poison > 0 && t < en.poisonUntil) { ctx.fillStyle = "rgba(132,204,22,.6)"; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(en.x + Math.sin(t * 5 + i * 3) * rad * 0.8, en.y - lift - rad - (t * 30 + i * 8) % 8, 1.7, 0, 7); ctx.fill(); } }
    if (inv) { ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(214,175,255,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(en.x, en.y - lift, rad + 1.5, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    // hp bar when damaged
    const hpf = clamp(en.hp / en.maxHp, 0, 1);
    if (hpf < 0.999) { const w = rad * 2 + 6, yb = en.y - lift - rad - 8; ctx.fillStyle = "rgba(0,0,0,.6)"; this.round(en.x - w / 2, yb, w, 3.6, 1.6); ctx.fill(); ctx.fillStyle = hpf > 0.5 ? "#4ade80" : hpf > 0.25 ? "#facc15" : "#f87171"; this.round(en.x - w / 2, yb, w * hpf, 3.6, 1.6); ctx.fill(); }
  }

  drawFx(ctx) {
    for (const p of this.fx) {
      const a = clamp(p.t / p.max, 0, 1);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === "muzzle" ? p.r * a + 2 : p.r * a, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // small fixed minimap so you always know where the action is while panning
  drawMinimap() {
    const ctx = this.ctx, S = 116, pad = 10;
    const x0 = this.cssW - S - pad, y0 = this.cssH - S - pad, k = S / WORLD;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#0a0f0b"; ctx.strokeStyle = "#294a33"; ctx.lineWidth = 1;
    ctx.fillRect(x0, y0, S, S); ctx.strokeRect(x0, y0, S, S);
    ctx.strokeStyle = "#1f3324";
    for (const path of PATHS) {
      ctx.beginPath(); ctx.moveTo(x0 + path[0][0] * k, y0 + path[0][1] * k);
      for (let i = 1; i < path.length; i++) ctx.lineTo(x0 + path[i][0] * k, y0 + path[i][1] * k);
      ctx.stroke();
    }
    ctx.fillStyle = "#86efac"; ctx.fillRect(x0 + CENTER.x * k - 2, y0 + CENTER.y * k - 2, 4, 4);
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      ctx.fillStyle = en.color; ctx.fillRect(x0 + en.x * k - 1, y0 + en.y * k - 1, 2, 2);
    }
    // viewport rectangle
    const vw = this.cssW / this.cam.zoom, vh = this.cssH / this.cam.zoom;
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.strokeRect(x0 + this.cam.x * k, y0 + this.cam.y * k, vw * k, vh * k);
    ctx.restore();
  }

  drawVignette() {
    // Screen-space radial vignette — pulls the eye toward the field center
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    const inner = Math.min(W, H) * 0.26, outer = Math.max(W, H) * 0.78;
    const g = ctx.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, outer);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.48)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  round(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}

window.__gctd = new Game();

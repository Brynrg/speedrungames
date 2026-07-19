"use strict";
/*
 * Line Tower Wars — standalone web game for speedrungames.net.
 * Single-player vs AI. Maze your lane to kill incoming creeps; send creeps at
 * the enemy to raise income and drain their lives. Drop the enemy to 0 lives
 * as fast as you can (speedrun). No backend — fully static.
 *
 * VISUAL IDENTITY — "Copper Line" (PCB circuit board reskin, 2026-07-18).
 * Two-tier rendering: a per-field offscreen canvas holds the static board
 * (copper trace pads, soldermask channels, via dots, silkscreen bezel
 * lettering) baked once at level load and blitted every frame; everything
 * that changes tick-to-tick (HUD numbers, hover preview, towers, creeps,
 * bolts, fx) is drawn on the live canvas each frame on top of that blit.
 * Palette + hard color rules: see PALETTE below.
 */

// ---------------------------------------------------------------- constants
const CELL = 44;
const GCOLS = 9;
const GROWS = 13;
const FIELD_W = GCOLS * CELL;
const FIELD_H = GROWS * CELL;
const HUD_H = 44;
const PX = 36;                 // player field origin x
const AX = 960 - 36 - FIELD_W; // ai field origin x
const GY = HUD_H;              // grid origin y (both fields)
const SPAWN_COL = (GCOLS - 1) >> 1;

const START_GOLD = 60;
const SEND_COOLDOWN = 0.8;     // seconds between player sends — caps mash-rush APM
const START_INCOME = 10;
const START_LIVES = 20;
const INCOME_INTERVAL = 5;     // seconds
const PB_KEY = "speedrungames:line-tower-wars:pb";

// Copper Line palette. Functional hues (tower/creep/player accents) are kept
// 1:1 from the original build — only the board/chrome material changed.
//   HARD RULE: trace copper (traceA..traceB) never appears in HUD chrome.
//   HARD RULE: UI gold (uiGold) never appears on the board surface.
const PALETTE = {
  boardBasePlayer: "#0a1712",
  boardBaseEnemy: "#1a0e0f",
  bezel: "#05080a",
  traceA: "#c98a3b",
  traceB: "#e8b463",
  silk: "#e8e2d0",
  uiGold: "#facc15",
};

const TOWERS = {
  gun:    { key: "1", name: "Gun",    cost: 14, range: 1.7 * CELL, dmg: 6,  interval: 0.5, splash: 0,         slow: 0,    color: "#60a5fa", desc: "Cheap single-target" },
  frost:  { key: "2", name: "Frost",  cost: 28, range: 1.8 * CELL, dmg: 3,  interval: 0.8, splash: 0,         slow: 0.45, color: "#67e8f9", desc: "Slows 45%" },
  splash: { key: "3", name: "Splash", cost: 40, range: 1.9 * CELL, dmg: 9,  interval: 1.1, splash: 0.9 * CELL, slow: 0,   color: "#fb923c", desc: "Area damage" },
};

const SENDS = {
  runner: { key: "Q", name: "Runner", cost: 12, income: 2, hp: 26, speed: 78, count: 1, bounty: 6,  kill: 3, color: "#a3e635" },
  brute:  { key: "W", name: "Brute",  cost: 30, income: 5, hp: 92, speed: 50, count: 1, bounty: 12, kill: 6, color: "#f472b6" },
  swarm:  { key: "E", name: "Swarm",  cost: 40, income: 8, hp: 18, speed: 70, count: 4, bounty: 4,  kill: 2, color: "#fbbf24" },
};

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const now = () => performance.now();

function formatTime(ms) {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = Math.floor(ms % 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(mm).padStart(3, "0")}`;
}

function loadPB() {
  try { const v = localStorage.getItem(PB_KEY); return v ? Number(v) : null; } catch { return null; }
}
function savePB(ms) {
  try { localStorage.setItem(PB_KEY, String(ms)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- color utils (procedural — no images/fonts)
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}
function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}
function lighten(hex, amt) { return mixHex(hex, "#ffffff", amt); }
function darken(hex, amt) { return mixHex(hex, "#000000", amt); }
function rgbaHex(hex, alpha) { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }

// chamfered-rectangle path (cut corners) — the tower "component package" shape
function chamferPath(ctx, x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

// ---------------------------------------------------------------- hand-drawn glyphs (replace emoji everywhere)
// 2-color chip-outline glyph — used for the spawn marker (baked, on-board)
// and reused for the header brand icon (DOM chrome).
function drawChipGlyph(ctx, cx, cy, size) {
  const s = size / 2;
  ctx.save();
  ctx.strokeStyle = PALETTE.silk;
  ctx.fillStyle = "rgba(5,8,10,0.55)";
  ctx.lineWidth = 1;
  chamferPath(ctx, cx - s, cy - s, size, size, 2.5);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(cx + i * s * 0.6, cy - s); ctx.lineTo(cx + i * s * 0.6, cy - s - 3);
    ctx.moveTo(cx + i * s * 0.6, cy + s); ctx.lineTo(cx + i * s * 0.6, cy + s + 3);
  }
  ctx.stroke();
  ctx.fillStyle = PALETTE.silk;
  ctx.beginPath(); ctx.arc(cx - s + 2.5, cy - s + 2.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// electrical ground-symbol glyph — exit marker (baked, on-board)
function drawGroundGlyph(ctx, cx, topY, size) {
  ctx.save();
  ctx.strokeStyle = "rgba(232,226,208,0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, topY - size); ctx.lineTo(cx, topY - size * 0.45);
  ctx.stroke();
  let y = topY - size * 0.45;
  for (const w of [0.8, 0.55, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(cx - size * w * 0.5, y); ctx.lineTo(cx + size * w * 0.5, y);
    ctx.stroke();
    y += size * 0.22;
  }
  ctx.restore();
}
// schematic battery-cell glyph — currency, HUD chrome only
function drawBatteryIcon(ctx, x, y, size) {
  const w = size, h = size * 0.6;
  ctx.save();
  ctx.strokeStyle = PALETTE.uiGold; ctx.lineWidth = 1;
  ctx.strokeRect(x, y - h / 2, w, h);
  ctx.fillStyle = PALETTE.uiGold;
  ctx.fillRect(x + w, y - h * 0.22, 2, h * 0.44);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.7, y);
  ctx.moveTo(x + w * 0.5, y - h * 0.28); ctx.lineTo(x + w * 0.5, y + h * 0.28);
  ctx.stroke();
  ctx.restore();
}
// small LED-pulse glyph — lives, HUD chrome only
function drawPulseIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + size / 2, y, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x + size / 2 - size * 0.15, y - size * 0.15, size * 0.18, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- tower + creep painters
// Chamfered "component package": hard offset shadow, dark front face (full
// footprint), lighter top face inset from the front so a dark strip peeks
// out bottom-right, single hard 1px top-left highlight — the Filter Room
// 3-face-block technique adapted to a top-down camera. Distinct silhouette
// per tower family, plus pin nubs + a pin-1 orientation dot.
function drawTowerPackage(ctx, tw, cellX, cellY) {
  const pad = 4, w = CELL - pad * 2, h = CELL - pad * 2;
  const x = cellX + pad, y = cellY + pad;
  const hue = tw.def.color;
  const light = lighten(hue, 0.4);
  const dark = darken(hue, 0.5);
  const chamfer = 4;
  const frontDepth = 4;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  chamferPath(ctx, x + 2, y + 2, w, h, chamfer); ctx.fill();

  ctx.fillStyle = dark;
  chamferPath(ctx, x, y, w, h, chamfer); ctx.fill();

  ctx.fillStyle = light;
  chamferPath(ctx, x, y, w - frontDepth, h - frontDepth, chamfer); ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + chamfer, y + 0.5);
  ctx.lineTo(x + w - frontDepth - chamfer, y + 0.5);
  ctx.moveTo(x + 0.5, y + chamfer);
  ctx.lineTo(x + 0.5, y + h - frontDepth - chamfer);
  ctx.stroke();

  const tw2 = w - frontDepth, th2 = h - frontDepth;
  const cx = x + tw2 / 2, cy = y + th2 / 2;
  ctx.save();
  if (tw.type === "gun") {
    // resistor-body: 2-3 color bands across the middle
    const bandW = 2.4;
    const bands = [dark, "#ffffff", darken(hue, 0.15)];
    let bx = cx - (bands.length * (bandW + 2)) / 2;
    for (const bc of bands) {
      ctx.fillStyle = bc;
      ctx.fillRect(bx, y + 3, bandW, th2 - 6);
      bx += bandW + 2;
    }
  } else if (tw.type === "frost") {
    // disc-cap: circle inset in the square base
    const r = Math.min(tw2, th2) / 2 - 3;
    ctx.fillStyle = lighten(hue, 0.15);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darken(hue, 0.3); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, Math.PI, Math.PI * 1.5); ctx.stroke();
  } else if (tw.type === "splash") {
    // banded electrolytic cylinder
    const capW = tw2 * 0.62, capH = th2 - 4;
    const cxx = x + tw2 / 2 - capW / 2, cyy = y + 2;
    ctx.fillStyle = darken(hue, 0.1);
    chamferPath(ctx, cxx, cyy, capW, capH, 3); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cxx + 2, cyy + capH * 0.38); ctx.lineTo(cxx + capW - 2, cyy + capH * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxx + 2, cyy + capH * 0.66); ctx.lineTo(cxx + capW - 2, cyy + capH * 0.66); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(cxx + capW / 2 - 1, cyy + 2, 2, capH * 0.3);
  }
  ctx.restore();

  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(x + w * 0.28, y + h - frontDepth + 1, 2, 2);
  ctx.fillRect(x + w * 0.68, y + h - frontDepth + 1, 2, 2);

  ctx.fillStyle = PALETTE.silk;
  ctx.beginPath(); ctx.arc(x + 3, y + 3, 1.4, 0, Math.PI * 2); ctx.fill();
}

// radial-gradient plasma blip + short fading motion trail. HP bar mechanism
// is left byte-for-byte identical to the original (22px black-backed rect).
function drawCreep(ctx, cr, gameTime) {
  const rad = 8 + (cr.maxHp > 60 ? 4 : 0);

  const trail = cr.trail || [];
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const f = (i + 1) / (trail.length + 1);
    ctx.globalAlpha = f * 0.35;
    ctx.fillStyle = cr.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, rad * (0.35 + 0.4 * f), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const grad = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, rad);
  grad.addColorStop(0, lighten(cr.color, 0.55));
  grad.addColorStop(0.65, cr.color);
  grad.addColorStop(1, rgbaHex(cr.color, 0.25));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cr.x, cr.y, rad, 0, Math.PI * 2); ctx.fill();
  if (gameTime < cr.slowUntil) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.stroke(); }

  // hp bar — EXACT existing mechanism, untouched
  const w = 22, hpf = clamp(cr.hp / cr.maxHp, 0, 1);
  ctx.fillStyle = "#000"; ctx.fillRect(cr.x - w / 2, cr.y - rad - 7, w, 4);
  ctx.fillStyle = hpf > 0.5 ? "#4ade80" : hpf > 0.25 ? "#facc15" : "#f87171";
  ctx.fillRect(cr.x - w / 2, cr.y - rad - 7, w * hpf, 4);
}

// ---------------------------------------------------------------- projectiles + fx
// Jagged 3-4 segment lightning-bolt polyline, regenerated fresh per shot.
function makeBoltPoints(x1, y1, x2, y2) {
  const segs = 3 + (Math.random() < 0.5 ? 0 : 1); // 3 or 4 segments
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const jitter = clamp(len * 0.12, 3, 9);
  const pts = [{ x: x1, y: y1 }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const j = (Math.random() - 0.5) * jitter;
    pts.push({ x: x1 + dx * t + nx * j, y: y1 + dy * t + ny * j });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}
function strokePolyline(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}
// muzzle arc-flash: 3-5 short white-hot radiating segments, ~1-2 frame life
function makeMuzzleFlash(x, y, tx, ty) {
  const baseAngle = Math.atan2(ty - y, tx - x);
  const n = 3 + Math.floor(Math.random() * 3);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = baseAngle + (Math.random() - 0.5) * 1.1;
    const len = 5 + Math.random() * 7;
    segs.push({ x1: 0, y1: 0, x2: Math.cos(a) * len, y2: Math.sin(a) * len });
  }
  return { type: "muzzle", x, y, segs, t: 0.05, life: 0.05 };
}
// short-circuit death burst: 5-8 spark fragments + one bright flash frame
function makeSparkBurst(x, y, color) {
  const n = 5 + Math.floor(Math.random() * 4);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = 7 + Math.random() * 7;
    segs.push({ x1: 0, y1: 0, x2: Math.cos(a) * len, y2: Math.sin(a) * len });
  }
  return { type: "spark", x, y, segs, color, t: 0.18, life: 0.18 };
}

// ---------------------------------------------------------------- Field
class Field {
  constructor(ox, isPlayer) {
    this.ox = ox;             // origin x in canvas
    this.isPlayer = isPlayer;
    this.grid = Array.from({ length: GCOLS }, () => new Array(GROWS).fill(null)); // tower or null
    this.towers = [];
    this.creeps = [];
    this.gold = START_GOLD;
    this.income = START_INCOME;
    this.lives = START_LIVES;
    this.dist = null;         // flow field distances to exit
    this.recompute();
    // static board layer (tier 1) — painted once by renderStatic(), blitted per frame
    this.staticCanvas = document.createElement("canvas");
    this.staticCanvas.width = 960;
    this.staticCanvas.height = 640;
  }

  cellCenter(c, r) { return { x: this.ox + c * CELL + CELL / 2, y: GY + r * CELL + CELL / 2 }; }

  inField(px, py) {
    return px >= this.ox && px < this.ox + FIELD_W && py >= GY && py < GY + FIELD_H;
  }
  cellAt(px, py) {
    const c = Math.floor((px - this.ox) / CELL);
    const r = Math.floor((py - GY) / CELL);
    if (c < 0 || c >= GCOLS || r < 0 || r >= GROWS) return null;
    return { c, r };
  }

  passable(c, r) {
    if (c < 0 || c >= GCOLS || r < 0 || r >= GROWS) return false;
    return this.grid[c][r] === null;
  }

  // BFS distance-to-exit (exit = bottom row). Returns Int grid, Infinity if blocked.
  computeDist() {
    const dist = Array.from({ length: GCOLS }, () => new Array(GROWS).fill(Infinity));
    const q = [];
    for (let c = 0; c < GCOLS; c++) {
      if (this.passable(c, GROWS - 1)) { dist[c][GROWS - 1] = 0; q.push([c, GROWS - 1]); }
    }
    let head = 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < q.length) {
      const [c, r] = q[head++];
      const d = dist[c][r] + 1;
      for (const [dc, dr] of nb) {
        const nc = c + dc, nr = r + dr;
        if (this.passable(nc, nr) && dist[nc][nr] > d) { dist[nc][nr] = d; q.push([nc, nr]); }
      }
    }
    return dist;
  }
  recompute() { this.dist = this.computeDist(); }

  // Would placing a tower at (c,r) keep spawn + all live creeps able to reach exit?
  canBuildAt(c, r) {
    if (!this.passable(c, r)) return false;
    if (r === 0 && c === SPAWN_COL) return false;       // keep spawn open
    this.grid[c][r] = true;                              // tentative
    const d = this.computeDist();
    this.grid[c][r] = null;
    if (!isFinite(d[SPAWN_COL][0])) return false;        // spawn must reach exit
    for (const cr of this.creeps) {                      // every live creep must still path
      const cc = clamp(Math.floor((cr.x - this.ox) / CELL), 0, GCOLS - 1);
      const rr = clamp(Math.floor((cr.y - GY) / CELL), 0, GROWS - 1);
      if (!isFinite(d[cc][rr])) return false;
    }
    return true;
  }

  build(c, r, type) {
    const def = TOWERS[type];
    if (this.gold < def.cost || !this.canBuildAt(c, r)) return false;
    const t = { c, r, type, def, lastFire: -999, ...this.cellCenter(c, r) };
    this.grid[c][r] = t;
    this.towers.push(t);
    this.gold -= def.cost;
    this.recompute();
    return true;
  }

  // spawn `def.count` creeps of a send type at the top, sent by the other side.
  // hpScale grows with elapsed time so sends stay viable against a grown maze.
  spawnSend(def, senderIsPlayer, hpScale = 1) {
    for (let i = 0; i < def.count; i++) {
      const center = this.cellCenter(SPAWN_COL, 0);
      const hp = Math.round(def.hp * hpScale);
      this.creeps.push({
        x: center.x + (Math.random() - 0.5) * CELL * 0.4,
        y: GY - CELL * 0.5 - i * CELL * 0.7,   // stagger above the field, walk in
        hp, maxHp: hp, speed: def.speed,
        bounty: def.bounty, kill: def.kill, color: def.color,
        slowUntil: 0, senderIsPlayer,
        trail: [],
      });
    }
  }

  // Paint the tier-1 static board layer: board base, copper trace pads,
  // soldermask channels, via dots, spawn/exit glyphs, silkscreen bezel
  // lettering. Called once per run (not per frame) — the dynamic layer
  // (towers) draws over its own cell every frame regardless of what's
  // baked underneath, so this never needs to be regenerated mid-run.
  renderStatic() {
    const ctx = this.staticCanvas.getContext("2d");
    ctx.clearRect(0, 0, 960, 640);
    const ox = this.ox;
    const boardBase = this.isPlayer ? PALETTE.boardBasePlayer : PALETTE.boardBaseEnemy;

    ctx.fillStyle = boardBase;
    ctx.fillRect(ox, GY, FIELD_W, FIELD_H);

    ctx.strokeStyle = "#26314a";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 1, GY - 1, FIELD_W + 2, FIELD_H + 2);

    // spawn / exit band tint (kept subtle, under the trace pads)
    ctx.fillStyle = "rgba(248,113,113,0.08)";
    ctx.fillRect(ox, GY, FIELD_W, CELL);
    ctx.fillStyle = "rgba(96,165,250,0.08)";
    ctx.fillRect(ox, GY + FIELD_H - CELL, FIELD_W, CELL);

    // copper trace pads — the walkable-path fill. A tower drawn on top each
    // frame becomes the "wall" for that cell, so every cell gets a pad here.
    const gap = 3;
    for (let c = 0; c < GCOLS; c++) {
      for (let r = 0; r < GROWS; r++) {
        const x = ox + c * CELL + gap, y = GY + r * CELL + gap;
        const w = CELL - gap * 2, h = CELL - gap * 2;
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, PALETTE.traceA);
        grad.addColorStop(1, PALETTE.traceB);
        ctx.fillStyle = grad;
        chamferPath(ctx, x, y, w, h, 3);
        ctx.fill();
        ctx.strokeStyle = "rgba(5,8,10,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // faint silkscreen texture, kept low so it never competes with the
    // trace/wall contrast boundary
    ctx.fillStyle = "rgba(232,226,208,0.08)";
    for (let c = 0; c < GCOLS; c++) {
      for (let r = 0; r < GROWS; r++) {
        const cx = ox + c * CELL + CELL / 2, cy = GY + r * CELL + CELL / 2;
        ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // via dots at grid-line intersections (decorative PCB detail)
    for (let c = 1; c < GCOLS; c++) {
      for (let r = 1; r < GROWS; r++) {
        if ((c + r) % 2 !== 0) continue;
        const x = ox + c * CELL, y = GY + r * CELL;
        ctx.fillStyle = PALETTE.bezel;
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(232,226,208,0.5)";
        ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // spawn glyph (chip-outline) + exit glyph row (ground-symbol)
    const sp = this.cellCenter(SPAWN_COL, 0);
    drawChipGlyph(ctx, sp.x, sp.y, 14);
    for (let c = 0; c < GCOLS; c++) {
      const ex = ox + c * CELL + CELL / 2;
      drawGroundGlyph(ctx, ex, GY + FIELD_H - 4, 8);
    }

    // silkscreen coordinate lettering along the board bezel
    ctx.fillStyle = PALETTE.silk;
    ctx.font = '7px ui-monospace, "SF Mono", "Courier New", monospace';
    ctx.textBaseline = "middle";
    ctx.textAlign = this.isPlayer ? "right" : "left";
    for (let r = 0; r < GROWS; r++) {
      const y = GY + r * CELL + CELL / 2;
      const x = this.isPlayer ? ox - 6 : ox + FIELD_W + 6;
      ctx.fillText(String(r + 1), x, y);
    }
    ctx.textAlign = "center";
    for (let c = 0; c < GCOLS; c++) {
      const x = ox + c * CELL + CELL / 2;
      ctx.fillText(String.fromCharCode(65 + c), x, GY + FIELD_H + 12);
    }
  }
}

// ---------------------------------------------------------------- Game
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.player = new Field(PX, true);
    this.ai = new Field(AX, false);
    this.selectedTower = "gun";
    this.hover = null;
    this.state = "ready";       // ready | running | paused | won | lost
    this.gameTime = 0;          // sim-time seconds — the ONLY clock for gameplay + the timer
    this.elapsed = 0;
    this.last = now();
    this.incomeTimer = INCOME_INTERVAL;
    this.aiBuildTimer = 2;
    this.aiSendTimer = 4;
    this.pb = loadPB();

    this.bullets = [];          // transient bolt polylines
    this.effects = [];          // transient fx (muzzle flash, death spark)
    this.arenaStatic = this.buildArenaStatic();
    this.bindUI();
    this.bindInput();
    this.renderPB();
    requestAnimationFrame(() => this.loop());
  }

  // Tier-1 arena chrome that never changes across a run: bezel background +
  // the center divider. Baked once, blitted every frame.
  buildArenaStatic() {
    const c = document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    const actx = c.getContext("2d");
    actx.fillStyle = PALETTE.bezel;
    actx.fillRect(0, 0, c.width, c.height);
    const midx = (PX + FIELD_W + AX) / 2;
    actx.strokeStyle = "#26314a"; actx.lineWidth = 2;
    actx.beginPath(); actx.moveTo(midx, GY); actx.lineTo(midx, GY + FIELD_H); actx.stroke();
    actx.fillStyle = "#3a4a70"; actx.font = "bold 18px system-ui";
    actx.textAlign = "center"; actx.textBaseline = "middle";
    actx.fillText("VS", midx, GY + FIELD_H / 2);
    return c;
  }

  // ---- run lifecycle
  // Send HP grows ~35%/min so a banked burst can still crack a mature maze —
  // without it the game is decided in the first minute (rush wins, or the AI
  // snowball makes every later strategy hopeless).
  sendHpScale() { return 1 + (this.gameTime / 60) * 0.35; }

  startRun() {
    this.player = new Field(PX, true);
    this.ai = new Field(AX, false);
    // The AI starts with a free starter picket so an instant runner-mash rush
    // can't win in the opening seconds before it ever builds.
    for (const [c, r, type] of [[4, 2, "frost"], [3, 4, "gun"], [5, 5, "gun"], [4, 7, "frost"], [3, 9, "gun"], [5, 10, "gun"]]) {
      const saved = this.ai.gold;
      this.ai.gold = TOWERS[type].cost;
      this.ai.build(c, r, type);
      this.ai.gold = saved;
    }
    this.player.renderStatic();
    this.ai.renderStatic();
    this.incomeTimer = INCOME_INTERVAL;
    this.aiBuildTimer = 0.8;
    this.aiSendTimer = 4;
    this.bullets = [];
    this.effects = [];
    this.elapsed = 0;
    this.gameTime = 0;
    this.sendReadyAt = 0;
    this.state = "running";
    this.hideOverlay();
  }
  end(won) {
    this.state = won ? "won" : "lost";
    if (won) {
      if (this.pb == null || this.elapsed < this.pb) { this.pb = this.elapsed; savePB(this.pb); this.renderPB(); this._newPB = true; }
      else this._newPB = false;
    }
    this.showEndOverlay(won);
  }

  // ---- UI (buttons + overlay)
  bindUI() {
    const tb = document.getElementById("towerButtons");
    tb.innerHTML = "";
    for (const [id, d] of Object.entries(TOWERS)) {
      const b = document.createElement("button");
      b.className = "gbtn"; b.dataset.tower = id;
      b.innerHTML = `<span class="nm">${d.key} · ${d.name}</span><span class="ct">${d.cost}g</span><span class="ds">${d.desc}</span>`;
      b.onclick = () => this.selectTower(id);
      tb.appendChild(b);
    }
    const sb = document.getElementById("sendButtons");
    sb.innerHTML = "";
    for (const [id, d] of Object.entries(SENDS)) {
      const b = document.createElement("button");
      b.className = "gbtn"; b.dataset.send = id;
      const lbl = d.count > 1 ? `${d.name} ×${d.count}` : d.name;
      b.innerHTML = `<span class="nm">${d.key} · ${lbl}</span><span class="ct">${d.cost}g · +${d.income}/s</span><span class="ds">${d.hp} hp</span>`;
      b.onclick = () => this.send(id);
      sb.appendChild(b);
    }
    this.refreshButtons();
    this.drawBrandIcon();
  }
  drawBrandIcon() {
    const el = document.getElementById("brandIcon");
    if (!el) return;
    drawChipGlyph(el.getContext("2d"), 11, 11, 14);
  }
  selectTower(id) { this.selectedTower = id; this.refreshButtons(); }
  refreshButtons() {
    document.querySelectorAll("[data-tower]").forEach((b) => {
      const id = b.dataset.tower;
      b.classList.toggle("selected", id === this.selectedTower);
      b.disabled = this.state === "running" && this.player.gold < TOWERS[id].cost;
    });
    document.querySelectorAll("[data-send]").forEach((b) => {
      b.disabled = this.state !== "running" || this.player.gold < SENDS[b.dataset.send].cost || this.gameTime < this.sendReadyAt;
    });
  }
  renderPB() { document.getElementById("pb").textContent = this.pb == null ? "PB —" : "PB " + formatTime(this.pb); }

  hideOverlay() { const o = document.getElementById("overlay"); o.className = "overlay hidden"; o.innerHTML = ""; }
  showOverlay(html) { const o = document.getElementById("overlay"); o.className = "overlay"; o.innerHTML = html; }
  showStartOverlay() {
    this.showOverlay(`<h2>Line Tower Wars</h2><p>Maze your lane. Send creeps at the enemy. Drop them to 0 lives — fast.</p><button id="startBtn">Start</button>`);
    document.getElementById("startBtn").onclick = () => this.startRun();
  }
  // Fire-and-forget leaderboard submit to the portal (POST /api/runs).
  // Standalone hosting (no portal API) fails silently.
  submitRun() {
    const body = { slug: "line-tower-wars", ms: Math.round(this.elapsed) };
    fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        const el = document.getElementById("lbStatus");
        if (el && res.ok) el.textContent = "Run submitted to the leaderboard.";
      })
      .catch(() => {});
  }
  showEndOverlay(won) {
    const t = formatTime(this.elapsed);
    const sub = won ? (this._newPB ? `New personal best!` : (this.pb != null ? `PB ${formatTime(this.pb)}` : "")) : "The enemy overran your lane.";
    this.showOverlay(`<h2>${won ? "Victory!" : "Defeated"}</h2><p>Time ${t}</p><p>${sub}</p><p id="lbStatus" class="hint"></p><button id="againBtn">${won ? "Play again" : "Retry"}</button>`);
    document.getElementById("againBtn").onclick = () => this.startRun();
    if (won) this.submitRun();
  }

  // ---- input
  bindInput() {
    const rectScale = () => {
      const r = this.canvas.getBoundingClientRect();
      return { r, sx: this.canvas.width / r.width, sy: this.canvas.height / r.height };
    };
    this.canvas.addEventListener("mousemove", (e) => {
      const { r, sx, sy } = rectScale();
      const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
      this.hover = this.player.inField(px, py) ? this.player.cellAt(px, py) : null;
    });
    this.canvas.addEventListener("mouseleave", () => { this.hover = null; });
    this.canvas.addEventListener("click", (e) => {
      if (this.state === "ready") { this.startRun(); return; }
      if (this.state !== "running") return;
      const { r, sx, sy } = rectScale();
      const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
      if (!this.player.inField(px, py)) return;
      const cell = this.player.cellAt(px, py);
      if (cell) { this.player.build(cell.c, cell.r, this.selectedTower); this.refreshButtons(); }
    });
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "1") this.selectTower("gun");
      else if (k === "2") this.selectTower("frost");
      else if (k === "3") this.selectTower("splash");
      else if (k === "q") this.send("runner");
      else if (k === "w") this.send("brute");
      else if (k === "e") this.send("swarm");
      else if (k === "escape") this.hover = null;
      else if (k === "p") {
        if (this.state === "running") this.state = "paused";
        else if (this.state === "paused") this.state = "running";
      }
      else if (k === " " || e.code === "Space") {
        if (this.state === "won" || this.state === "lost" || this.state === "ready") { e.preventDefault(); this.startRun(); }
      }
    });
  }

  send(id) {
    if (this.state !== "running") return;
    if (this.gameTime < this.sendReadyAt) return;
    const def = SENDS[id];
    if (this.player.gold < def.cost) return;
    this.sendReadyAt = this.gameTime + SEND_COOLDOWN;
    this.player.gold -= def.cost;
    this.player.income += def.income;
    this.ai.spawnSend(def, true, this.sendHpScale());  // your creeps attack the AI field
    this.refreshButtons();
  }

  // ---- AI opponent
  updateAI(dt) {
    // escalating aggression with elapsed time
    const mins = this.gameTime / 60;
    this.aiBuildTimer -= dt;
    if (this.aiBuildTimer <= 0) {
      this.aiBuildTimer = 1.6;
      this.aiTryBuild();
    }
    this.aiSendTimer -= dt;
    if (this.aiSendTimer <= 0) {
      this.aiSendTimer = clamp(4.5 - mins * 0.8, 1.6, 4.5);
      this.aiTrySend(mins);
    }
  }
  aiTryBuild() {
    const f = this.ai;
    // keep ~1/3 of gold as a sending reserve; build the best affordable tower
    const budget = f.gold * 0.66;
    const order = ["splash", "frost", "gun"];
    let type = null;
    for (const t of order) { if (TOWERS[t].cost <= budget) { type = t; break; } }
    if (!type) return;
    // serpentine mazing: alternate leaving a gap column per row band
    const candidates = [];
    for (let r = 1; r < GROWS - 1; r++) {
      const gap = (r % 2 === 0) ? GCOLS - 1 : 0; // leave one side open per row
      for (let c = 0; c < GCOLS; c++) {
        if (c === gap) continue;
        if (f.passable(c, r) && f.canBuildAt(c, r)) candidates.push({ c, r });
      }
    }
    if (!candidates.length) return;
    // prefer lower rows first (build the maze from the exit up), with light noise
    candidates.sort((a, b) => (b.r - a.r) + (Math.random() - 0.5));
    const pick = candidates[0];
    f.build(pick.c, pick.r, type);
  }
  aiTrySend(mins) {
    const f = this.ai;
    const want = mins < 1 ? ["runner"] : mins < 2.2 ? ["runner", "brute"] : ["runner", "brute", "swarm"];
    const id = want[Math.floor(Math.random() * want.length)];
    const def = SENDS[id];
    if (f.gold >= def.cost) {
      f.gold -= def.cost;
      f.income += def.income;
      this.player.spawnSend(def, false, this.sendHpScale()); // AI creeps attack the player field
    }
  }

  // ---- simulation
  update(dt) {
    if (this.state !== "running") return;
    this.gameTime += dt;
    this.elapsed = this.gameTime * 1000;

    this.incomeTimer -= dt;
    if (this.incomeTimer <= 0) {
      this.incomeTimer += INCOME_INTERVAL;
      this.player.gold += this.player.income;
      this.ai.gold += this.ai.income;
    }

    this.updateField(this.player, dt);
    this.updateField(this.ai, dt);
    this.updateAI(dt);

    // bullets + fx (visual only)
    for (const b of this.bullets) b.t -= dt;
    this.bullets = this.bullets.filter((b) => b.t > 0);
    for (const e of this.effects) e.t -= dt;
    this.effects = this.effects.filter((e) => e.t > 0);

    this.refreshButtons();

    if (this.ai.lives <= 0) this.end(true);
    else if (this.player.lives <= 0) this.end(false);
  }

  updateField(f, dt) {
    // move creeps along the flow field
    for (const cr of f.creeps) {
      if (cr.hp <= 0) continue;
      const speed = cr.speed * (this.gameTime < cr.slowUntil ? 0.55 : 1);
      // current cell
      let cc = Math.floor((cr.x - f.ox) / CELL);
      let rr = Math.floor((cr.y - GY) / CELL);
      // entering from above the grid: just walk down
      let target;
      if (rr < 0) {
        target = f.cellCenter(SPAWN_COL, 0);
      } else if (rr >= GROWS - 1) {
        // at exit row -> leak when crossing bottom edge
        cr.y += speed * dt;
        this.pushTrail(cr);
        if (cr.y > GY + FIELD_H) { cr.leaked = true; cr.hp = 0; this.onLeak(f, cr); }
        continue;
      } else {
        cc = clamp(cc, 0, GCOLS - 1);
        const d = f.dist;
        let best = null, bestD = d[cc][rr];
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc, nr = rr + dr;
          if (f.passable(nc, nr) && isFinite(d[nc][nr]) && d[nc][nr] < bestD) { bestD = d[nc][nr]; best = [nc, nr]; }
        }
        if (best) target = f.cellCenter(best[0], best[1]);
        else target = f.cellCenter(cc, Math.min(rr + 1, GROWS - 1)); // fallback: nudge downward
      }
      const dx = target.x - cr.x, dy = target.y - cr.y;
      const dlen = Math.hypot(dx, dy) || 1;
      const step = Math.min(speed * dt, dlen);
      cr.x += (dx / dlen) * step;
      cr.y += (dy / dlen) * step;
      this.pushTrail(cr);
    }

    // towers fire (sim-time cooldowns — wall-clock here made towers burst-fire
    // after a hidden-tab freeze and broke pause)
    const t = this.gameTime;
    for (const tw of f.towers) {
      if (t - tw.lastFire < tw.def.interval) continue;
      const target = this.pickTarget(f, tw);
      if (!target) continue;
      tw.lastFire = t;
      this.bullets.push({ points: makeBoltPoints(tw.x, tw.y, target.x, target.y), color: tw.def.color, t: 0.12, life: 0.12 });
      this.effects.push(makeMuzzleFlash(tw.x, tw.y, target.x, target.y));
      if (tw.def.splash > 0) {
        for (const cr of f.creeps) {
          if (cr.hp <= 0) continue;
          if (Math.hypot(cr.x - target.x, cr.y - target.y) <= tw.def.splash) this.damage(f, cr, tw.def.dmg);
        }
      } else {
        this.damage(f, target, tw.def.dmg);
        if (tw.def.slow > 0) target.slowUntil = t + 1.2;
      }
    }

    // cull dead/leaked
    f.creeps = f.creeps.filter((c) => c.hp > 0 || c.y <= GY + FIELD_H);
    f.creeps = f.creeps.filter((c) => !(c.hp <= 0));
  }

  // maintain a short (<=5 point) fading motion trail, sampled by distance
  // rather than by frame so it looks consistent at any framerate
  pushTrail(cr) {
    const last = cr.trail[cr.trail.length - 1];
    if (!last || Math.hypot(cr.x - last.x, cr.y - last.y) > 5) {
      cr.trail.push({ x: cr.x, y: cr.y });
      if (cr.trail.length > 5) cr.trail.shift();
    }
  }

  pickTarget(f, tw) {
    let best = null, bestProg = -Infinity;
    for (const cr of f.creeps) {
      if (cr.hp <= 0) continue;
      if (Math.hypot(cr.x - tw.x, cr.y - tw.y) > tw.def.range) continue;
      // prefer the creep furthest along (closest to exit = lowest dist / highest y)
      const prog = cr.y;
      if (prog > bestProg) { bestProg = prog; best = cr; }
    }
    return best;
  }

  damage(f, cr, amount) {
    if (cr.hp <= 0) return;
    cr.hp -= amount;
    if (cr.hp <= 0) {
      // tower owner (the field owner) earns kill gold
      f.gold += cr.kill;
      this.effects.push(makeSparkBurst(cr.x, cr.y, cr.color));
    }
  }

  onLeak(f, cr) {
    f.lives -= 1;                  // field owner loses a life
    // the SENDER earns the leak bounty + a little extra income pressure
    const sender = cr.senderIsPlayer ? this.player : this.ai;
    sender.gold += cr.bounty;
  }

  // ---- render
  loop() {
    const t = now();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.05) dt = 0.05;     // clamp after tab-away
    if (this.state === "ready") { this.draw(); this.showStartOverlayOnce(); }
    else { this.update(dt); this.draw(); }
    document.getElementById("timer").textContent = formatTime(this.elapsed);
    requestAnimationFrame(() => this.loop());
  }
  showStartOverlayOnce() { if (!this._startShown) { this._startShown = true; this.showStartOverlay(); } }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.arenaStatic, 0, 0);
    this.drawField(this.player, "YOU", "#60a5fa");
    this.drawField(this.ai, "ENEMY", "#f87171");
    if (this.state === "paused") {
      ctx.fillStyle = "rgba(13, 16, 24, 0.55)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Paused — press P to resume", this.canvas.width / 2, this.canvas.height / 2);
    }

    // projectiles — jagged bolt polyline, glow under-stroke + core stroke
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const b of this.bullets) {
      const a = clamp(b.t / b.life, 0, 1);
      ctx.strokeStyle = rgbaHex(b.color, 0.28 * a);
      ctx.lineWidth = 6;
      strokePolyline(ctx, b.points);
      ctx.strokeStyle = rgbaHex(b.color, a);
      ctx.lineWidth = 2;
      strokePolyline(ctx, b.points);
    }

    // fx — muzzle arc-flash + short-circuit death bursts
    for (const e of this.effects) {
      const a = clamp(e.t / e.life, 0, 1);
      if (e.type === "muzzle") {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 1.5;
        for (const s of e.segs) { ctx.beginPath(); ctx.moveTo(e.x + s.x1, e.y + s.y1); ctx.lineTo(e.x + s.x2, e.y + s.y2); ctx.stroke(); }
      } else if (e.type === "spark") {
        if (a > 0.8) {
          ctx.fillStyle = `rgba(255,255,255,${(a - 0.8) / 0.2})`;
          ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = rgbaHex(e.color, a);
        ctx.lineWidth = 1.4;
        for (const s of e.segs) { ctx.beginPath(); ctx.moveTo(e.x + s.x1, e.y + s.y1); ctx.lineTo(e.x + s.x2, e.y + s.y2); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.lineJoin = "miter"; ctx.lineCap = "butt";
  }

  drawField(f, label, accent) {
    const ctx = this.ctx, ox = f.ox;

    // tier 1 — blit the baked board (trace pads, via dots, silkscreen, glyphs)
    ctx.drawImage(f.staticCanvas, 0, 0);

    // tier 2 — HUD strip (dynamic numbers, hand-drawn glyphs, chrome only)
    ctx.fillStyle = accent; ctx.font = "bold 14px system-ui";
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(label, ox, HUD_H / 2 - 8);

    const statY = HUD_H / 2 + 9;
    let sx = ox;
    drawPulseIcon(ctx, sx, statY, 10, accent);
    sx += 15;
    ctx.fillStyle = "#e7ecf3"; ctx.font = "13px system-ui"; ctx.textAlign = "left";
    const livesTxt = `${Math.max(0, f.lives)}`;
    ctx.fillText(livesTxt, sx, statY);
    sx += ctx.measureText(livesTxt).width + 12;
    drawBatteryIcon(ctx, sx, statY, 12);
    sx += 20;
    ctx.fillText(`${Math.floor(f.gold)}   +${f.income}/s`, sx, statY);

    // build hover preview (player only) — dynamic
    if (f.isPlayer && this.hover && this.state === "running") {
      const { c, r } = this.hover;
      const ok = f.gold >= TOWERS[this.selectedTower].cost && f.canBuildAt(c, r);
      ctx.fillStyle = ok ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)";
      ctx.fillRect(ox + c * CELL, GY + r * CELL, CELL, CELL);
      if (ok) {
        const ctr = f.cellCenter(c, r);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath(); ctx.arc(ctr.x, ctr.y, TOWERS[this.selectedTower].range, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // towers — chamfered component packages, dynamic (redrawn every frame,
    // covers whatever trace pad is baked underneath)
    for (const tw of f.towers) {
      drawTowerPackage(ctx, tw, ox + tw.c * CELL, GY + tw.r * CELL);
    }

    // creeps — radial-gradient blips + fading trail
    for (const cr of f.creeps) {
      if (cr.hp <= 0) continue;
      drawCreep(ctx, cr, this.gameTime);
    }
    ctx.lineWidth = 1;
  }
}

// expose a tiny hook for smoke tests, then boot
window.__ltw = new Game();

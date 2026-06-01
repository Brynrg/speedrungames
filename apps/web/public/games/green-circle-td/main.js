"use strict";
/*
 * Green Circle TD — web port for speedrungames.net.
 * Single-path tower defense with an armor-vs-damage matrix, aura towers, a
 * detector for invisibles, status effects (slow/poison), and 30 escalating
 * waves. Content (towers/enemies/armor/waves) is ported from the original
 * Python game's data. Fully static, no backend.
 *
 * v1 simplification: the original spawns from 4 corners; here all spawns share
 * one winding path (the armor/tower/wave systems are preserved verbatim).
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

const RANGE_SCALE = 0.62;
const T = (o) => ({ ...o, range: (o.range || 0) * RANGE_SCALE });
const TOWERS = {
  basic:    T({ name: "Basic",   key: "1", range: 200, damage: 25, cd: 30, cost: 100, color: "rgb(42,178,84)",  dtype: "normal", desc: "Normal dmg, cheap" }),
  sniper:   T({ name: "Sniper",  key: "2", range: 350, damage: 75, cd: 90, cost: 200, color: "rgb(64,215,255)", dtype: "pierce", desc: "Long range pierce" }),
  rapid:    T({ name: "Rapid",   key: "3", range: 120, damage: 10, cd: 10, cost: 150, color: "rgb(255,146,41)", dtype: "pierce", desc: "Fast pierce" }),
  splash:   T({ name: "Splash",  key: "4", range: 180, damage: 40, cd: 60, cost: 180, color: "rgb(178,92,255)", dtype: "siege", splash: 80, desc: "Siege AoE" }),
  frost:    T({ name: "Frost",   key: "5", range: 175, damage: 14, cd: 34, cost: 165, color: "rgb(102,185,255)",dtype: "magic", slow: 0.55, slowDur: 95, desc: "Magic, slows 55%" }),
  poison:   T({ name: "Poison",  key: "6", range: 185, damage: 12, cd: 36, cost: 145, color: "rgb(100,224,66)", dtype: "magic", poison: 4, poisonDur: 140, desc: "Magic + poison DoT" }),
  detector: T({ name: "Detector",key: "7", range: 230, damage: 8,  cd: 24, cost: 125, color: "rgb(255,214,78)", dtype: "normal", detect: true, desc: "Reveals invisible" }),
  damage_aura: T({ name: "Dmg Aura", key: "8", range: 0, damage: 0, cd: 0, cost: 220, color: "rgb(200,50,50)",   dtype: null, aura: { type: "dmg", radius: 160, value: 0.20 }, desc: "+20% dmg near" }),
  speed_aura:  T({ name: "Spd Aura", key: "9", range: 0, damage: 0, cd: 0, cost: 200, color: "rgb(200,200,50)",  dtype: null, aura: { type: "cd", radius: 150, value: 0.15 }, desc: "-15% cooldown near" }),
};

const WAVES = [
  { id: 1, name: "First Light", hint: "Light infantry. Build any tower.", reward: 50, spawns: [{ e: "Normal", n: 8, iv: 0.7, at: 0 }] },
  { id: 2, name: "Patrol", hint: "Steady pressure. Add a second tower.", reward: 60, spawns: [{ e: "Normal", n: 10, iv: 0.7, at: 0 }, { e: "Normal", n: 10, iv: 0.7, at: 2 }] },
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
  { id: 17, name: "The Bound Flame", hint: "Hero creeps.", reward: 250, spawns: [{ e: "Hero", n: 4, iv: 4.0, at: 0 }, { e: "Hero", n: 4, iv: 4.0, at: 1 }] },
  { id: 18, name: "Ash Swarm", hint: "Swarm of flyers. AoE + anti-air.", reward: 90, spawns: [{ e: "Air", n: 24, iv: 0.25, at: 0 }] },
  { id: 19, name: "Iron Ghosts", hint: "Invisible mass. Detector + Siege/Magic.", reward: 95, spawns: [{ e: "Invisible", n: 10, iv: 0.7, at: 0 }] },
  { id: 20, name: "The Verdant Maw", hint: "MEGA BOSS.", boss: true, reward: 500, spawns: [{ e: "Armored", n: 6, iv: 0.6, at: 0 }, { e: "Invisible", n: 4, iv: 0.6, at: 0 }, { e: "Boss", n: 1, iv: 0, at: 4 }] },
  { id: 21, name: "Hollow March", hint: "Hero + swarm.", reward: 100, spawns: [{ e: "Hero", n: 1, iv: 0, at: 0 }, { e: "Swarm", n: 18, iv: 0.25, at: 1 }] },
  { id: 22, name: "Spectral Wing", hint: "Flyers. Detector + Sniper.", reward: 95, spawns: [{ e: "Air", n: 12, iv: 0.5, at: 0 }] },
  { id: 23, name: "The Brand", hint: "Immune + heavy. Magic/Siege dominate.", reward: 100, spawns: [{ e: "Immune", n: 10, iv: 0.7, at: 0 }] },
  { id: 24, name: "Storm Tide", hint: "Everything at once.", reward: 120, spawns: [{ e: "Normal", n: 8, iv: 0.5, at: 0 }, { e: "Swift", n: 8, iv: 0.5, at: 0 }, { e: "Armored", n: 8, iv: 0.5, at: 0 }, { e: "Swarm", n: 8, iv: 0.5, at: 0 }] },
  { id: 25, name: "The Crucible", hint: "Mixed armor. Tower diversity mandatory.", reward: 130, spawns: [{ e: "Normal", n: 6, iv: 0.5, at: 0 }, { e: "Swift", n: 6, iv: 0.5, at: 0 }, { e: "Armored", n: 6, iv: 0.5, at: 0 }, { e: "Immune", n: 6, iv: 0.5, at: 0 }] },
  { id: 26, name: "Final Sentinels", hint: "Heroes + escorts.", reward: 150, spawns: [{ e: "Hero", n: 4, iv: 3.0, at: 0 }, { e: "Hero", n: 4, iv: 3.0, at: 0 }, { e: "Armored", n: 8, iv: 0.5, at: 2 }] },
  { id: 27, name: "The Long Dark", hint: "Immune + invisible puzzle.", reward: 120, spawns: [{ e: "Immune", n: 8, iv: 0.5, at: 0 }, { e: "Invisible", n: 8, iv: 0.4, at: 0 }] },
  { id: 28, name: "Sky Plague", hint: "Flyers + fast.", reward: 110, spawns: [{ e: "Air", n: 10, iv: 0.4, at: 0 }, { e: "Swift", n: 4, iv: 0.3, at: 2 }] },
  { id: 29, name: "The Coronation", hint: "Heroes + swarm. Total war.", reward: 200, spawns: [{ e: "Hero", n: 5, iv: 3.0, at: 0 }, { e: "Hero", n: 5, iv: 3.0, at: 0 }, { e: "Swarm", n: 20, iv: 0.2, at: 1 }] },
  { id: 30, name: "The Pale Crown", hint: "FINAL BOSS.", boss: true, reward: 1000, spawns: [{ e: "Boss", n: 1, iv: 0, at: 0 }, { e: "Armored", n: 6, iv: 0.5, at: 3 }, { e: "Invisible", n: 4, iv: 0.5, at: 3 }, { e: "Hero", n: 2, iv: 2.0, at: 5 }] },
];

// path waypoints (serpentine); enemies travel start -> base
const PATH = [
  [-20, 80], [850, 80], [850, 190], [110, 190], [110, 300],
  [850, 300], [850, 410], [110, 410], [110, 520], [980, 520],
];
const BASE = { x: 905, y: 520 };
const PATH_CLEAR = 26;     // min px from path to allow building
const CELL = 40, GCOLS = 24, GROWS = 15;

const START_GOLD = 250, START_LIVES = 20;
const BASE_SPEED = 56;     // px/s before speed_mult
const PB_KEY = "speedrungames:green-circle-td:pb";

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
function distToPath(px, py) {
  let m = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) m = Math.min(m, distToSeg(px, py, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]));
  return m;
}
const loadPB = () => { try { const v = localStorage.getItem(PB_KEY); return v ? +v : null; } catch { return null; } };
const savePB = (ms) => { try { localStorage.setItem(PB_KEY, String(ms)); } catch {} };

// ----------------------------------------------------------------- game
class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.reset();
    this.pb = loadPB();
    this.selected = "basic";
    this.hoverCell = null;
    this.buildable = this.computeBuildable();
    this.bindUI();
    this.bindInput();
    this.renderPB();
    this.last = nowMs();
    this.showStart();
    requestAnimationFrame(() => this.loop());
  }

  reset() {
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.towers = [];
    this.occupied = new Set();   // "c,r" cells with towers
    this.enemies = [];
    this.bullets = [];
    this.waveIndex = 0;          // 0 = none started
    this.spawnQueue = [];        // pending {at, enemy, hp, ...} for active wave
    this.waveActive = false;
    this.state = "ready";        // ready | running | won | lost
    this.startMs = 0;
    this.elapsed = 0;
    this.waveClock = 0;
    this.gameTime = 0;           // accumulated sim seconds (drives cooldowns/status, frame-rate independent)
  }

  computeBuildable() {
    const cells = [];
    for (let c = 0; c < GCOLS; c++) for (let r = 0; r < GROWS; r++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      if (distToPath(x, y) > PATH_CLEAR) cells.push({ c, r, x, y });
    }
    return cells;
  }
  cellBuildable(c, r) {
    if (c < 0 || c >= GCOLS || r < 0 || r >= GROWS) return false;
    if (this.occupied.has(c + "," + r)) return false;
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    return distToPath(x, y) > PATH_CLEAR;
  }

  // ---- UI
  bindUI() {
    const tb = document.getElementById("towerButtons");
    tb.innerHTML = "";
    for (const [id, d] of Object.entries(TOWERS)) {
      const b = document.createElement("button");
      b.className = "gbtn"; b.dataset.tower = id;
      b.innerHTML = `<span class="nm"><span><span class="dot" style="background:${d.color}"></span>${d.key}·${d.name}</span><span class="ct">${d.cost}</span></span><span class="ds">${d.desc}</span>`;
      b.onclick = () => this.select(id);
      tb.appendChild(b);
    }
    document.getElementById("startWave").onclick = () => this.startNextWave();
    this.refreshButtons();
  }
  select(id) { this.selected = id; this.refreshButtons(); }
  refreshButtons() {
    document.querySelectorAll("[data-tower]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.tower === this.selected);
      b.disabled = this.gold < TOWERS[b.dataset.tower].cost;
    });
    const sw = document.getElementById("startWave");
    sw.disabled = this.waveActive || this.state === "won" || this.state === "lost";
    sw.textContent = this.waveIndex >= WAVES.length ? "All waves done" : `Start wave ${this.waveIndex + 1} ▶`;
    document.getElementById("wave").textContent = `Wave ${Math.min(this.waveIndex, WAVES.length)} / ${WAVES.length}`;
    document.getElementById("gold").textContent = `💰 ${Math.floor(this.gold)}`;
    document.getElementById("lives").textContent = `❤ ${Math.max(0, this.lives)}`;
  }
  renderPB() { document.getElementById("pb").textContent = this.pb == null ? "PB —" : "PB " + fmt(this.pb); }
  setWaveText(name, hint) { document.getElementById("waveName").textContent = name; document.getElementById("waveHint").textContent = hint; }

  hideOverlay() { const o = document.getElementById("overlay"); o.className = "overlay hidden"; o.innerHTML = ""; }
  overlay(html) { const o = document.getElementById("overlay"); o.className = "overlay"; o.innerHTML = html; return o; }
  showStart() {
    const o = this.overlay(`<h2>🟢 Green Circle TD</h2><p>Place towers along the path. Match damage types to enemy armor.<br>Survive all 30 waves — as fast as you can.</p><button id="goBtn">Begin</button>`);
    o.querySelector("#goBtn").onclick = () => { this.hideOverlay(); this.state = "running"; };
  }
  end(won) {
    this.state = won ? "won" : "lost";
    this.elapsed = nowMs() - this.startMs;
    let sub = "";
    if (won) {
      if (this.pb == null || this.elapsed < this.pb) { this.pb = this.elapsed; savePB(this.pb); this.renderPB(); sub = "🏆 New personal best!"; }
      else sub = this.pb != null ? `PB ${fmt(this.pb)}` : "";
    } else sub = `Reached wave ${Math.min(this.waveIndex, WAVES.length)} / ${WAVES.length}.`;
    const o = this.overlay(`<h2>${won ? "The Crown is Yours!" : "Overrun"}</h2><p>Time ${fmt(this.elapsed)}</p><p>${sub}</p><button id="rsBtn">${won ? "Play again" : "Retry"}</button>`);
    o.querySelector("#rsBtn").onclick = () => this.restart();
    this.refreshButtons();
  }
  restart() { this.reset(); this.state = "running"; this.hideOverlay(); this.renderPB(); this.refreshButtons(); this.setWaveText("Ready", "Build a tower, then start the first wave."); }

  // ---- input
  bindInput() {
    const scale = () => { const r = this.canvas.getBoundingClientRect(); return { r, sx: this.canvas.width / r.width, sy: this.canvas.height / r.height }; };
    this.canvas.addEventListener("mousemove", (e) => {
      const { r, sx, sy } = scale();
      const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
      this.hoverCell = { c: Math.floor(x / CELL), r: Math.floor(y / CELL), x, y };
    });
    this.canvas.addEventListener("mouseleave", () => { this.hoverCell = null; });
    this.canvas.addEventListener("click", () => {
      if (this.state === "ready") { this.hideOverlay(); this.state = "running"; return; }
      if (this.state !== "running" || !this.hoverCell) return;
      this.build(this.hoverCell.c, this.hoverCell.r, this.selected);
    });
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      for (const [id, d] of Object.entries(TOWERS)) if (d.key === k) this.select(id);
      if (k === "escape") this.selected = "basic", this.refreshButtons();
      else if (k === "s" && this.hoverCell) this.sellAt(this.hoverCell.c, this.hoverCell.r);
      else if (k === " " || e.code === "Space") { e.preventDefault(); if (this.state === "running") this.startNextWave(); else if (this.state === "won" || this.state === "lost") this.restart(); }
    });
  }

  build(c, r, type) {
    const def = TOWERS[type];
    if (this.gold < def.cost || !this.cellBuildable(c, r)) return false;
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    const t = { c, r, x, y, type, def, lastFire: -999, dmgMult: 1, cdMult: 1 };
    this.towers.push(t);
    this.occupied.add(c + "," + r);
    this.gold -= def.cost;
    this.recomputeAuras();
    this.refreshButtons();
    return true;
  }
  sellAt(c, r) {
    const idx = this.towers.findIndex((t) => t.c === c && t.r === r);
    if (idx < 0) return;
    this.gold += Math.floor(this.towers[idx].def.cost * 0.7);
    this.occupied.delete(c + "," + r);
    this.towers.splice(idx, 1);
    this.recomputeAuras();
    this.refreshButtons();
  }
  recomputeAuras() {
    for (const t of this.towers) { t.dmgMult = 1; t.cdMult = 1; }
    for (const a of this.towers) {
      if (!a.def.aura) continue;
      for (const t of this.towers) {
        if (t === a) continue;
        if (Math.hypot(t.x - a.x, t.y - a.y) <= a.def.aura.radius) {
          if (a.def.aura.type === "dmg") t.dmgMult += a.def.aura.value;
          else if (a.def.aura.type === "cd") t.cdMult = Math.max(0.3, t.cdMult - a.def.aura.value);
        }
      }
    }
  }

  // ---- waves
  startNextWave() {
    if (this.waveActive || this.waveIndex >= WAVES.length || this.state !== "running") return;
    const w = WAVES[this.waveIndex];
    this.waveIndex++;
    this.waveActive = true;
    this.waveClock = 0;
    if (!this.startMs) this.startMs = nowMs();   // run timer starts on first wave
    this.setWaveText(`Wave ${w.id}: ${w.name}`, w.hint);
    // build spawn queue
    this.spawnQueue = [];
    const hpBase = 30 + this.waveIndex * 9;
    for (const sp of w.spawns) {
      const e = ENEMIES[sp.e];
      const count = Math.max(1, sp.n + e.count_bonus);
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({
          time: sp.at + i * sp.iv,
          enemy: sp.e, def: e,
          hp: hpBase * e.health_mult,
          speed: BASE_SPEED * e.speed_mult,
          bounty: 3 + Math.floor(this.waveIndex / 3) + e.bounty_bonus,
          reward: w.reward,
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.refreshButtons();
  }

  spawnEnemy(s) {
    this.enemies.push({
      x: PATH[0][0], y: PATH[0][1], wp: 0,
      hp: s.hp, maxHp: s.hp, speed: s.speed,
      def: s.def, enemy: s.enemy, bounty: s.bounty, reward: s.reward,
      flags: s.def.flags, armor: s.def.armor, color: s.def.color,
      slowUntil: 0, poison: 0, poisonUntil: 0, revealed: false,
    });
  }

  // ---- simulation
  update(dt) {
    if (this.state !== "running") return;
    this.gameTime += dt;
    if (this.waveActive) {
      this.waveClock += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveClock) this.spawnEnemy(this.spawnQueue.shift());
    }

    // detector reveal for invisible enemies
    const detectors = this.towers.filter((t) => t.def.detect);
    for (const en of this.enemies) {
      if (en.flags.includes("invisible")) {
        en.revealed = detectors.some((d) => Math.hypot(d.x - en.x, d.y - en.y) <= d.def.range);
      } else en.revealed = true;
    }

    this.moveEnemies(dt);
    this.fireTowers();
    for (const b of this.bullets) b.t -= dt;
    this.bullets = this.bullets.filter((b) => b.t > 0);

    // poison ticks + cull
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.poison > 0 && this.gameTime < en.poisonUntil) en.hp -= en.poison * dt;
      if (en.hp <= 0) this.onKill(en);
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.leaked);

    // wave clear?
    if (this.waveActive && !this.spawnQueue.length && this.enemies.length === 0) {
      this.waveActive = false;
      const w = WAVES[this.waveIndex - 1];
      this.gold += w.reward;
      this.setWaveText(`Wave ${w.id} cleared`, this.waveIndex >= WAVES.length ? "Final wave done!" : `+${w.reward}g. Next: ${WAVES[this.waveIndex].name}`);
      if (this.waveIndex >= WAVES.length) { this.end(true); return; }
      this.refreshButtons();
    }
    if (this.lives <= 0) this.end(false);
  }

  moveEnemies(dt) {
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const speed = en.speed * (this.gameTime < en.slowUntil ? 0.45 : 1);
      let remaining = speed * dt;
      while (remaining > 0 && en.wp < PATH.length - 1) {
        const tx = PATH[en.wp + 1][0], ty = PATH[en.wp + 1][1];
        const dx = tx - en.x, dy = ty - en.y, d = Math.hypot(dx, dy) || 1;
        if (d <= remaining) { en.x = tx; en.y = ty; en.wp++; remaining -= d; }
        else { en.x += (dx / d) * remaining; en.y += (dy / d) * remaining; remaining = 0; }
      }
      if (en.wp >= PATH.length - 1) { en.leaked = true; this.onLeak(en); }
    }
  }

  fireTowers() {
    const t = this.gameTime;
    for (const tw of this.towers) {
      const d = tw.def;
      if (!d.dtype && !d.detect) continue;        // pure aura towers don't shoot
      const eff = (d.cd / 60) * tw.cdMult;        // seconds
      if (t - tw.lastFire < eff) continue;
      const target = this.pickTarget(tw);
      if (!target) continue;
      tw.lastFire = t;
      this.bullets.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: d.color, t: 0.09 });
      const base = d.damage * tw.dmgMult;
      if (d.splash) {
        for (const en of this.enemies) {
          if (en.hp <= 0) continue;
          if (Math.hypot(en.x - target.x, en.y - target.y) <= d.splash) this.hit(en, base, d);
        }
      } else this.hit(target, base, d);
    }
  }
  pickTarget(tw) {
    let best = null, bestProg = -Infinity;
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (en.flags.includes("invisible") && !en.revealed) continue;
      if (Math.hypot(en.x - tw.x, en.y - tw.y) > tw.def.range) continue;
      // furthest along the path: primary = waypoint index, tiebreak = closeness to next waypoint
      const next = PATH[Math.min(en.wp + 1, PATH.length - 1)];
      const distToNext = Math.hypot(en.x - next[0], en.y - next[1]);
      const prog = en.wp * 10000 - distToNext;
      if (prog > bestProg) { bestProg = prog; best = en; }
    }
    return best;
  }
  hit(en, base, d) {
    if (en.hp <= 0) return;
    const mult = d.dtype ? (ARMOR_MATRIX[d.dtype][en.armor] ?? 1) : 1;
    en.hp -= base * mult;
    const immune = en.flags.includes("immune");
    if (d.slow && !immune) en.slowUntil = this.gameTime + d.slowDur / 60;
    if (d.poison && !immune) { en.poison = d.poison; en.poisonUntil = this.gameTime + d.poisonDur / 60; }
    if (en.hp <= 0) this.onKill(en);
  }
  onKill(en) { if (en._dead) return; en._dead = true; this.gold += en.bounty; this.refreshButtons(); }
  onLeak(en) { const cost = en.flags.includes("boss") ? 10 : en.flags.includes("hero") ? 4 : 1; this.lives -= cost; this.refreshButtons(); }

  // ---- loop + render
  loop() {
    const t = nowMs();
    let dt = (t - this.last) / 1000; this.last = t;
    if (dt > 0.05) dt = 0.05;
    this.update(dt);
    if (this.state === "running" && this.startMs) this.elapsed = t - this.startMs;
    document.getElementById("timer").textContent = fmt(this.elapsed);
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 960, 600);
    ctx.fillStyle = "#0c130d"; ctx.fillRect(0, 0, 960, 600);
    // path
    ctx.strokeStyle = "#243a29"; ctx.lineWidth = 30; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(PATH[0][0], PATH[0][1]); for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i][0], PATH[i][1]); ctx.stroke();
    ctx.strokeStyle = "#172419"; ctx.lineWidth = 22; ctx.stroke();
    // base
    ctx.fillStyle = "#86efac"; ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 16, 0, 7); ctx.fill();
    ctx.fillStyle = "#07120a"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("◎", BASE.x, BASE.y);

    // hover build preview
    if (this.hoverCell && this.state === "running") {
      const { c, r } = this.hoverCell;
      const def = TOWERS[this.selected];
      const ok = this.gold >= def.cost && this.cellBuildable(c, r);
      ctx.fillStyle = ok ? "rgba(134,239,172,.22)" : "rgba(248,113,113,.22)";
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      if (ok && def.range > 0) {
        ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, def.range, 0, 7); ctx.stroke();
      }
      if (ok && def.aura) {
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, def.aura.radius, 0, 7); ctx.stroke();
      }
    }

    // towers
    for (const tw of this.towers) {
      const x = tw.c * CELL, y = tw.r * CELL;
      ctx.fillStyle = tw.def.color;
      this.round(x + 5, y + 5, CELL - 10, CELL - 10, 6); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(tw.x, tw.y, 4, 0, 7); ctx.fill();
      if (tw.def.detect) { ctx.strokeStyle = "rgba(255,214,78,.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tw.x, tw.y, tw.def.range, 0, 7); ctx.stroke(); }
    }

    // bullets
    for (const b of this.bullets) { ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.globalAlpha = b.t / 0.09; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // enemies
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      const boss = en.flags.includes("boss"), hero = en.flags.includes("hero");
      const rad = boss ? 16 : hero ? 12 : en.enemy === "Swarm" ? 6 : 9;
      const inv = en.flags.includes("invisible") && !en.revealed;
      ctx.globalAlpha = inv ? 0.28 : 1;
      ctx.fillStyle = en.color; ctx.beginPath(); ctx.arc(en.x, en.y, rad, 0, 7); ctx.fill();
      if (en.flags.includes("air")) { ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(en.x, en.y, rad + 3, 0, 7); ctx.stroke(); }
      if (this.gameTime < en.slowUntil) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(en.x, en.y, rad, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const w = rad * 2 + 6, hpf = clamp(en.hp / en.maxHp, 0, 1);
      ctx.fillStyle = "#000"; ctx.fillRect(en.x - w / 2, en.y - rad - 7, w, 4);
      ctx.fillStyle = hpf > 0.5 ? "#4ade80" : hpf > 0.25 ? "#facc15" : "#f87171";
      ctx.fillRect(en.x - w / 2, en.y - rad - 7, w * hpf, 4);
    }
    ctx.lineWidth = 1;
  }

  round(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}

window.__gctd = new Game();

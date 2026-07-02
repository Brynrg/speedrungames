"use strict";
/*
 * Line Tower Wars — standalone web game for speedrungames.net.
 * Single-player vs AI. Maze your lane to kill incoming creeps; send creeps at
 * the enemy to raise income and drain their lives. Drop the enemy to 0 lives
 * as fast as you can (speedrun). No backend — fully static.
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
      });
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

    this.bullets = [];          // transient visual shots
    this.bindUI();
    this.bindInput();
    this.renderPB();
    requestAnimationFrame(() => this.loop());
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
    this.incomeTimer = INCOME_INTERVAL;
    this.aiBuildTimer = 0.8;
    this.aiSendTimer = 4;
    this.bullets = [];
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
    this.showOverlay(`<h2>🏰 Line Tower Wars</h2><p>Maze your lane. Send creeps at the enemy. Drop them to 0 lives — fast.</p><button id="startBtn">Start</button>`);
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
    const sub = won ? (this._newPB ? `🏆 New personal best!` : (this.pb != null ? `PB ${formatTime(this.pb)}` : "")) : "The enemy overran your lane.";
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

    // bullets (visual only)
    for (const b of this.bullets) b.t -= dt;
    this.bullets = this.bullets.filter((b) => b.t > 0);

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
    }

    // towers fire (sim-time cooldowns — wall-clock here made towers burst-fire
    // after a hidden-tab freeze and broke pause)
    const t = this.gameTime;
    for (const tw of f.towers) {
      if (t - tw.lastFire < tw.def.interval) continue;
      const target = this.pickTarget(f, tw);
      if (!target) continue;
      tw.lastFire = t;
      this.bullets.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: tw.def.color, t: 0.08 });
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
    ctx.fillStyle = "#0d1018";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawField(this.player, "YOU", "#60a5fa");
    this.drawField(this.ai, "ENEMY", "#f87171");
    if (this.state === "paused") {
      const ctx2 = this.ctx;
      ctx2.fillStyle = "rgba(13, 16, 24, 0.55)";
      ctx2.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx2.fillStyle = "#e2e8f0";
      ctx2.font = "700 34px system-ui, sans-serif";
      ctx2.textAlign = "center";
      ctx2.fillText("Paused — press P to resume", this.canvas.width / 2, this.canvas.height / 2);
    }
    this.drawDivider();
    // bullets
    for (const b of this.bullets) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.globalAlpha = b.t / 0.08;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }

  drawField(f, label, accent) {
    const ctx = this.ctx, ox = f.ox;
    // HUD strip
    ctx.fillStyle = accent; ctx.font = "bold 14px system-ui";
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(label, ox, HUD_H / 2 - 8);
    ctx.fillStyle = "#e7ecf3"; ctx.font = "13px system-ui";
    ctx.fillText(`❤ ${Math.max(0, f.lives)}   💰 ${Math.floor(f.gold)}   +${f.income}/s`, ox, HUD_H / 2 + 9);

    // grid background
    ctx.fillStyle = "#11151f";
    ctx.fillRect(ox, GY, FIELD_W, FIELD_H);
    // spawn + exit bands
    ctx.fillStyle = "rgba(248,113,113,0.10)"; ctx.fillRect(ox, GY, FIELD_W, CELL);
    ctx.fillStyle = "rgba(96,165,250,0.10)";  ctx.fillRect(ox, GY + FIELD_H - CELL, FIELD_W, CELL);
    ctx.strokeStyle = "#1d2536"; ctx.lineWidth = 1;
    for (let c = 0; c <= GCOLS; c++) { ctx.beginPath(); ctx.moveTo(ox + c * CELL, GY); ctx.lineTo(ox + c * CELL, GY + FIELD_H); ctx.stroke(); }
    for (let r = 0; r <= GROWS; r++) { ctx.beginPath(); ctx.moveTo(ox, GY + r * CELL); ctx.lineTo(ox + FIELD_W, GY + r * CELL); ctx.stroke(); }

    // spawn marker
    const sp = f.cellCenter(SPAWN_COL, 0);
    ctx.fillStyle = "#f87171"; ctx.textAlign = "center";
    ctx.font = "16px system-ui"; ctx.fillText("▼", sp.x, GY + CELL / 2);

    // build hover preview (player only)
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

    // towers
    for (const tw of f.towers) {
      const x = ox + tw.c * CELL, y = GY + tw.r * CELL;
      ctx.fillStyle = tw.def.color;
      this.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 6); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.arc(tw.x, tw.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // creeps
    for (const cr of f.creeps) {
      if (cr.hp <= 0) continue;
      const rad = 8 + (cr.maxHp > 60 ? 4 : 0);
      ctx.fillStyle = cr.color;
      ctx.beginPath(); ctx.arc(cr.x, cr.y, rad, 0, Math.PI * 2); ctx.fill();
      if (this.gameTime < cr.slowUntil) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.stroke(); }
      // hp bar
      const w = 22, hpf = clamp(cr.hp / cr.maxHp, 0, 1);
      ctx.fillStyle = "#000"; ctx.fillRect(cr.x - w / 2, cr.y - rad - 7, w, 4);
      ctx.fillStyle = hpf > 0.5 ? "#4ade80" : hpf > 0.25 ? "#facc15" : "#f87171";
      ctx.fillRect(cr.x - w / 2, cr.y - rad - 7, w * hpf, 4);
    }
    ctx.lineWidth = 1;
  }

  drawDivider() {
    const ctx = this.ctx, midx = (PX + FIELD_W + AX) / 2;
    ctx.strokeStyle = "#26314a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(midx, GY); ctx.lineTo(midx, GY + FIELD_H); ctx.stroke();
    ctx.fillStyle = "#3a4a70"; ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("VS", midx, GY + FIELD_H / 2);
    ctx.lineWidth = 1;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// expose a tiny hook for smoke tests, then boot
window.__ltw = new Game();

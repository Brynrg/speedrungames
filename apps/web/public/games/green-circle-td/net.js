"use strict";
/*
 * net.js — online multiplayer client for Green Circle TD.
 *
 * Loads AFTER main.js (shares its top-level consts: TOWERS, ENEMIES, SPECS,
 * statsFor, CELL, PLAYER_COLORS, fmt, WAVES). The server (gctd-server) is
 * authoritative: it runs the one true sim and streams compact snapshots at
 * 15Hz; this file mirrors that state into the Game object so the existing
 * renderer draws it, and converts player actions into protocol messages.
 *
 * Lobby model (WC3-style): create a room → share the 4-letter code → host
 * starts. Up to 4 players, each owns a build zone, lives are shared.
 */

(() => {
  const DEFAULT_SERVER = "wss://gctd-server.fly.dev";
  const serverUrl = () => {
    try {
      const q = new URLSearchParams(location.search).get("server");
      return q || localStorage.getItem("gctd:server") || DEFAULT_SERVER;
    } catch { return DEFAULT_SERVER; }
  };
  const loadName = () => { try { return localStorage.getItem("gctd:name") || ""; } catch { return ""; } };
  const saveName = (n) => { try { localStorage.setItem("gctd:name", n); } catch {} };

  const NET_ENEMY_KEYS = Object.keys(ENEMIES);
  const NET_TOWER_KEYS = Object.keys(TOWERS);

  class NetSession {
    constructor(game) {
      this.game = game;
      this.ws = null;
      this.code = null;
      this.you = 0;
      this.host = 0;
      this.names = [];
      this.inGame = false;
      this.enemyMap = new Map(); // server enemy id -> mirrored render object
      this.onLobbyUpdate = null; // set by the lobby UI
      this.onLobbyError = null;
    }

    connect(firstMsg) {
      const ws = (this.ws = new WebSocket(serverUrl()));
      ws.onopen = () => ws.send(JSON.stringify(firstMsg));
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.handle(m); };
      ws.onclose = () => this.onDisconnect();
      ws.onerror = () => {}; // close fires after error
    }
    send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    close(silent) { if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch {} } if (!silent) this.ws = null; }

    onDisconnect() {
      if (!this.inGame) {
        if (this.onLobbyError) this.onLobbyError("Could not reach the game server.");
        return;
      }
      const g = this.game;
      if (g.state === "won" || g.state === "lost") return; // game over screen already up
      g.state = "paused";
      const o = g.overlay(`<h2>Connection lost</h2><p>The link to the game server dropped.</p><button id="nReload">Back to menu</button>`, "state-lost");
      o.querySelector("#nReload").onclick = () => location.reload();
    }

    handle(m) {
      switch (m.t) {
        case "joined": this.code = m.code; this.you = m.you; this.host = m.host; break;
        case "players":
          this.names = m.players.map((p) => p.name);
          this.host = m.host;
          if (m.you !== undefined) this.you = m.you;
          if (this.inGame) this.applyNames();
          if (this.onLobbyUpdate) this.onLobbyUpdate(m.players, m.host);
          break;
        case "err": if (this.onLobbyError) this.onLobbyError(m.msg); break;
        case "started": this.onStarted(m); break;
        case "towers": this.onTowers(m); break;
        case "s": this.onSnap(m); break;
        case "wave": this.onWave(m); break;
        case "cleared": this.onCleared(m); break;
        case "speed": this.onSpeed(m); break;
        case "over": this.onOver(m); break;
      }
    }

    // ---- game start: hand the Game object over to network mode
    onStarted(m) {
      const g = this.game;
      this.inGame = true;
      this.you = m.you;
      this.names = m.names;
      g.numPlayers = m.n;
      g.reset();
      g.net = this;
      g.activePlayer = m.you;
      this.applyNames();
      g.state = "running";
      g.hideOverlay();
      const pauseBtn = document.getElementById("pauseBtn");
      if (pauseBtn) pauseBtn.style.display = "none"; // no pausing an online game
      g.setWaveText(`Online co-op · room ${this.code}`, "Build towers, then send the first wave. Lives are shared!");
      g.renderPlayerPanel();
      g.refreshButtons();
    }
    applyNames() {
      const g = this.game;
      g.players.forEach((p, i) => { p.name = this.names[i] || `P${i + 1}`; });
      if (g.players[this.you]) g.players[this.you].name += " (you)";
    }

    // ---- authoritative tower list (rebuilt on every change)
    onTowers(m) {
      const g = this.game;
      const old = new Map(g.towers.map((t) => [t.c + "," + t.r, t]));
      g.towers = m.tw.map(([c, r, ti, level, si, player, invested]) => {
        const type = NET_TOWER_KEYS[ti];
        const spec = si >= 0 ? SPECS[type][si].id : null;
        const prev = old.get(c + "," + r);
        return {
          c, r, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
          type, def: TOWERS[type], level, spec, invested,
          s: statsFor(type, level, spec), lastFire: -999, dmgMult: 1, cdMult: 1,
          angle: prev ? prev.angle : -Math.PI / 2, player,
        };
      });
      g.occupied = new Set(m.tw.map(([c, r]) => c + "," + r));
      m.g.forEach((gold, i) => { if (g.players[i]) g.players[i].gold = gold; });
      g.recomputeAuras();
      if (g.selectedTower) {
        g.selectedTower = g.towers.find((t) => t.c === g.selectedTower.c && t.r === g.selectedTower.r) || null;
        g.renderInspector();
      }
      g.refreshButtons();
    }

    // ---- 15Hz snapshot: enemies, golds, lives, fx events
    onSnap(m) {
      const g = this.game;
      g.lives = m.lv;
      g.runMs = m.ms;
      g.waveIndex = m.wi;
      g.activeWaves.length = m.aw; // only .length is read in online mode
      m.g.forEach((gold, i) => { if (g.players[i]) g.players[i].gold = gold; });

      const seen = new Set();
      for (const [id, ki, x, y, h, prog, ang, st] of m.e) {
        let en = this.enemyMap.get(id);
        if (!en) {
          const kind = NET_ENEMY_KEYS[ki], def = ENEMIES[kind];
          en = {
            x, y, tx: x, ty: y, hp: h, maxHp: 1, wp: 0,
            enemy: kind, def, flags: def.flags, armor: def.armor, color: def.color,
            slowUntil: 0, poison: 0, poisonUntil: 0, revealed: true,
            netAng: ang, netProg: prog,
          };
          this.enemyMap.set(id, en);
        }
        en.tx = x; en.ty = y; en.hp = h; en.netAng = ang; en.netProg = prog;
        en.slowUntil = st & 1 ? g.gameTime + 0.25 : 0;
        if (st & 2) { en.poison = 1; en.poisonUntil = g.gameTime + 0.25; } else en.poison = 0;
        en.revealed = !!(st & 4);
        seen.add(id);
      }
      for (const id of [...this.enemyMap.keys()]) if (!seen.has(id)) this.enemyMap.delete(id);
      g.enemies = [...this.enemyMap.values()];

      // tracers + muzzle/spark fx from server shot events. Bullets/sparks
      // render from the shared decay ramp (see drawTower/draw in main.js) —
      // `color` is kept on the bullet record for shape parity but unused.
      for (const [x1, y1, x2, y2, ti] of m.sh) {
        const color = TOWERS[NET_TOWER_KEYS[ti]]?.color || "#fff";
        if (g.bullets.length < 300) g.bullets.push({ x1, y1, x2, y2, color, t: 0.09 });
        g.spawnFx(x1, y1, DECAY.hot, "muzzle", Math.atan2(y2 - y1, x2 - x1));
        g.spawnFx(x2, y2, DECAY.hot, "spark");
      }
      // death puffs (+ shake on boss/hero)
      for (const [x, y, ki] of m.dx) {
        const def = ENEMIES[NET_ENEMY_KEYS[ki]];
        g.spawnFx(x, y, def.color, "puff");
        if (def.flags.includes("boss")) g.shakeCamera(0.38, 7);
        else if (def.flags.includes("hero")) g.shakeCamera(0.18, 3);
      }
      g.refreshButtons();
    }

    onWave(m) {
      const g = this.game;
      g.started = true;
      const title = m.bonus ? `Wave ${m.id}: ${m.name}  +${m.bonus}g ★ ${m.by || ""}` : `Wave ${m.id}: ${m.name}`;
      g.setWaveText(title, m.hint);
      g.setArmorPill(m.armor, m.air);
      const wavePanel = document.getElementById("wavePanel");
      if (wavePanel) wavePanel.classList.toggle("boss-wave", !!m.boss);
      if (m.boss) g.shakeCamera(0.55, 10);
      g.refreshButtons();
    }

    onCleared(m) {
      const g = this.game;
      const extras = [];
      if (m.mint > 0) extras.push(`+${m.mint}g mint`);
      if (m.interest > 0) extras.push(`+${m.interest}g interest`);
      const extStr = extras.length ? ` · ${extras.join(", ")}` : "";
      const wavePanel = document.getElementById("wavePanel");
      if (wavePanel) wavePanel.classList.remove("boss-wave");
      if (m.next === null) g.setWaveText("All clear", "Final wave done!");
      else g.setWaveText(`Wave ${m.id} cleared`, `+${m.reward}g${extStr}. Next: ${m.next}`);
      g.setArmorPill([]);
      g.refreshButtons();
    }

    onSpeed(m) {
      const g = this.game;
      g.speed = m.v; // display only — loop() forces 1 sim-visual step in net mode
      g.syncSpeedSeg();
    }

    onOver(m) {
      const g = this.game;
      g.state = m.won ? "won" : "lost";
      g.elapsed = g.runMs = m.ms;
      const sub = m.won ? "Co-op victory! 🏆" : `Reached wave ${m.wave ?? "?"} / ${WAVES.length}.`;
      const o = g.overlay(
        `<h2>${m.won ? "The Crown is Yours!" : "Overrun"}</h2><p>Time ${fmt(m.ms)}</p><p>${sub}</p><button id="nMenuBtn">Back to menu</button>`,
        m.won ? "state-won" : "state-lost",
      );
      o.querySelector("#nMenuBtn").onclick = () => location.reload();
      g.refreshButtons();
      this.close(true);
    }
  }

  // ------------------------------------------------------------- lobby UI
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function openLobby(game) {
    const session = new NetSession(game);

    const menu = () => {
      const o = game.overlay(
        `<h2>🌐 Online Multiplayer</h2>` +
        `<p>Co-op for 2–4 players. Each player builds in their own zone, gold is per player, lives are shared — just like the WC3 original.</p>` +
        `<input id="nName" class="ninput" placeholder="Your name" maxlength="12" value="${esc(loadName())}">` +
        `<div class="nbtns">` +
        `<button id="nCreate">Create game</button>` +
        `<div class="njoin"><input id="nCode" class="ninput ncodein" placeholder="CODE" maxlength="4"><button id="nJoin">Join</button></div>` +
        `</div>` +
        `<div id="nErr" class="nerr hidden"></div>` +
        `<button id="nBack" class="nghost">← Back</button>`,
      );
      const err = (msg) => { const e = o.querySelector("#nErr"); e.textContent = msg; e.classList.remove("hidden"); };
      session.onLobbyError = err;
      const name = () => {
        const v = o.querySelector("#nName").value.trim() || "Player";
        saveName(v);
        return v;
      };
      o.querySelector("#nCreate").onclick = () => { session.connect({ t: "create", name: name() }); waiting(); };
      o.querySelector("#nJoin").onclick = () => {
        const code = o.querySelector("#nCode").value.trim().toUpperCase();
        if (code.length !== 4) return err("Enter the 4-letter room code.");
        session.connect({ t: "join", code, name: name() });
        waiting();
      };
      o.querySelector("#nCode").oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); };
      o.querySelector("#nBack").onclick = () => { session.close(); game.showStart(); };
    };

    const waiting = () => {
      const o = game.overlay(
        `<h2>Room <span class="ncode" id="nRoomCode">····</span></h2>` +
        `<p id="nShare">Connecting…</p>` +
        `<div class="nplayers" id="nPlayers"></div>` +
        `<div id="nErr" class="nerr hidden"></div>` +
        `<div id="nStartRow"></div>` +
        `<button id="nLeave" class="nghost">← Leave</button>`,
      );
      o.querySelector("#nLeave").onclick = () => { session.close(); menu(); };
      session.onLobbyError = (msg) => {
        const e = o.querySelector("#nErr");
        if (e) { e.textContent = msg; e.classList.remove("hidden"); }
        setTimeout(() => menu(), 1600);
        session.onLobbyError = null;
      };
      session.onLobbyUpdate = (players, host) => {
        const codeEl = o.querySelector("#nRoomCode");
        if (codeEl && session.code) codeEl.textContent = session.code;
        const share = o.querySelector("#nShare");
        if (share) share.textContent = "Share this code with friends — they hit Online → Join.";
        const list = o.querySelector("#nPlayers");
        if (list)
          list.innerHTML = players.map((p, i) =>
            `<div class="nprow"><span class="pgdot" style="border-color:${PLAYER_COLORS[i]}"></span>` +
            `<span class="pgname">${esc(p.name)}${i === session.you ? " (you)" : ""}${i === host ? " · host" : ""}</span>` +
            `<span class="nstat">${p.connected ? "ready" : "left"}</span></div>`,
          ).join("");
        const row = o.querySelector("#nStartRow");
        if (row) {
          if (session.you === host) {
            row.innerHTML = `<button id="nStart">Start game · ${players.length} player${players.length > 1 ? "s" : ""}</button>`;
            row.querySelector("#nStart").onclick = () => session.send({ t: "start" });
          } else {
            row.innerHTML = `<p class="nwait">Waiting for the host to start…</p>`;
          }
        }
      };
    };

    menu();
    return session;
  }

  window.GCTDNet = { openLobby };
})();

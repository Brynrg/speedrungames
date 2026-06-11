import { dealDamageToEnemy } from "./combat.js";
import { COLS, ROWS, TILE } from "./constants.js";
import { inBounds, worldFromCell } from "./grid.js";
import { update } from "./loop.js";
import { mazeDistances } from "./maze.js";
import { DIR4, DUEL_WAYPOINTS, MAZE_EXIT, MAZE_START, WAYPOINTS } from "./paths.js";
import { Effect } from "./projectiles.js";
import { effects, enemies, game } from "./state.js";

export class Enemy {
  constructor(stats) {
    this.name = stats.name || "Creep";
    this.armorType = stats.armorType || "medium";
    this.flying = !!stats.flying;
    this.magicImmune = !!stats.magicImmune;
    this.mechanical = !!stats.mechanical;
    this.slowImmune = !!stats.slowImmune;
    this.splitter = !!stats.splitter;
    this.splitDepth = stats.splitDepth || 0;
    this.isBoss = !!stats.isBoss;

    this.maxHp = Math.max(1, Math.round(stats.hp));
    this.hp = this.maxHp;
    this.speed = stats.speed;
    this.reward = stats.reward;
    this.leakDamage = stats.leakDamage || 1;
    this.radius = stats.radius || (this.isBoss ? 20 : this.flying ? 12 : 13);
    this.lane = stats.lane || 0;
    this.targetPlayer = stats.targetPlayer !== undefined ? stats.targetPlayer : this.lane;

    this.color = stats.color || (this.flying ? "#8bb8df" : "#c9645f");
    this.rim = stats.rim || (this.flying ? "#d5ecff" : "#f0c8a4");

    const spawn = stats.spawn || {};
    this.routeMode = stats.routeMode || this.inferRouteMode();
    this.pathIndex = spawn.pathIndex || 0;
    this.segmentProgress = spawn.segmentProgress || 0;
    this.progress = stats.progress || 0;

    const classicRoute = this.routeMode === "duel-classic" ? DUEL_WAYPOINTS[this.lane] || DUEL_WAYPOINTS[0] : WAYPOINTS;
    const classicAnchor = classicRoute[Math.min(this.pathIndex, classicRoute.length - 1)] || classicRoute[0];
    const mazeStartWorld = worldFromCell(MAZE_START.cx, MAZE_START.cy);
    const spawnAnchor = this.routeMode === "maze-ground" ? mazeStartWorld : classicAnchor;
    this.x = spawn.x ?? spawnAnchor.x;
    this.y = spawn.y ?? spawnAnchor.y;

    this.routePoints =
      this.routeMode === "maze-air"
        ? [mazeStartWorld, worldFromCell(MAZE_EXIT.cx, MAZE_EXIT.cy)]
        : this.routeMode === "duel-classic"
          ? DUEL_WAYPOINTS[this.lane] || DUEL_WAYPOINTS[0]
          : WAYPOINTS;
    this.mazeTargetX = spawn.mazeTargetX ?? null;
    this.mazeTargetY = spawn.mazeTargetY ?? null;

    this.slowFactor = 1;
    this.slowTimer = 0;
    this.auraSlowFactor = 1;
    this.burnDps = 0;
    this.burnTimer = 0;
    this.burnTick = 0;
    this.leaked = false;
    this.dead = false;
  }

  inferRouteMode() {
    if (game.mode === "duel") {
      return "duel-classic";
    }
    if (game.mode !== "maze") {
      return "classic";
    }
    return this.flying ? "maze-air" : "maze-ground";
  }

  serialize() {
    return {
      name: this.name,
      armorType: this.armorType,
      flying: this.flying,
      magicImmune: this.magicImmune,
      mechanical: this.mechanical,
      slowImmune: this.slowImmune,
      splitter: this.splitter,
      splitDepth: this.splitDepth,
      isBoss: this.isBoss,
      hp: this.hp,
      maxHp: this.maxHp,
      speed: this.speed,
      reward: this.reward,
      leakDamage: this.leakDamage,
      radius: this.radius,
      lane: this.lane,
      targetPlayer: this.targetPlayer,
      color: this.color,
      rim: this.rim,
      routeMode: this.routeMode,
      progress: this.progress,
      x: this.x,
      y: this.y,
      pathIndex: this.pathIndex,
      segmentProgress: this.segmentProgress,
      mazeTargetX: this.mazeTargetX,
      mazeTargetY: this.mazeTargetY,
      slowFactor: this.slowFactor,
      slowTimer: this.slowTimer,
      auraSlowFactor: this.auraSlowFactor,
      burnDps: this.burnDps,
      burnTimer: this.burnTimer,
      burnTick: this.burnTick,
    };
  }

  static fromSave(data) {
    const enemy = new Enemy({
      name: data.name,
      armorType: data.armorType,
      flying: data.flying,
      magicImmune: data.magicImmune,
      mechanical: data.mechanical,
      slowImmune: data.slowImmune,
      splitter: data.splitter,
      splitDepth: data.splitDepth,
      isBoss: data.isBoss,
      hp: data.maxHp,
      speed: data.speed,
      reward: data.reward,
      leakDamage: data.leakDamage,
      radius: data.radius,
      lane: data.lane || 0,
      targetPlayer: data.targetPlayer !== undefined ? data.targetPlayer : data.lane || 0,
      color: data.color,
      rim: data.rim,
      routeMode: data.routeMode,
      progress: data.progress,
      spawn: {
        x: data.x,
        y: data.y,
        pathIndex: data.pathIndex,
        segmentProgress: data.segmentProgress,
        mazeTargetX: data.mazeTargetX,
        mazeTargetY: data.mazeTargetY,
      },
    });

    enemy.hp = data.hp;
    enemy.maxHp = data.maxHp;
    enemy.slowFactor = data.slowFactor !== undefined ? data.slowFactor : 1;
    enemy.slowTimer = data.slowTimer !== undefined ? data.slowTimer : 0;
    enemy.auraSlowFactor = data.auraSlowFactor !== undefined ? data.auraSlowFactor : 1;
    enemy.burnDps = data.burnDps !== undefined ? data.burnDps : 0;
    enemy.burnTimer = data.burnTimer !== undefined ? data.burnTimer : 0;
    enemy.burnTick = data.burnTick !== undefined ? data.burnTick : 0;
    return enemy;
  }

  applySlow(factor, duration) {
    if (this.slowImmune || this.magicImmune || this.mechanical) {
      effects.push(new Effect(this.x, this.y, "text", { text: "Immune", color: "#ffdca8" }));
      return;
    }

    if (this.slowTimer <= 0 || factor < this.slowFactor) {
      this.slowFactor = factor;
      this.slowTimer = duration;
      return;
    }

    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyBurn(dps, duration) {
    if (dps <= 0 || duration <= 0) {
      return;
    }
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
    this.burnTick = 0;
  }

  getGridCell() {
    return {
      cx: Math.max(0, Math.min(COLS - 1, Math.floor(this.x / TILE))),
      cy: Math.max(0, Math.min(ROWS - 1, Math.floor(this.y / TILE))),
    };
  }

  chooseNextMazeTarget() {
    if (!mazeDistances) {
      return false;
    }

    const { cx, cy } = this.getGridCell();
    if (cx === MAZE_EXIT.cx && cy === MAZE_EXIT.cy) {
      this.leaked = true;
      return false;
    }

    const here = mazeDistances[cy]?.[cx] ?? -1;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [dx, dy] of DIR4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) {
        continue;
      }
      const d = mazeDistances[ny]?.[nx] ?? -1;
      if (d < 0) {
        continue;
      }
      if (d < bestDistance) {
        bestDistance = d;
        best = { cx: nx, cy: ny };
      }
    }

    if (!best) {
      this.leaked = true;
      return false;
    }

    if (here >= 0 && bestDistance > here) {
      this.leaked = true;
      return false;
    }

    const target = worldFromCell(best.cx, best.cy);
    this.mazeTargetX = target.x;
    this.mazeTargetY = target.y;
    return true;
  }

  updateClassicOrAir(travel) {
    const from = this.routePoints[this.pathIndex];
    const to = this.routePoints[this.pathIndex + 1];
    if (!to) {
      this.leaked = true;
      return;
    }

    const dx = to.x - this.x;
    const dy = to.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (travel >= dist) {
      this.x = to.x;
      this.y = to.y;
      this.progress += dist;
      this.pathIndex += 1;
      this.segmentProgress = 0;
      if (this.pathIndex >= this.routePoints.length - 1) {
        this.leaked = true;
      }
      return;
    }

    this.x += (dx / dist) * travel;
    this.y += (dy / dist) * travel;
    this.progress += travel;

    const segLen = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    this.segmentProgress = Math.min(1, Math.hypot(this.x - from.x, this.y - from.y) / segLen);
  }

  updateMazeGround(travel) {
    let remaining = travel;
    let safety = 0;

    while (remaining > 0 && safety < 8) {
      safety += 1;
      if (this.leaked) {
        return;
      }

      const cell = this.getGridCell();
      if (cell.cx === MAZE_EXIT.cx && cell.cy === MAZE_EXIT.cy) {
        this.leaked = true;
        return;
      }

      if (this.mazeTargetX === null || this.mazeTargetY === null) {
        const ok = this.chooseNextMazeTarget();
        if (!ok) {
          return;
        }
      }

      const dx = this.mazeTargetX - this.x;
      const dy = this.mazeTargetY - this.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (remaining >= dist) {
        this.x = this.mazeTargetX;
        this.y = this.mazeTargetY;
        this.progress += dist;
        remaining -= dist;
        this.mazeTargetX = null;
        this.mazeTargetY = null;
        continue;
      }

      this.x += (dx / dist) * remaining;
      this.y += (dy / dist) * remaining;
      this.progress += remaining;
      remaining = 0;
    }
  }

  update(dt) {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
      }
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.burnTick += dt;

      while (this.burnTick >= 0.25 && this.burnTimer > -0.001) {
        this.burnTick -= 0.25;
        if (!enemies.includes(this)) {
          break;
        }
        const burnDamage = this.burnDps * 0.25;
        dealDamageToEnemy(this, burnDamage, "spell", null, { allowZero: true });
      }

      if (this.burnTimer <= 0) {
        this.burnTimer = 0;
        this.burnDps = 0;
        this.burnTick = 0;
      }
    }

    const effectiveSlow = Math.min(this.slowFactor, this.auraSlowFactor || 1);
    const speedMul = this.flying ? 1.05 : 1;
    const travel = this.speed * effectiveSlow * speedMul * dt;

    if (this.routeMode === "maze-ground") {
      this.updateMazeGround(travel);
      return;
    }

    this.updateClassicOrAir(travel);
  }
}

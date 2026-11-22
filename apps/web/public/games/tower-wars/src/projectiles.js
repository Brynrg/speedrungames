import { dealDamageToEnemy } from "./combat.js";
import { update } from "./loop.js";
import { areaEffects, effects, enemies, game } from "./state.js";
import { spawnBurst, spawnShockwave, spawnGroundScar, triggerShake } from "./vfx.js";

export class Projectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.target = config.target;
    this.sourceTower = config.sourceTower;
    this.speed = config.speed;
    this.radius = config.radius;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.splashRadius = config.splashRadius || 0;
    this.canSlow = config.canSlow;
    this.slowFactor = config.slowFactor;
    this.slowDuration = config.slowDuration;
    this.burnDps = config.burnDps || 0;
    this.burnDuration = config.burnDuration || 0;
    this.spawnFirePatch = !!config.spawnFirePatch;
     this.startX = this.x;
     this.startY = this.y;
     this.angle = 0; this.trail = []; this.progress = 0; this.arcHeight = (this.damageType === "siege" ? 26 : 0);
    this.freezeOnHit = config.freezeOnHit || null;

    this.trackX = config.target.x;
    this.trackY = config.target.y;
    this.dead = false;
  }

  impact(enemy, amount) {
    const result = dealDamageToEnemy(enemy, amount, this.damageType, this.sourceTower, { allowZero: true });
    enemy.hitFlash = 0.085; spawnBurst(enemy.x, enemy.y, this.damageType === "magic" ? "#7fe0ea" : this.damageType === "spell" ? "#c478ff" : "#ffe9a0", 4, 52, 2.0, 0.22);
    
    if (this.canSlow && result.damageDealt > 0 && this.slowFactor) {
      enemy.applySlow(this.slowFactor, this.slowDuration); if (Math.random() < 0.35) spawnGroundScar(enemy.x, enemy.y, 13, "frost", 3.5);
    }
    if (this.burnDps > 0 && this.burnDuration > 0) {
      enemy.applyBurn(this.burnDps, this.burnDuration);
    }
    if (this.freezeOnHit && result.damageDealt > 0) {
      enemy.applySlow(this.freezeOnHit.factor, this.freezeOnHit.duration); if (Math.random() < 0.35) spawnGroundScar(enemy.x, enemy.y, 13, "frost", 3.5);
      effects.push(new Effect(enemy.x, enemy.y, "ring", { radius: enemy.radius + 7, color: "rgba(182, 230, 255, 0.48)" }));
    }

    return result;
  }

  explode() {
    const splash = this.splashRadius;
    effects.push(new Effect(this.x, this.y, "explosion", { radius: splash }));
    game.shake = Math.max(game.shake, 2.6);
    spawnShockwave(this.x, this.y, this.splashRadius || 42, "#e2402a", 0.34); spawnBurst(this.x, this.y, "#ff9f43", 12, 95, 2.8, 0.42); spawnGroundScar(this.x, this.y, Math.min(24, (this.splashRadius || 36) * 0.45), "scorch", 6.5); triggerShake(2.6);
    
    for (const enemy of [...enemies]) {
      const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (d > splash) {
        continue;
      }
      const falloff = 1 - 0.45 * (d / (splash + 1));
      const amount = Math.max(1, Math.round(this.damage * falloff));
      this.impact(enemy, amount);
    }

    if (this.spawnFirePatch) {
      const patchRadius = Math.max(18, Math.round(splash * 0.9));
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: patchRadius,
          duration: 3.6,
          interval: 0.45,
          damage: Math.max(1, Math.round(this.damage * 0.22)),
          damageType: "spell",
          color: "rgba(255, 110, 44, 0.34)",
        })
      );
    }
  }

  update(dt) {
    if (this.dead) {
      return;
    }

    if (this.target && enemies.includes(this.target)) {
      this.trackX = this.target.x;
      this.trackY = this.target.y;
    }

    const dx = this.trackX - this.x;
    const dy = this.trackY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      this.dead = true;
      return;
    }
    this.trail.push({ x: this.x, y: this.y }); if (this.trail.length > 5) this.trail.shift(); this.angle = Math.atan2(dy, dx);
    const travel = this.speed * dt;
    if (travel >= dist) {
      this.x = this.trackX;
      this.y = this.trackY;
      this.progress = 1;
      if (this.splashRadius > 0) {
        this.explode();
      } else if (this.target && enemies.includes(this.target)) {
        this.impact(this.target, this.damage);
      }

      this.dead = true;
      return;
    }

    this.x += (dx / dist) * travel;
    this.y += (dy / dist) * travel;
  }    const totalDist = Math.hypot(this.trackX - this.startX, this.trackY - this.startY); this.progress = totalDist > 0.001 ? Math.max(0, Math.min(1, Math.hypot(this.x - this.startX, this.y - this.startY) / totalDist)) : 1;
}

export class Effect {
  constructor(x, y, kind, meta = {}) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.meta = meta;
    this.life = 0;
    this.maxLife = kind === "explosion" ? 0.45 : kind === "text" ? 0.7 : 0.3;
  }

  update(dt) {
    this.life += dt;
    if (this.kind === "text") {
      this.y -= dt * 12;
    }
    return this.life >= this.maxLife;
  }
}

export class AreaEffect {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.radius = config.radius;
    this.duration = config.duration;
    this.interval = config.interval;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.slowFactor = config.slowFactor;
    this.slowDuration = config.slowDuration;
    this.color = config.color;

    this.life = 0;
    this.tick = 0;
  }

  update(dt) {
    this.life += dt;
    this.tick -= dt;

    if (this.tick <= 0) {
      this.tick = this.interval;
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > this.radius) {
          continue;
        }
        dealDamageToEnemy(enemy, this.damage, this.damageType, null, { allowZero: true });
        if (this.slowFactor) {
          enemy.applySlow(this.slowFactor, this.slowDuration);
        }
      }
    }

    return this.life >= this.duration;
  }
}

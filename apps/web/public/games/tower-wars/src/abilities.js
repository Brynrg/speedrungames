// Data-driven active-ability table (IMPROVEMENT_PLAN Task 8). Each entry is
// keyed by the `ability.id` declared on a tower branch in TOWER_DATA and is
// invoked by Tower.castAbility as cast(tower, range) — `range` is the tower's
// effectiveRange at cast time. Bodies are moved verbatim from the old
// castAbility if-chain (`this` -> `tower`); adding an ability is now one entry
// here plus an `ability: { id, name, cooldown }` on a TOWER_DATA branch.
import { dealDamageToEnemy } from "./combat.js";
import { getEnemyProgress } from "./picking.js";
import { AreaEffect, Effect } from "./projectiles.js";
import { areaEffects, buffZones, effects, enemies, game } from "./state.js";
import { status } from "./status.js";

export const ABILITIES = {
  volley(tower, range) {
    const targets = enemies
      .filter((enemy) => tower.canTarget(enemy))
      .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
      .slice(0, 6);

    for (const enemy of targets) {
      const dmg = Math.round(tower.effectiveDamage * 1.4);
      dealDamageToEnemy(enemy, dmg, "piercing", tower, { allowZero: false });
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: range * 0.85, color: "rgba(248, 223, 135, 0.45)" }));
  },

  rally(tower) {
    buffZones.push({
      x: tower.x,
      y: tower.y,
      owner: tower.owner,
      radius: 145,
      damageMul: 1.22,
      rateMul: 1.35,
      timer: 6,
      name: "Rally",
    });
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: 145, color: "rgba(244, 214, 130, 0.35)" }));
  },

  shatter(tower, range) {
    const blastRadius = Math.round(range * 0.6);
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d <= blastRadius) {
        const falloff = 1 - d / (blastRadius + 1);
        const dmg = Math.round(tower.effectiveDamage * (1.6 * Math.max(0.4, falloff)));
        dealDamageToEnemy(enemy, dmg, "magic", tower, { allowZero: true });
        enemy.applySlow(0.42, 1.4);
      }
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: blastRadius, color: "rgba(128, 210, 255, 0.45)" }));
  },

  blizzard(tower, range) {
    areaEffects.push(
      new AreaEffect({
        x: tower.x,
        y: tower.y,
        radius: Math.round(range * 0.7),
        duration: 4.2,
        interval: 0.36,
        damage: Math.round(tower.effectiveDamage * 0.7),
        damageType: "magic",
        slowFactor: 0.52,
        slowDuration: 0.7,
        color: "rgba(136, 214, 255, 0.34)",
      })
    );
  },

  barrage(tower, range) {
    let target = null;
    let farthest = -1;
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d > range || !tower.canTarget(enemy)) {
        continue;
      }
      const progress = getEnemyProgress(enemy);
      if (progress > farthest) {
        farthest = progress;
        target = enemy;
      }
    }
    const center = target ? { x: target.x, y: target.y } : { x: tower.x, y: tower.y };
    const splash = Math.round(tower.splashRadius * 1.8);
    for (const enemy of [...enemies]) {
      const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
      if (d <= splash) {
        const dmg = Math.round(tower.effectiveDamage * (2 - d / (splash + 1)));
        dealDamageToEnemy(enemy, dmg, "siege", tower, { allowZero: false });
      }
    }
    effects.push(new Effect(center.x, center.y, "explosion", { radius: splash }));
    game.shake = Math.max(game.shake, 6);
  },

  skyfire(tower, range) {
    const hitRadius = range + 40;
    let hits = 0;
    for (const enemy of [...enemies]) {
      if (!enemy.flying) {
        continue;
      }
      if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) > hitRadius) {
        continue;
      }
      hits += 1;
      const dmg = Math.round(tower.effectiveDamage * 1.7);
      dealDamageToEnemy(enemy, dmg, "piercing", tower, { allowZero: false });
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: hitRadius, color: "rgba(193, 220, 255, 0.45)" }));
    if (hits === 0) {
      status("Skyfire cast, but no air targets in range.");
    }
  },

  arcane_nova(tower, range) {
    const novaRadius = Math.round(range * 0.62);
    for (const enemy of [...enemies]) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d > novaRadius) {
        continue;
      }
      const falloff = 1 - d / (novaRadius + 1);
      const dmg = Math.round(tower.effectiveDamage * (2.05 * Math.max(0.35, falloff)));
      dealDamageToEnemy(enemy, dmg, "spell", tower, { allowZero: false });
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: novaRadius, color: "rgba(186, 160, 255, 0.44)" }));
  },

  time_lock(tower, range) {
    let affected = 0;
    for (const enemy of [...enemies]) {
      const dmg = Math.round(tower.effectiveDamage * 0.9);
      dealDamageToEnemy(enemy, dmg, "spell", tower, { allowZero: true });
      enemy.applySlow(0.58, 2.6);
      affected += 1;
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: range * 0.96, color: "rgba(154, 186, 255, 0.42)" }));
    if (affected === 0) {
      status("Time Lock cast, but there were no targets.");
    }
  },

  acid_rain(tower, range) {
    areaEffects.push(
      new AreaEffect({
        x: tower.x,
        y: tower.y,
        radius: Math.round(range * 0.76),
        duration: 5.1,
        interval: 0.38,
        damage: Math.round(tower.effectiveDamage * 0.76),
        damageType: "magic",
        slowFactor: 0.82,
        slowDuration: 0.58,
        color: "rgba(133, 205, 112, 0.34)",
      })
    );
  },

  venom_spike(tower, range) {
    const targets = enemies
      .filter((enemy) => tower.canTarget(enemy))
      .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
      .slice(0, 5);
    for (const enemy of targets) {
      const dmg = Math.round(tower.effectiveDamage * 1.35);
      dealDamageToEnemy(enemy, dmg, "magic", tower, { allowZero: true });
      enemy.applySlow(0.68, 1.2);
    }
    effects.push(new Effect(tower.x, tower.y, "ring", { radius: range * 0.84, color: "rgba(174, 225, 118, 0.42)" }));
    if (targets.length === 0) {
      status("Venom Spike cast, but no targets were in range.");
    }
  },
};

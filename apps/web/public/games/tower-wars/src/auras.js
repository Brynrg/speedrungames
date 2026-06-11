import { buffZones, enemies, game, towers } from "./state.js";

export function updateBuffsAndAuras(dt) {
  for (const tower of towers) {
    tower.auraDamageMul = 1;
    tower.auraRateMul = 1;
    tower.auraGrantAir = false;
  }
  for (const enemy of enemies) {
    enemy.auraSlowFactor = 1;
  }

  for (let i = buffZones.length - 1; i >= 0; i -= 1) {
    const zone = buffZones[i];
    zone.timer -= dt;
    if (zone.timer <= 0) {
      buffZones.splice(i, 1);
      continue;
    }

    for (const tower of towers) {
      if (game.duelMode && zone.owner !== undefined && tower.owner !== zone.owner) {
        continue;
      }
      const d = Math.hypot(tower.x - zone.x, tower.y - zone.y);
      if (d <= zone.radius) {
        tower.applyTempBuff(zone.damageMul, zone.rateMul, zone.timer);
      }
    }
  }

  for (const source of towers) {
    const aura = source.branchData?.aura;
    if (!aura) {
      continue;
    }

    for (const tower of towers) {
      if (tower === source) {
        continue;
      }
      if (game.duelMode && tower.owner !== source.owner) {
        continue;
      }
      const d = Math.hypot(tower.x - source.x, tower.y - source.y);
      if (d > aura.radius) {
        continue;
      }
      tower.auraDamageMul *= aura.damageMul;
      tower.auraRateMul *= aura.rateMul;
      if (aura.grantAir) {
        tower.auraGrantAir = true;
      }
    }
  }

  for (const source of towers) {
    const auraSlow = source.branchData?.auraSlow;
    if (!auraSlow) {
      continue;
    }
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - source.x, enemy.y - source.y);
      if (d <= auraSlow.radius) {
        enemy.auraSlowFactor = Math.min(enemy.auraSlowFactor, auraSlow.factor);
      }
    }
  }
}


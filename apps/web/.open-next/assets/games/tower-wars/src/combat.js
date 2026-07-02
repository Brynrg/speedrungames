import { playSfx } from "./audio.js";
import { DAMAGE_TABLE } from "./damage.js";
import { Enemy } from "./enemies.js";
import { Effect } from "./projectiles.js";
import { effects, enemies, game, getEnemyDefenderState, syncActiveToLegacyIfDuel } from "./state.js";
import { status } from "./status.js";

export function getDamageMultiplier(damageType, armorType) {
  const byType = DAMAGE_TABLE[damageType];
  if (!byType) {
    return 1;
  }
  return byType[armorType] ?? 1;
}

export function dealDamageToEnemy(enemy, rawDamage, damageType, sourceTower, options = {}) {
  if (!enemies.includes(enemy)) {
    return { damageDealt: 0, killed: false, immune: false };
  }

  if (damageType === "magic" && enemy.magicImmune) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "Spell Immune", color: "#ffd7a8" }));
    playSfx("immune");
    return { damageDealt: 0, killed: false, immune: true };
  }

  if (enemy.flying && sourceTower && !sourceTower.canHitAir) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "No AA", color: "#f4b6b6" }));
    return { damageDealt: 0, killed: false, immune: true };
  }

  const mult = getDamageMultiplier(damageType, enemy.armorType);
  const scaled = rawDamage * mult * (enemy.isBoss ? 0.95 : 1);
  let finalDamage = Math.round(scaled);

  if (!options.allowZero) {
    finalDamage = Math.max(1, finalDamage);
  }

  if (finalDamage <= 0) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "Resist", color: "#d4d4d4" }));
    return { damageDealt: 0, killed: false, immune: false };
  }

  enemy.hp -= finalDamage;
  effects.push(new Effect(enemy.x, enemy.y, "hit"));
  if (mult > 1.15) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: `${finalDamage}!`, color: "#ffe59d" }));
  }

  if (enemy.hp <= 0) {
    onEnemyKilled(enemy, sourceTower);
    return { damageDealt: finalDamage, killed: true, immune: false };
  }

  return { damageDealt: finalDamage, killed: false, immune: false };
}

export function onEnemyKilled(enemy) {
  const idx = enemies.indexOf(enemy);
  if (idx >= 0) {
    enemies.splice(idx, 1);
  }

  const defender = getEnemyDefenderState(enemy);
  defender.gold += enemy.reward;
  defender.score += enemy.reward * (enemy.isBoss ? 10 : enemy.flying ? 4 : 3);

  effects.push(new Effect(enemy.x, enemy.y, "kill"));
  playSfx("kill");

  if (enemy.splitter && enemy.splitDepth > 0) {
    spawnSplitChildren(enemy);
  }

  if (enemy.isBoss) {
    defender.gold += 80;
    defender.score += 700;
    status(`Boss defeated on wave ${game.wave}.`);
  }
  syncActiveToLegacyIfDuel();
}

export function spawnSplitChildren(parent) {
  for (let i = 0; i < 2; i += 1) {
    const child = new Enemy({
      name: "Shardling",
      armorType: "light",
      hp: Math.max(14, parent.maxHp * 0.45),
      speed: parent.speed * 1.22,
      reward: Math.max(1, Math.round(parent.reward * 0.44)),
      leakDamage: 1,
      radius: Math.max(8, parent.radius - 3),
      color: "#d8906f",
      rim: "#f6ceb7",
      splitter: parent.splitDepth > 1,
      splitDepth: Math.max(0, parent.splitDepth - 1),
      spawn: {
        x: parent.x + (i === 0 ? -4 : 4),
        y: parent.y,
        pathIndex: parent.pathIndex,
        segmentProgress: parent.segmentProgress,
        mazeTargetX: parent.mazeTargetX,
        mazeTargetY: parent.mazeTargetY,
      },
      routeMode: parent.routeMode,
      progress: parent.progress,
      lane: parent.lane,
      targetPlayer: parent.targetPlayer,
    });
    enemies.push(child);
  }
}


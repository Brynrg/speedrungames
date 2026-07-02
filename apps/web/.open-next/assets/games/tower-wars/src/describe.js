import { ARMOR_LABELS, DAMAGE_LABELS } from "./damage.js";
import { game, getEnemyLane } from "./state.js";

export function describeEnemy(enemy) {
  const tags = [];
  tags.push(ARMOR_LABELS[enemy.armorType] || enemy.armorType);
  if (enemy.flying) {
    tags.push("Air");
  }
  if (enemy.magicImmune) {
    tags.push("Spell Immune");
  }
  if (enemy.splitter) {
    tags.push("Splitter");
  }
  if (enemy.isBoss) {
    tags.push("Boss");
  }
  if (game.duelMode) {
    tags.push(`Target P${getEnemyLane(enemy) + 1}`);
  }
  return `${enemy.name} | HP ${Math.max(0, Math.round(enemy.hp))}/${enemy.maxHp} | ${tags.join(" • ")}`;
}

export function describeTower(tower) {
  const tags = [];
  tags.push(DAMAGE_LABELS[tower.damageType] || tower.damageType);
  tags.push(tower.canHitAir ? "Air+Ground" : "Ground Only");
  if (tower.splashRadius > 0) {
    tags.push(`Splash ${Math.round(tower.splashRadius)}`);
  }
  if (tower.burnDps > 0) {
    tags.push(`Burn ${tower.burnDps.toFixed(0)}/s`);
  }
  if (tower.slowFactor) {
    const slowPct = Math.round((1 - tower.slowFactor) * 100);
    tags.push(`Slow ${slowPct}%`);
  }
  if (game.duelMode) {
    tags.push(`P${tower.owner + 1}`);
  }
  const branchName = tower.branchData?.name ? ` | ${tower.branchData.name}` : "";
  return `${tower.data.name} L${tower.level}${branchName} | Dmg ${tower.effectiveDamage} | Rng ${Math.round(tower.effectiveRange)} | ${tags.join(" • ")}`;
}


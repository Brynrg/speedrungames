import { TILE, AGGRO_RADIUS, ATTACK_MOVE_LEASH, BUILDING_DATA } from './constants.js';
import { randInt, dist } from './util.js';
import { getById, killEntity, moveUnitTo, nearestApproachTile, currentTile, resetForNewOrder } from './entities.js';
import { tileCenterPixel } from './map.js';
import { pushMessage } from './messages.js';

const REPATH_INTERVAL = 600;
// Must exceed sqrt(2)-1 (~0.414): nearestApproachTile treats any tile
// Chebyshev-adjacent to the target as "arrived", including a diagonal
// neighbor at ~1.414 tiles Euclidean distance. A smaller buffer let a melee
// unit (atkRange 1) settle on a diagonal approach tile that its own range
// check then judged "still out of range", forcing an endless re-approach to
// that same unreachable-closer spot.
const RANGE_BUFFER = 0.45;

export function weaponBonus(state, e) {
  if (e.kind !== 'unit' || e.isWorker) return 0;
  return state.upgrades[e.side].weapon;
}

export function armorBonus(state, e) {
  if (e.kind !== 'unit' || e.isWorker) return 0;
  return state.upgrades[e.side].armor;
}

export function calcDamage(rawRoll, totalArmor) {
  return Math.max(1, rawRoll - totalArmor);
}

function tileDistance(a, b) {
  return dist(a.x, a.y, b.x, b.y) / TILE;
}

function dealDamage(state, attacker, target) {
  const raw = randInt(attacker.atkMin, attacker.atkMax) + weaponBonus(state, attacker);
  const armor = target.armor + armorBonus(state, target);
  const dmg = calcDamage(raw, armor);
  target.hp -= dmg;
  if (target.hp <= 0) {
    killEntity(state, target);
    if (target.kind === 'building' && !target.constructing) {
      const label = target.side === 'player' ? 'Your' : 'Enemy';
      pushMessage(state, `${label} ${BUILDING_DATA[target.type].label} was destroyed`);
    }
  }
  return dmg;
}

function fireProjectile(state, attacker, target) {
  if (!attacker.ranged && !attacker.isDefense) return;
  state.projectiles.push({
    x1: attacker.x, y1: attacker.y, x2: target.x, y2: target.y,
    t: 0, duration: 260, side: attacker.side,
  });
}

function approachAndMaybeAttack(state, map, attacker, target, dt) {
  const targetSize = target.kind === 'building' ? target.size : 1;
  const targetTx = target.kind === 'building' ? target.tx : currentTile(target).x;
  const targetTy = target.kind === 'building' ? target.ty : currentTile(target).y;
  const range = attacker.atkRange + RANGE_BUFFER + (targetSize - 1) / 2;
  const d = tileDistance(attacker, target);

  if (d > range) {
    // Only force a repath on the timer if the target actually moved enough
    // to matter — otherwise a long walk toward a stationary target gets its
    // path recomputed from scratch every REPATH_INTERVAL regardless of
    // whether the current one is still perfectly good, and in tight terrain
    // (a chokepoint between forest patches) repeatedly discarding progress
    // before the unit clears the chokepoint can stall it in place forever.
    const targetMoved = !attacker.lastTargetPos || dist(attacker.lastTargetPos.x, attacker.lastTargetPos.y, target.x, target.y) > TILE;
    attacker.repathTimer -= dt;
    if (attacker.path.length === 0 || (attacker.repathTimer <= 0 && targetMoved)) {
      attacker.repathTimer = REPATH_INTERVAL;
      attacker.lastTargetPos = { x: target.x, y: target.y };
      const approach = nearestApproachTile(state, map, targetTx, targetTy, targetSize, attacker.x, attacker.y);
      if (approach) moveUnitTo(state, map, attacker, approach.x, approach.y);
    }
    if (attacker.state !== 'moving') attacker.state = 'moving';
    return;
  }

  attacker.path = [];
  attacker.pathIndex = 0;
  attacker.state = 'attacking';
  attacker.cooldownTimer -= dt;
  if (attacker.cooldownTimer <= 0) {
    attacker.cooldownTimer = attacker.atkCooldown;
    dealDamage(state, attacker, target);
    fireProjectile(state, attacker, target);
    if (!target.isDead) notifyDamaged(state, map, target, attacker);
  }
}

function resumeAfterEngagement(state, map, unit) {
  unit.attackTargetId = null;
  if (unit.order && (unit.order.type === 'attackMove' || unit.order.type === 'move') && unit.order.tx != null) {
    moveUnitTo(state, map, unit, unit.order.tx, unit.order.ty);
  } else {
    unit.order = null;
    unit.state = 'idle';
  }
}

export function updateCombat(state, map, dt) {
  for (const unit of state.entities) {
    if (unit.kind !== 'unit' || unit.isDead) continue;

    if (unit.attackTargetId) {
      const target = getById(state, unit.attackTargetId);
      if (!target || target.isDead) {
        resumeAfterEngagement(state, map, unit);
        continue;
      }
      // A direct Attack order has no leash — the unit will cross the whole
      // map to reach an explicitly-ordered target. The leash only bounds how
      // far auto-aggro/attack-move engagements can drag a unit from its
      // guard post (homeAnchor), which — unlike a per-engagement anchor —
      // does NOT reset on every kill, so a chain of closely-spaced enemies
      // can't pull a defender arbitrarily far from home one short hop at a time.
      const isExplicitAttack = unit.order && unit.order.type === 'attack';
      if (!isExplicitAttack && unit.homeAnchor) {
        const leashD = dist(unit.homeAnchor.x, unit.homeAnchor.y, unit.x, unit.y) / TILE;
        if (leashD > ATTACK_MOVE_LEASH) {
          resumeAfterEngagement(state, map, unit);
          continue;
        }
      }
      approachAndMaybeAttack(state, map, unit, target, dt);
      continue;
    }

    const freeToAggro = unit.order === null || unit.order.type === 'attackMove';
    if (freeToAggro) {
      let nearestEnemy = null;
      let bestD = AGGRO_RADIUS * TILE;
      for (const e of state.entities) {
        if (e.kind !== 'unit' || e.side === unit.side || e.isDead) continue;
        const d = dist(unit.x, unit.y, e.x, e.y);
        if (d < bestD) { bestD = d; nearestEnemy = e; }
      }
      if (nearestEnemy) {
        unit.attackTargetId = nearestEnemy.id;
        unit.repathTimer = 0;
      }
    }
  }

  for (const building of state.entities) {
    if (building.kind !== 'building' || building.isDead || building.constructing || !building.isDefense) continue;
    building.cooldownTimer = Math.max(0, building.cooldownTimer - dt);
    let target = building.attackTargetId ? getById(state, building.attackTargetId) : null;
    if (target && (target.isDead || tileDistance(building, target) > building.atkRange + RANGE_BUFFER)) {
      target = null;
      building.attackTargetId = null;
    }
    if (!target) {
      let nearestEnemy = null;
      let bestD = building.atkRange * TILE;
      for (const e of state.entities) {
        if (e.kind !== 'unit' || e.side === building.side || e.isDead) continue;
        const d = dist(building.x, building.y, e.x, e.y);
        if (d < bestD) { bestD = d; nearestEnemy = e; }
      }
      if (nearestEnemy) { target = nearestEnemy; building.attackTargetId = nearestEnemy.id; }
    }
    if (target && building.cooldownTimer <= 0) {
      building.cooldownTimer = building.atkCooldown;
      dealDamage(state, building, target);
      fireProjectile(state, building, target);
      if (!target.isDead) notifyDamaged(state, map, target, building);
    }
  }
}

export function notifyDamaged(state, map, victim, attacker) {
  if (victim.kind !== 'unit' || victim.isDead) return;
  if (victim.order && (victim.order.type === 'harvest' || victim.order.type === 'build')) return;
  if (!victim.attackTargetId) {
    victim.attackTargetId = attacker.id;
    victim.repathTimer = 0;
  }
}

export function issueAttack(state, map, unit, target) {
  resetForNewOrder(state, unit);
  unit.order = { type: 'attack', targetId: target.id };
  unit.attackTargetId = target.id;
  unit.repathTimer = 0;
}

export function issueAttackMove(state, map, unit, tx, ty) {
  resetForNewOrder(state, unit);
  unit.order = { type: 'attackMove', tx, ty };
  unit.homeAnchor = tileCenterPixel(tx, ty);
  moveUnitTo(state, map, unit, tx, ty);
}

export function updateProjectiles(state, dt) {
  for (const p of state.projectiles) p.t += dt;
  state.projectiles = state.projectiles.filter((p) => p.t < p.duration);
}

import { AI_TICK_MS, TILE, BUILDING_DATA, MAIN_HALL } from './constants.js';
import { randRange, dist } from './util.js';
import { tileAt } from './map.js';
import { buildOccupiedSet } from './entities.js';
import { canAfford, orderBuild, orderHarvest, queueProduction, footprintClearWithOccupied, hasBlacksmith } from './economy.js';
import { issueAttackMove } from './combat.js';

const DEFENSE_RADIUS = 13;
const MILITARY_RESERVE = 3;
const MILITARY_TYPES = { enemy: ['grunt', 'spearman', 'raider'], player: ['footman', 'archer', 'knight'] };

export function createAIState(map) {
  return {
    decisionTimer: 0,
    attackTimer: randRange(50000, 70000),
    playerBase: map.playerBase.center,
    enemyBase: map.enemyBase.center,
  };
}

function findBuildSpot(state, map, size, cx, cy, maxRadius = 16) {
  const occupied = buildOccupiedSet(state); // computed once — not per candidate tile
  for (let r = 2; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (footprintClearWithOccupied(map, occupied, x, y, size)) return { x, y };
      }
    }
  }
  return null;
}

function findHarvestTarget(map, cx, cy, wantType, maxRadius = 18) {
  let best = null;
  let bestD = Infinity;
  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      const match = (wantType === 'gold' && tile.type === 'gold') || (wantType === 'lumber' && tile.type === 'forest');
      if (!match) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}

function countPeonsOn(state, map, resourceType) {
  let n = 0;
  for (const e of state.entities) {
    if (e.kind !== 'unit' || e.side !== 'enemy' || e.isDead || !e.isWorker || !e.harvestTile) continue;
    const tile = tileAt(map, e.harvestTile.x, e.harvestTile.y);
    const kind = tile?.type === 'gold' ? 'gold' : tile?.type === 'forest' ? 'lumber' : null;
    if (kind === resourceType) n++;
  }
  return n;
}

function hasBuildingOfType(state, side, type) {
  return state.entities.some((e) => e.kind === 'building' && e.side === side && e.type === type && !e.isDead);
}

function runEconomyDecisions(state, map, ai) {
  const side = 'enemy';
  const hall = state.entities.find((e) => e.kind === 'building' && e.side === side && e.type === MAIN_HALL[side] && !e.isDead && !e.constructing);
  if (!hall) return;

  const peonCount = state.entities.filter((e) => e.kind === 'unit' && e.side === side && !e.isDead && e.isWorker).length;
  const desiredPeasants = Math.min(11, 5 + Math.floor(state.time / 90000));
  if (peonCount < desiredPeasants && hall.productionQueue.length < 2) {
    queueProduction(state, side, hall, 'peon');
  }

  const food = state.food[side];
  const buildingFarm = state.entities.some((e) => e.kind === 'building' && e.side === side && e.type === 'pigfarm' && !e.isDead && e.constructing);
  if (food.max - food.used <= 2 && !buildingFarm && canAfford(state, side, BUILDING_DATA.pigfarm.cost)) {
    const spot = findBuildSpot(state, map, 2, ai.enemyBase.x, ai.enemyBase.y);
    const builder = findIdlePeon(state, side);
    if (spot && builder) orderBuild(state, map, side, 'pigfarm', spot.x, spot.y, builder);
  }

  if (!hasBuildingOfType(state, side, 'warmill') && canAfford(state, side, BUILDING_DATA.warmill.cost)) {
    const spot = findBuildSpot(state, map, 3, ai.enemyBase.x, ai.enemyBase.y);
    const builder = findIdlePeon(state, side);
    if (spot && builder) orderBuild(state, map, side, 'warmill', spot.x, spot.y, builder);
  } else if (!hasBuildingOfType(state, side, 'tradehall') && state.time > 90000 && canAfford(state, side, BUILDING_DATA.tradehall.cost)) {
    const spot = findBuildSpot(state, map, 2, ai.enemyBase.x, ai.enemyBase.y);
    const builder = findIdlePeon(state, side);
    if (spot && builder) orderBuild(state, map, side, 'tradehall', spot.x, spot.y, builder);
  } else if (hasBuildingOfType(state, side, 'warmill') && !hasBuildingOfType(state, side, 'watchtower') && state.time > 140000 && canAfford(state, side, BUILDING_DATA.watchtower.cost)) {
    const spot = findBuildSpot(state, map, 1, ai.enemyBase.x, ai.enemyBase.y, 9);
    const builder = findIdlePeon(state, side);
    if (spot && builder) orderBuild(state, map, side, 'watchtower', spot.x, spot.y, builder);
  }

  for (const e of state.entities) {
    if (e.kind !== 'unit' || e.side !== side || e.isDead || !e.isWorker || e.order) continue;
    const goldCount = countPeonsOn(state, map, 'gold');
    const lumberCount = countPeonsOn(state, map, 'lumber');
    const wantGold = goldCount <= lumberCount * 1.5;
    let target = findHarvestTarget(map, ai.enemyBase.x, ai.enemyBase.y, wantGold ? 'gold' : 'lumber');
    if (!target) target = findHarvestTarget(map, ai.enemyBase.x, ai.enemyBase.y, wantGold ? 'lumber' : 'gold');
    if (target) orderHarvest(state, map, e, target.x, target.y);
  }
}

function findIdlePeon(state, side) {
  return state.entities.find((e) => e.kind === 'unit' && e.side === side && !e.isDead && e.isWorker && !e.order);
}

function runProductionDecisions(state) {
  const side = 'enemy';
  const barracks = state.entities.filter((e) => e.kind === 'building' && e.side === side && e.type === 'warmill' && !e.isDead && !e.constructing);
  for (const b of barracks) {
    if (b.productionQueue.length >= 2) continue;
    const canKnight = hasBlacksmith(state, side);
    const roll = Math.random();
    let unitType = 'grunt';
    if (canKnight && roll < 0.25) unitType = 'raider';
    else if (roll < 0.65) unitType = 'grunt';
    else unitType = 'spearman';
    queueProduction(state, side, b, unitType);
  }
}

function intrudersNearBase(state, ai) {
  return state.entities.filter((e) => e.kind === 'unit' && e.side === 'player' && !e.isDead &&
    dist(e.x / TILE, e.y / TILE, ai.enemyBase.x, ai.enemyBase.y) < DEFENSE_RADIUS);
}

function runDefenseDecisions(state, map, ai) {
  const intruders = intrudersNearBase(state, ai);
  if (!intruders.length) return;
  const intruder = intruders[0];
  for (const e of state.entities) {
    if (e.kind !== 'unit' || e.side !== 'enemy' || e.isDead || e.isWorker) continue;
    if (e.attackTargetId) continue;
    const d = dist(e.x / TILE, e.y / TILE, ai.enemyBase.x, ai.enemyBase.y);
    if (d < 22) {
      const tx = Math.round(intruder.x / TILE);
      const ty = Math.round(intruder.y / TILE);
      issueAttackMove(state, map, e, tx, ty);
    }
  }
}

// Returns true if a wave actually launched. Excludes units already fighting
// (attackTargetId set) and, while the base is under raid, units standing
// defense nearby — otherwise a wave-launch could strip active defenders off
// an in-progress base defense and march them toward the player instead.
function launchAttackWave(state, map, ai) {
  const side = 'enemy';
  const underAttack = intrudersNearBase(state, ai).length > 0;
  const military = state.entities.filter((e) =>
    e.kind === 'unit' && e.side === side && !e.isDead && MILITARY_TYPES.enemy.includes(e.type) &&
    !e.attackTargetId &&
    !(underAttack && dist(e.x / TILE, e.y / TILE, ai.enemyBase.x, ai.enemyBase.y) < DEFENSE_RADIUS));
  if (military.length < MILITARY_RESERVE + 2) return false;
  const attackers = military.slice(MILITARY_RESERVE);
  const tx = Math.round(ai.playerBase.x);
  const ty = Math.round(ai.playerBase.y);
  for (const u of attackers) {
    issueAttackMove(state, map, u, tx, ty);
  }
  return true;
}

export function updateAI(state, map, dt) {
  const ai = state.ai;
  ai.attackTimer -= dt;
  ai.decisionTimer += dt;
  if (ai.decisionTimer >= AI_TICK_MS) {
    ai.decisionTimer = 0;
    runEconomyDecisions(state, map, ai);
    runProductionDecisions(state);
    runDefenseDecisions(state, map, ai);
  }
  if (ai.attackTimer <= 0) {
    const launched = launchAttackWave(state, map, ai);
    // If the army wasn't big enough yet, retry soon instead of re-arming a
    // full 65-95s cooldown — otherwise a chronically-small army can go long
    // stretches (or the rest of the match) without ever sending a wave.
    ai.attackTimer = launched ? randRange(65000, 95000) : randRange(8000, 15000);
  }
}

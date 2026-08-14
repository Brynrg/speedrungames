import { UNIT_DATA, BUILDING_DATA, HARVEST_GOLD_TIME, HARVEST_LUMBER_TIME, GOLD_PER_TRIP, LUMBER_PER_TRIP, TILE } from './constants.js';
import { tileAt, chopForest, mineGold, tileCenterPixel } from './map.js';
import { spawnUnit, spawnBuilding, getById, moveUnitTo, nearestApproachTile, stopUnit, resetForNewOrder, buildOccupiedSet, currentTile } from './entities.js';
import { pushMessage } from './messages.js';
import { spawnFloatText, spawnSparkle, spawnDust } from './vfx.js';
import { sfxComplete, sfxUnitReady } from './sfx.js';

export function canAfford(state, side, cost) {
  const res = state.resources[side];
  return res.gold >= (cost.gold || 0) && res.lumber >= (cost.lumber || 0);
}

function pay(state, side, cost) {
  state.resources[side].gold -= cost.gold || 0;
  state.resources[side].lumber -= cost.lumber || 0;
}

export function footprintClearWithOccupied(map, occupied, tx, ty, size) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      const tile = tileAt(map, x, y);
      if (!tile || tile.type !== 'grass') return false;
      if (occupied.has(y * 100000 + x)) return false;
    }
  }
  return true;
}

export function footprintClear(state, map, tx, ty, size) {
  return footprintClearWithOccupied(map, buildOccupiedSet(state), tx, ty, size);
}

export function orderHarvest(state, map, unit, tx, ty) {
  const tile = tileAt(map, tx, ty);
  if (!tile || (tile.type !== 'forest' && tile.type !== 'gold')) return false;
  resetForNewOrder(state, unit);
  unit.order = { type: 'harvest' };
  unit.harvestTile = { x: tx, y: ty };
  unit.harvestTimer = 0;
  unit.state = 'idle'; // force updateHarvesting to re-validate adjacency even if it was already 'harvesting' a different tile
  const approach = nearestApproachTile(state, map, tx, ty, 1, unit.x, unit.y);
  if (!approach) { stopUnit(state, unit); return false; }
  moveUnitTo(state, map, unit, approach.x, approach.y);
  return true;
}

export function orderBuild(state, map, side, buildingKey, tx, ty, builder) {
  const stats = BUILDING_DATA[buildingKey];
  if (!stats) return null;
  if (!footprintClear(state, map, tx, ty, stats.size)) {
    pushMessage(state, 'Cannot build there', side);
    return null;
  }
  if (!canAfford(state, side, stats.cost)) {
    pushMessage(state, 'Not enough resources', side);
    return null;
  }
  pay(state, side, stats.cost);
  const building = spawnBuilding(state, side, buildingKey, tx, ty, { constructing: true });
  if (builder) {
    resetForNewOrder(state, builder);
    builder.order = { type: 'build' };
    builder.buildTargetId = building.id;
    const approach = nearestApproachTile(state, map, tx, ty, stats.size, builder.x, builder.y, building.id);
    if (approach) moveUnitTo(state, map, builder, approach.x, approach.y);
    else stopUnit(state, builder);
  }
  return building;
}

export function assistBuild(state, map, worker, building) {
  if (!building.constructing || building.side !== worker.side) return false;
  resetForNewOrder(state, worker);
  worker.order = { type: 'build' };
  worker.buildTargetId = building.id;
  const approach = nearestApproachTile(state, map, building.tx, building.ty, building.size, worker.x, worker.y, building.id);
  if (approach) moveUnitTo(state, map, worker, approach.x, approach.y);
  else stopUnit(state, worker);
  return true;
}

function findNearestOwnBuilding(state, side, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.entities) {
    if (e.kind !== 'building' || e.side !== side || e.isDead || e.constructing) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearFootprint(ut, tx, ty, size) {
  return ut.x >= tx - 1 && ut.x <= tx + size && ut.y >= ty - 1 && ut.y <= ty + size;
}

function retargetOrStop(state, map, unit) {
  const around = unit.harvestTile || currentTile(unit);
  let found = null;
  let bestD = Infinity;
  const RADIUS = 8;
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const x = around.x + dx;
      const y = around.y + dy;
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      const isResource = tile.type === 'forest' || tile.type === 'gold';
      if (!isResource) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; found = { x, y }; }
    }
  }
  if (found) {
    unit.harvestTile = found;
    const approach = nearestApproachTile(state, map, found.x, found.y, 1, unit.x, unit.y);
    if (approach) { moveUnitTo(state, map, unit, approach.x, approach.y); return; }
  }
  stopUnit(state, unit);
}

export function updateHarvesting(state, map, dt) {
  for (const unit of state.entities) {
    if (unit.kind !== 'unit' || unit.isDead || !unit.isWorker) continue;
    if (!unit.order || unit.order.type !== 'harvest') continue;

    if (unit.carrying) {
      const dep = getById(state, unit.depositTargetId);
      if (!dep || dep.isDead || dep.constructing) {
        const nb = findNearestOwnBuilding(state, unit.side, unit.x, unit.y);
        if (!nb) continue;
        unit.depositTargetId = nb.id;
        const approach = nearestApproachTile(state, map, nb.tx, nb.ty, nb.size, unit.x, unit.y);
        if (approach) moveUnitTo(state, map, unit, approach.x, approach.y);
        continue;
      }
      if (unit.path.length === 0) {
        const ut = currentTile(unit);
        if (!nearFootprint(ut, dep.tx, dep.ty, dep.size)) {
          const approach = nearestApproachTile(state, map, dep.tx, dep.ty, dep.size, unit.x, unit.y);
          if (approach) moveUnitTo(state, map, unit, approach.x, approach.y);
          continue;
        }
        state.resources[unit.side][unit.carrying.type] += unit.carrying.amount;
        if (unit.side === 'player') {
          const color = unit.carrying.type === 'gold' ? '#e8c94a' : '#c98a4b';
          spawnFloatText(state, dep.x, dep.y - dep.size * 16, `+${unit.carrying.amount} ${unit.carrying.type === 'gold' ? 'g' : 'L'}`, color);
        }
        unit.carrying = null;
        const tile = unit.harvestTile ? tileAt(map, unit.harvestTile.x, unit.harvestTile.y) : null;
        if (tile && (tile.type === 'forest' || tile.type === 'gold')) {
          const approach = nearestApproachTile(state, map, unit.harvestTile.x, unit.harvestTile.y, 1, unit.x, unit.y);
          if (approach) moveUnitTo(state, map, unit, approach.x, approach.y);
          else stopUnit(state, unit);
        } else {
          retargetOrStop(state, map, unit);
        }
      }
      continue;
    }

    if (!unit.harvestTile) continue;

    if (unit.path.length === 0 && unit.state !== 'harvesting') {
      const tile = tileAt(map, unit.harvestTile.x, unit.harvestTile.y);
      if (!tile || (tile.type !== 'forest' && tile.type !== 'gold')) {
        retargetOrStop(state, map, unit);
        continue;
      }
      const ut = currentTile(unit);
      const adjacent = Math.max(Math.abs(ut.x - unit.harvestTile.x), Math.abs(ut.y - unit.harvestTile.y)) <= 1;
      if (adjacent) {
        unit.state = 'harvesting';
        unit.harvestTimer = 0;
      } else {
        const approach = nearestApproachTile(state, map, unit.harvestTile.x, unit.harvestTile.y, 1, unit.x, unit.y);
        if (approach) moveUnitTo(state, map, unit, approach.x, approach.y);
        else stopUnit(state, unit);
      }
      continue;
    }

    if (unit.state === 'harvesting') {
      const tile = tileAt(map, unit.harvestTile.x, unit.harvestTile.y);
      if (!tile || (tile.type !== 'forest' && tile.type !== 'gold')) {
        retargetOrStop(state, map, unit);
        continue;
      }
      unit.harvestTimer += dt;
      const isGold = tile.type === 'gold';
      const need = isGold ? HARVEST_GOLD_TIME : HARVEST_LUMBER_TIME;
      if (unit.harvestTimer >= need) {
        const amount = isGold ? mineGold(tile, GOLD_PER_TRIP) : chopForest(tile, LUMBER_PER_TRIP);
        unit.harvestTimer = 0;
        if (amount <= 0) {
          retargetOrStop(state, map, unit);
        } else {
          const spot = tileCenterPixel(unit.harvestTile.x, unit.harvestTile.y);
          spawnSparkle(state, spot.x, spot.y, isGold ? '#e8c94a' : '#c98a4b');
          unit.carrying = { type: isGold ? 'gold' : 'lumber', amount };
          unit.state = 'idle';
          const dep = findNearestOwnBuilding(state, unit.side, unit.x, unit.y);
          if (dep) {
            unit.depositTargetId = dep.id;
            const approach = nearestApproachTile(state, map, dep.tx, dep.ty, dep.size, unit.x, unit.y);
            if (approach) moveUnitTo(state, map, unit, approach.x, approach.y);
          }
        }
      }
    }
  }
}

export function updateConstruction(state, map, dt) {
  const contributing = new Map();
  for (const u of state.entities) {
    if (u.kind !== 'unit' || u.isDead) continue;
    if (!u.order || u.order.type !== 'build') continue;
    const building = getById(state, u.buildTargetId);
    if (!building || building.isDead || !building.constructing) {
      stopUnit(state, u);
      continue;
    }
    if (u.path.length === 0 && u.state !== 'building') {
      const ut = currentTile(u);
      if (nearFootprint(ut, building.tx, building.ty, building.size)) {
        u.state = 'building';
      } else {
        // path emptied (or was never set) without the worker actually being
        // there — retry pathing instead of silently crediting a ghost builder
        const approach = nearestApproachTile(state, map, building.tx, building.ty, building.size, u.x, u.y, building.id);
        if (approach) moveUnitTo(state, map, u, approach.x, approach.y);
        else stopUnit(state, u);
      }
    }
    if (u.state === 'building') {
      contributing.set(building.id, (contributing.get(building.id) || 0) + 1);
    }
  }

  for (const e of state.entities) {
    if (e.kind !== 'building' || e.isDead || !e.constructing) continue;
    const workers = Math.min(contributing.get(e.id) || 0, 3);
    e.builderIds = workers;
    if (workers > 0) {
      const before = e.buildProgress;
      e.buildProgress = Math.min(1, e.buildProgress + (workers * dt) / e.buildTimeMs);
      // Grant hp only for the incremental progress made this tick, added on
      // top of current hp — never reset hp to an absolute progress-derived
      // value, or combat damage taken while under construction gets healed
      // away for free as long as a builder keeps working.
      const hpGain = Math.round(e.maxHp * (e.buildProgress - before));
      e.hp = Math.min(e.maxHp, e.hp + hpGain);
    }
    if (e.buildProgress >= 1) {
      e.constructing = false;
      e.hp = e.maxHp;
      spawnDust(state, e.x, e.y + (e.size * TILE) / 2 - 6);
      const stats = BUILDING_DATA[e.type];
      if (stats.food && !e.foodContributed) {
        state.food[e.side].max += stats.food;
        e.foodContributed = true;
      }
      if (stats.unlocksTech) state.tech[e.side].add(stats.unlocksTech);
      for (const u of state.entities) {
        if (u.kind === 'unit' && !u.isDead && u.buildTargetId === e.id) {
          stopUnit(state, u);
        }
      }
      pushMessage(state, `${stats.label} complete`, e.side);
      if (e.side === 'player') sfxComplete();
    }
  }
}

const SPAWN_STUCK_TIMEOUT_MS = 8000;

export function queueProduction(state, side, building, unitType) {
  if (building.isDead) return false;
  const stats = UNIT_DATA[unitType];
  if (!stats) return false;
  const bstats = BUILDING_DATA[building.type];
  if (!bstats.produces || !bstats.produces.includes(unitType)) return false;
  if (stats.requiresTech && !state.tech[side].has(stats.requiresTech)) {
    pushMessage(state, 'Requires Blacksmith', side);
    return false;
  }
  if (!canAfford(state, side, stats.cost)) {
    pushMessage(state, 'Not enough resources', side);
    return false;
  }
  if (building.productionQueue.length >= 5) {
    pushMessage(state, 'Queue full', side);
    return false;
  }
  pay(state, side, stats.cost);
  building.productionQueue.push({ unitType, progress: 0, ready: false, cost: stats.cost, stuckMs: 0 });
  return true;
}

export function updateProduction(state, map, dt) {
  for (const building of state.entities) {
    if (building.kind !== 'building' || building.isDead || building.constructing) continue;
    if (!building.productionQueue.length) continue;
    const item = building.productionQueue[0];
    if (!item.ready) {
      item.progress += dt / UNIT_DATA[item.unitType].buildTime;
      if (item.progress >= 1) { item.progress = 1; item.ready = true; }
    }
    if (!item.ready) continue;

    const side = building.side;
    const foodNeeded = UNIT_DATA[item.unitType].food;
    if (state.food[side].used + foodNeeded > state.food[side].max) continue; // waiting on food cap, not stuck

    const spawnTile = nearestApproachTile(state, map, building.tx, building.ty, building.size, building.x, building.y);
    if (spawnTile) {
      const unit = spawnUnit(state, side, item.unitType, spawnTile.x, spawnTile.y);
      building.productionQueue.shift();
      if (building.rallyPoint) {
        moveUnitTo(state, map, unit, building.rallyPoint.x, building.rallyPoint.y);
      }
      pushMessage(state, `${UNIT_DATA[item.unitType].label} ready`, side);
      if (side === 'player') sfxUnitReady();
    } else {
      item.stuckMs = (item.stuckMs || 0) + dt;
      if (item.stuckMs > SPAWN_STUCK_TIMEOUT_MS) {
        state.resources[side].gold += item.cost.gold || 0;
        state.resources[side].lumber += item.cost.lumber || 0;
        building.productionQueue.shift();
        pushMessage(state, `${UNIT_DATA[item.unitType].label} training cancelled — no room to spawn (refunded)`, side);
      }
    }
  }
}

const UPGRADE_COST = { gold: 150, lumber: 50 };
const UPGRADE_MAX = 2;

export function hasBlacksmith(state, side) {
  return state.entities.some((e) => e.kind === 'building' && e.side === side && !e.isDead && !e.constructing && BUILDING_DATA[e.type].unlocksTech === 'blacksmith');
}

export function purchaseUpgrade(state, side, kind) {
  if (!hasBlacksmith(state, side)) return false;
  if (state.upgrades[side][kind] >= UPGRADE_MAX) return false;
  if (!canAfford(state, side, UPGRADE_COST)) {
    pushMessage(state, 'Not enough resources', side);
    return false;
  }
  pay(state, side, UPGRADE_COST);
  state.upgrades[side][kind] += 1;
  pushMessage(state, `${kind === 'weapon' ? 'Weapon' : 'Armor'} upgrade researched`, side);
  return true;
}

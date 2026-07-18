import { UNIT_DATA, BUILDING_DATA, TILE } from './constants.js';
import { nextUid, dist } from './util.js';
import { tileCenterPixel, tileToPixel, pixelToTile } from './map.js';
import { makeBlockedFn, findPath } from './pathfinding.js';

export function spawnUnit(state, side, type, tx, ty) {
  const stats = UNIT_DATA[type];
  const pos = tileCenterPixel(tx, ty);
  const e = {
    id: nextUid(),
    side, kind: 'unit', type,
    x: pos.x, y: pos.y,
    hp: stats.hp, maxHp: stats.hp,
    armor: stats.armor, atkMin: stats.atkMin, atkMax: stats.atkMax, atkRange: stats.atkRange,
    atkCooldown: stats.atkCooldown, speed: stats.speed, sight: stats.sight, radius: stats.radius,
    food: stats.food, isWorker: !!stats.isWorker, ranged: !!stats.ranged,
    cooldownTimer: 0,
    path: [], pathIndex: 0,
    order: null,
    state: 'idle',
    carrying: null, harvestTile: null, harvestTimer: 0, depositTargetId: null,
    attackTargetId: null, homeAnchor: { x: pos.x, y: pos.y }, repathTimer: 0,
    buildTargetId: null,
    isDead: false, deathTimer: 0,
  };
  state.entities.push(e);
  state.entitiesById.set(e.id, e);
  state.food[side].used += stats.food;
  return e;
}

export function spawnBuilding(state, side, type, tx, ty, opts = {}) {
  const stats = BUILDING_DATA[type];
  const size = stats.size;
  const topLeft = tileToPixel(tx, ty);
  const center = { x: topLeft.x + (size * TILE) / 2, y: topLeft.y + (size * TILE) / 2 };
  const constructing = opts.constructing !== false;
  const e = {
    id: nextUid(),
    side, kind: 'building', type,
    tx, ty, size,
    x: center.x, y: center.y,
    hp: constructing ? 1 : stats.hp, maxHp: stats.hp,
    armor: stats.armor,
    atkMin: stats.atkMin || 0, atkMax: stats.atkMax || 0, atkRange: stats.atkRange || 0,
    atkCooldown: stats.atkCooldown || 0, sight: stats.sight,
    isDefense: !!stats.isDefense,
    cooldownTimer: 0,
    constructing, buildProgress: constructing ? 0 : 1, buildTimeMs: stats.buildTime,
    foodContributed: false,
    builderIds: new Set(),
    productionQueue: [],
    rallyPoint: null,
    attackTargetId: null,
    isDead: false, deathTimer: 0,
  };
  state.entities.push(e);
  state.entitiesById.set(e.id, e);
  if (!constructing && stats.food) {
    state.food[side].max += stats.food;
    e.foodContributed = true;
  }
  return e;
}

export function killEntity(state, e) {
  if (e.isDead) return;
  e.isDead = true;
  e.deathTimer = 0;
  e.order = null;
  e.path = [];
  if (e.kind === 'unit') {
    state.food[e.side].used = Math.max(0, state.food[e.side].used - e.food);
  } else if (e.kind === 'building' && e.foodContributed) {
    const stats = BUILDING_DATA[e.type];
    state.food[e.side].max = Math.max(0, state.food[e.side].max - (stats.food || 0));
  }
}

export function pruneDead(state, dt) {
  const DEATH_FADE_MS = 700;
  for (const e of state.entities) {
    if (e.isDead) e.deathTimer += dt;
  }
  const before = state.entities.length;
  state.entities = state.entities.filter((e) => !(e.isDead && e.deathTimer >= DEATH_FADE_MS));
  if (state.entities.length !== before) {
    state.entitiesById.clear();
    for (const e of state.entities) state.entitiesById.set(e.id, e);
    if (state.selection) state.selection = state.selection.filter((id) => state.entitiesById.has(id));
  }
}

export function getById(state, id) {
  return state.entitiesById.get(id) || null;
}

export function aliveEntities(state) {
  return state.entities.filter((e) => !e.isDead);
}

export function currentTile(unit) {
  return pixelToTile(unit.x, unit.y);
}

export function findNearest(list, x, y, predicate) {
  let best = null;
  let bestD = Infinity;
  for (const e of list) {
    if (predicate && !predicate(e)) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export function entitiesInRadius(list, x, y, radius, predicate) {
  const out = [];
  for (const e of list) {
    if (predicate && !predicate(e)) continue;
    if (dist(x, y, e.x, e.y) <= radius) out.push(e);
  }
  return out;
}

export function buildOccupiedSet(state, ignoreId) {
  const set = new Set();
  for (const e of state.entities) {
    if (e.kind !== 'building' || e.isDead) continue;
    if (ignoreId && e.id === ignoreId) continue;
    for (let dy = 0; dy < e.size; dy++) {
      for (let dx = 0; dx < e.size; dx++) {
        set.add((e.ty + dy) * 100000 + (e.tx + dx));
      }
    }
  }
  return set;
}

export function requestPath(state, map, startTx, startTy, goalTx, goalTy, ignoreId) {
  const occupied = buildOccupiedSet(state, ignoreId);
  const blocked = makeBlockedFn(map, occupied);
  return findPath(blocked, startTx, startTy, goalTx, goalTy);
}

export function nearestApproachTile(state, map, targetTx, targetTy, targetSize, fromX, fromY, ignoreId) {
  const occupied = buildOccupiedSet(state, ignoreId);
  const blocked = makeBlockedFn(map, occupied);
  const candidates = [];
  for (let dy = -1; dy <= targetSize; dy++) {
    for (let dx = -1; dx <= targetSize; dx++) {
      const onPerimeter = dx === -1 || dy === -1 || dx === targetSize || dy === targetSize;
      if (!onPerimeter) continue;
      const x = targetTx + dx;
      const y = targetTy + dy;
      if (blocked(x, y)) continue;
      candidates.push({ x, y });
    }
  }
  if (!candidates.length) return null;
  const fromTile = pixelToTile(fromX, fromY);
  candidates.sort((a, b) => Math.hypot(a.x - fromTile.x, a.y - fromTile.y) - Math.hypot(b.x - fromTile.x, b.y - fromTile.y));
  return candidates[0];
}

export function moveUnitTo(state, map, unit, tx, ty) {
  const start = currentTile(unit);
  const path = requestPath(state, map, start.x, start.y, tx, ty);
  if (!path || path.length === 0) {
    unit.path = [];
    unit.pathIndex = 0;
    return false;
  }
  unit.path = path;
  unit.pathIndex = 0;
  unit.state = 'moving';
  return true;
}

// Banks any carried cargo and clears combat engagement. Every function that
// hands a unit a new order must call this first, or a laden worker's cargo
// is silently lost and a unit mid-fight keeps getting dragged back into it.
export function resetForNewOrder(state, unit) {
  if (unit.carrying) {
    state.resources[unit.side][unit.carrying.type] += unit.carrying.amount;
    unit.carrying = null;
  }
  unit.attackTargetId = null;
}

export function stopUnit(state, unit) {
  resetForNewOrder(state, unit);
  unit.homeAnchor = { x: unit.x, y: unit.y };
  unit.order = null;
  unit.path = [];
  unit.pathIndex = 0;
  unit.harvestTile = null;
  unit.buildTargetId = null;
  unit.state = 'idle';
}

function applySeparation(state, dtSec) {
  const units = state.entities.filter((e) => e.kind === 'unit' && !e.isDead && (e.state === 'moving' || e.state === 'idle'));
  const PUSH_SPEED = TILE * 1.4;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const minDist = (a.radius + b.radius) * TILE * 1.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < minDist) {
        const overlap = (minDist - d) / minDist;
        const nx = dx / d;
        const ny = dy / d;
        const push = PUSH_SPEED * overlap * dtSec * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export function updateMovement(state, dt) {
  const dtSec = dt / 1000;
  for (const u of state.entities) {
    if (u.kind !== 'unit' || u.isDead) continue;
    if (u.path && u.pathIndex < u.path.length) {
      const wp = u.path[u.pathIndex];
      const target = tileCenterPixel(wp.x, wp.y);
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const d = Math.hypot(dx, dy);
      const step = u.speed * TILE * dtSec;
      if (d <= step || d < 2) {
        u.x = target.x;
        u.y = target.y;
        u.pathIndex++;
        if (u.pathIndex >= u.path.length) {
          u.path = [];
          u.pathIndex = 0;
          if (u.state === 'moving') u.state = 'idle';
        }
      } else {
        u.x += (dx / d) * step;
        u.y += (dy / d) * step;
        if (u.state === 'idle') u.state = 'moving';
      }
    }
  }
  applySeparation(state, dtSec);
}

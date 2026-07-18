import { inBounds } from './map.js';

const MAX_NODES = 2500;

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].f <= a[i].f) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < a.length && a[l].f < a[smallest].f) smallest = l;
        if (r < a.length && a[r].f < a[smallest].f) smallest = r;
        if (smallest === i) break;
        [a[smallest], a[i]] = [a[i], a[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function key(x, y) { return y * 100000 + x; }

export function makeBlockedFn(map, occupiedSet) {
  return (tx, ty) => {
    if (!inBounds(tx, ty)) return true;
    const tile = map.tiles[ty][tx];
    if (tile.type !== 'grass') return true;
    return occupiedSet.has(key(tx, ty));
  };
}

const DIRS = [
  { dx: 1, dy: 0, cost: 1 }, { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 }, { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 }, { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 }, { dx: -1, dy: -1, cost: Math.SQRT2 },
];

export function findNearestWalkable(blocked, tx, ty, maxRadius = 6) {
  if (!blocked(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (!blocked(x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function findPath(blocked, startX, startY, goalX, goalY) {
  if (blocked(goalX, goalY)) {
    const alt = findNearestWalkable(blocked, goalX, goalY, 5);
    if (!alt) return null;
    goalX = alt.x;
    goalY = alt.y;
  }
  if (startX === goalX && startY === goalY) return [{ x: goalX, y: goalY }];

  const open = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();

  const startKey = key(startX, startY);
  gScore.set(startKey, 0);
  open.push({ x: startX, y: startY, g: 0, f: octile(startX, startY, goalX, goalY) });

  let explored = 0;
  while (open.size && explored < MAX_NODES) {
    const current = open.pop();
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    explored++;

    if (current.x === goalX && current.y === goalY) {
      const path = [];
      let k = ck;
      let node = { x: current.x, y: current.y };
      while (node) {
        path.push(node);
        const prev = cameFrom.get(k);
        if (!prev) break;
        node = prev;
        k = key(node.x, node.y);
      }
      path.reverse();
      return smoothPath(blocked, path);
    }

    for (const d of DIRS) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      if (blocked(nx, ny)) continue;
      if (d.dx !== 0 && d.dy !== 0) {
        if (blocked(current.x + d.dx, current.y) && blocked(current.x, current.y + d.dy)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const tentativeG = current.g + d.cost;
      if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, { x: current.x, y: current.y });
        open.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + octile(nx, ny, goalX, goalY) });
      }
    }
  }
  return null;
}

function hasLineOfSight(blocked, ax, ay, bx, by) {
  let x0 = ax, y0 = ay;
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if ((x0 !== ax || y0 !== ay) && blocked(x0, y0)) return false;
    if (dx !== 0 && dy !== 0) {
      if (blocked(x0 - sx, y0) && blocked(x0, y0 - sy)) return false;
    }
    if (x0 === bx && y0 === by) break;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return true;
}

function smoothPath(blocked, path) {
  if (path.length <= 2) return path;
  const result = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!hasLineOfSight(blocked, path[anchor].x, path[anchor].y, path[i].x, path[i].y)) {
      anchor = i - 1;
      result.push(path[anchor]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}

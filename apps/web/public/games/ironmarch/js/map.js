import { MAP_W, MAP_H, TILE } from './constants.js';
import { randInt } from './util.js';

const RESERVED = 4; // half-width of the guaranteed-clear zone around each base center

export function inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

export function tileToPixel(tx, ty) {
  return { x: tx * TILE, y: ty * TILE };
}

export function pixelToTile(px, py) {
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}

export function tileCenterPixel(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function makeBlankTiles() {
  const tiles = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) row.push({ type: 'grass' });
    tiles.push(row);
  }
  return tiles;
}

function inReserved(x, y, cx, cy) {
  return Math.abs(x - cx) <= RESERVED && Math.abs(y - cy) <= RESERVED;
}

function scatterForest(tiles, reservedCenters) {
  const clusters = 15;
  for (let c = 0; c < clusters; c++) {
    let x = randInt(3, MAP_W - 4);
    let y = randInt(3, MAP_H - 4);
    const steps = randInt(16, 30);
    for (let s = 0; s < steps; s++) {
      if (inBounds(x, y)) {
        const reserved = reservedCenters.some((p) => inReserved(x, y, p.x, p.y));
        const tile = tiles[y][x];
        if (!reserved && tile.type === 'grass') {
          tile.type = 'forest';
          tile.lumber = 400;
        }
      }
      x += randInt(-1, 1);
      y += randInt(-1, 1);
      x = Math.max(0, Math.min(MAP_W - 1, x));
      y = Math.max(0, Math.min(MAP_H - 1, y));
    }
  }
}

function placeMineNear(tiles, cx, cy, reservedCenters) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = randInt(5, 10);
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius);
    if (!inBounds(x, y)) continue;
    if (reservedCenters.some((p) => inReserved(x, y, p.x, p.y))) continue;
    const tile = tiles[y][x];
    if (tile.type !== 'grass') continue;
    tile.type = 'gold';
    tile.gold = 5000;
    return { x, y };
  }
  return null;
}

function placeNeutralMine(tiles, x, y) {
  if (!inBounds(x, y)) return;
  const tile = tiles[y][x];
  if (tile.type === 'gold') return;
  tiles[y][x] = { type: 'gold', gold: 6000 };
}

function clearReserved(tiles, cx, cy) {
  for (let y = cy - RESERVED; y <= cy + RESERVED; y++) {
    for (let x = cx - RESERVED; x <= cx + RESERVED; x++) {
      if (inBounds(x, y)) {
        tiles[y][x] = { type: 'grass' };
      }
    }
  }
}

export function isTerrainWalkable(tile) {
  return tile.type === 'grass';
}

function bfsConnected(tiles, from, to) {
  const visited = new Set();
  const key = (x, y) => `${x},${y}`;
  const queue = [from];
  visited.add(key(from.x, from.y));
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) return true;
    const neighbors = [
      { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 },
    ];
    for (const n of neighbors) {
      if (!inBounds(n.x, n.y)) continue;
      const k = key(n.x, n.y);
      if (visited.has(k)) continue;
      if (!isTerrainWalkable(tiles[n.y][n.x])) continue;
      visited.add(k);
      queue.push(n);
    }
  }
  return false;
}

function carveCorridor(tiles, from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const cx = Math.round(from.x + (to.x - from.x) * t);
    const cy = Math.round(from.y + (to.y - from.y) * t);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (inBounds(x, y)) tiles[y][x] = { type: 'grass' };
      }
    }
  }
}

export function generateMap() {
  const tiles = makeBlankTiles();

  const playerCenter = { x: 7, y: 7 };
  const enemyCenter = { x: MAP_W - 1 - 7, y: MAP_H - 1 - 7 };
  const midCenter = { x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) };
  const reservedCenters = [playerCenter, enemyCenter];

  scatterForest(tiles, reservedCenters);

  const playerMines = [
    placeMineNear(tiles, playerCenter.x, playerCenter.y, reservedCenters),
    placeMineNear(tiles, playerCenter.x, playerCenter.y, reservedCenters),
  ].filter(Boolean);
  const enemyMines = [
    placeMineNear(tiles, enemyCenter.x, enemyCenter.y, reservedCenters),
    placeMineNear(tiles, enemyCenter.x, enemyCenter.y, reservedCenters),
  ].filter(Boolean);

  placeNeutralMine(tiles, midCenter.x - 3, midCenter.y);
  placeNeutralMine(tiles, midCenter.x + 3, midCenter.y - 2);
  placeNeutralMine(tiles, midCenter.x, midCenter.y + 4);

  clearReserved(tiles, playerCenter.x, playerCenter.y);
  clearReserved(tiles, enemyCenter.x, enemyCenter.y);

  if (!bfsConnected(tiles, playerCenter, enemyCenter)) {
    carveCorridor(tiles, playerCenter, enemyCenter);
  }

  const playerBase = {
    center: playerCenter,
    townhall: { x: playerCenter.x - 1, y: playerCenter.y - 1 },
    farm: { x: playerCenter.x + 2, y: playerCenter.y - 1 },
  };
  const enemyBase = {
    center: enemyCenter,
    townhall: { x: enemyCenter.x - 1, y: enemyCenter.y - 1 },
    farm: { x: enemyCenter.x - 3, y: enemyCenter.y - 1 },
  };

  return {
    tiles,
    width: MAP_W,
    height: MAP_H,
    playerBase,
    enemyBase,
    playerMines,
    enemyMines,
  };
}

export function tileAt(map, tx, ty) {
  if (!inBounds(tx, ty)) return null;
  return map.tiles[ty][tx];
}

export function chopForest(tile, amount) {
  if (tile.type !== 'forest') return 0;
  const taken = Math.min(amount, tile.lumber);
  tile.lumber -= taken;
  if (tile.lumber <= 0) {
    tile.type = 'grass';
    delete tile.lumber;
  }
  return taken;
}

export function mineGold(tile, amount) {
  if (tile.type !== 'gold') return 0;
  const taken = Math.min(amount, tile.gold);
  tile.gold -= taken;
  if (tile.gold <= 0) {
    tile.type = 'rubble';
    delete tile.gold;
  }
  return taken;
}

import { TILE } from './constants.js';

export function createFow(map) {
  const n = map.width * map.height;
  return { explored: new Uint8Array(n), visible: new Uint8Array(n), width: map.width, height: map.height };
}

export function recomputeVisibility(fow, state, map) {
  fow.visible.fill(0);
  for (const e of state.entities) {
    if (e.side !== 'player' || e.isDead) continue;
    const sightTiles = e.sight;
    const centerX = e.kind === 'building' ? e.tx + e.size / 2 : e.x / TILE;
    const centerY = e.kind === 'building' ? e.ty + e.size / 2 : e.y / TILE;
    const r2 = sightTiles * sightTiles;
    const minX = Math.max(0, Math.floor(centerX - sightTiles));
    const maxX = Math.min(map.width - 1, Math.ceil(centerX + sightTiles));
    const minY = Math.max(0, Math.floor(centerY - sightTiles));
    const maxY = Math.min(map.height - 1, Math.ceil(centerY + sightTiles));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - centerX;
        const dy = y + 0.5 - centerY;
        if (dx * dx + dy * dy <= r2) {
          const idx = y * map.width + x;
          fow.visible[idx] = 1;
          fow.explored[idx] = 1;
        }
      }
    }
  }
}

export function visibilityAt(fow, map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 0;
  const idx = ty * map.width + tx;
  if (fow.visible[idx]) return 2;
  if (fow.explored[idx]) return 1;
  return 0;
}

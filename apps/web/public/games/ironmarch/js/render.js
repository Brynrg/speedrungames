import { TILE, VIEW_W, VIEW_H, MINIMAP_W, MINIMAP_H, MAP_W, MAP_H, FACTIONS, BUILDING_DATA } from './constants.js';
import { visibilityAt } from './fow.js';
import { footprintClear } from './economy.js';

const TILE_COLORS = {
  grass: '#3c6b3f',
  forest: '#254a2c',
  gold: '#8a7530',
  rubble: '#5a5750',
};

function drawTile(ctx, tile, px, py, vis) {
  ctx.fillStyle = TILE_COLORS[tile.type] || '#333';
  ctx.fillRect(px, py, TILE, TILE);
  if (tile.type === 'forest') {
    const frac = Math.max(0, tile.lumber / 400);
    const dots = frac > 0.66 ? 3 : frac > 0.33 ? 2 : 1;
    ctx.fillStyle = '#1a3620';
    const spots = [[10, 10], [20, 14], [14, 22]];
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(px + spots[i][0], py + spots[i][1], 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tile.type === 'gold') {
    ctx.fillStyle = '#e8c94a';
    ctx.beginPath();
    ctx.moveTo(px + 16, py + 6);
    ctx.lineTo(px + 26, py + 16);
    ctx.lineTo(px + 16, py + 26);
    ctx.lineTo(px + 6, py + 16);
    ctx.closePath();
    ctx.fill();
  }
  if (vis === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px, py, TILE, TILE);
  }
}

function drawHealthBar(ctx, hp, maxHp, forceShow, px, py, width) {
  if (hp >= maxHp && !forceShow) return;
  const w = width;
  const h = 4;
  const frac = Math.max(0, hp / maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px - w / 2, py, w, h);
  ctx.fillStyle = frac > 0.5 ? '#5ec95e' : frac > 0.25 ? '#e0c23c' : '#d4453c';
  ctx.fillRect(px - w / 2, py, w * frac, h);
}

function unitGlyph(ctx, unit, cx, cy, r, accent) {
  ctx.fillStyle = accent;
  if (unit.isWorker) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.ranged) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.35);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (unit.type === 'knight' || unit.type === 'raider') {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i - Math.PI / 4;
      const rad = i % 2 === 0 ? r * 0.55 : r * 0.25;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(cx - r * 0.32, cy - r * 0.32, r * 0.64, r * 0.64);
  }
}

function drawUnit(ctx, state, unit, camX, camY) {
  const faction = FACTIONS[unit.side];
  const px = unit.x - camX;
  const py = unit.y - camY;
  const r = Math.max(9, unit.radius * TILE);
  const selected = state.selection.includes(unit.id);

  ctx.globalAlpha = unit.isDead ? Math.max(0, 1 - unit.deathTimer / 700) : 1;

  if (selected) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = unit.isDead ? '#555' : faction.color;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!unit.isDead) unitGlyph(ctx, unit, px, py, r, faction.accent);

  if (unit.carrying) {
    ctx.fillStyle = unit.carrying.type === 'gold' ? '#e8c94a' : '#8a5a2b';
    ctx.fillRect(px - 5, py - r - 10, 10, 8);
  }

  drawHealthBar(ctx, unit.hp, unit.maxHp, selected, px, py - r - 8, r * 2);
  ctx.globalAlpha = 1;
}

function drawBuilding(ctx, state, building, camX, camY, dim) {
  const faction = FACTIONS[building.side];
  const stats = BUILDING_DATA[building.type];
  const w = building.size * TILE;
  const px = building.x - camX - w / 2;
  const py = building.y - camY - w / 2;
  const selected = state.selection.includes(building.id);

  let alpha = building.isDead ? Math.max(0, 1 - building.deathTimer / 700) : (building.constructing ? 0.75 : 1);
  if (dim) alpha *= 0.5;
  ctx.globalAlpha = alpha;

  if (selected) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    ctx.strokeRect(px - 3, py - 3, w + 6, w + 6);
  }

  ctx.fillStyle = building.isDead ? '#444' : faction.dark;
  ctx.fillRect(px, py, w, w);
  ctx.strokeStyle = faction.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, w, w);

  if (stats.isMain) {
    ctx.fillStyle = faction.accent;
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + w * 0.2);
    ctx.lineTo(px + w * 0.8, py + w * 0.5);
    ctx.lineTo(px + w * 0.5, py + w * 0.8);
    ctx.lineTo(px + w * 0.2, py + w * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (stats.isDefense) {
    ctx.fillStyle = faction.accent;
    ctx.beginPath();
    ctx.arc(px + w / 2, py + w / 2, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (stats.food) {
    ctx.fillStyle = faction.accent;
    ctx.fillRect(px + w * 0.3, py + w * 0.3, w * 0.4, w * 0.4);
  } else if (stats.unlocksTech) {
    ctx.fillStyle = faction.accent;
    ctx.beginPath();
    ctx.moveTo(px + w * 0.2, py + w * 0.7);
    ctx.lineTo(px + w * 0.5, py + w * 0.2);
    ctx.lineTo(px + w * 0.8, py + w * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (stats.produces) {
    ctx.fillStyle = faction.accent;
    ctx.beginPath();
    ctx.arc(px + w * 0.35, py + w * 0.5, w * 0.12, 0, Math.PI * 2);
    ctx.arc(px + w * 0.65, py + w * 0.5, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (building.constructing && !building.isDead) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px, py + w + 4, w, 5);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(px, py + w + 4, w * building.buildProgress, 5);
  } else {
    drawHealthBar(ctx, building.hp, building.maxHp, selected, px + w / 2, py - 8, w);
  }

  ctx.globalAlpha = 1;
}

function drawProjectiles(ctx, state, map, fow, camX, camY) {
  for (const p of state.projectiles) {
    // A shot between two off-vision entities would otherwise leak combat
    // info through solid fog — only render it if at least one endpoint sits
    // on a currently-visible tile.
    const aVis = visibilityAt(fow, map, Math.floor(p.x1 / TILE), Math.floor(p.y1 / TILE)) === 2;
    const bVis = visibilityAt(fow, map, Math.floor(p.x2 / TILE), Math.floor(p.y2 / TILE)) === 2;
    if (!aVis && !bVis) continue;
    const t = Math.min(1, p.t / p.duration);
    const x = p.x1 + (p.x2 - p.x1) * t - camX;
    const y = p.y1 + (p.y2 - p.y1) * t - camY;
    ctx.fillStyle = FACTIONS[p.side].accent;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlacementGhost(ctx, state, map, camX, camY) {
  const placement = state.placement;
  if (!placement) return;
  const stats = BUILDING_DATA[placement.buildKey];
  const w = stats.size * TILE;
  const ok = footprintClear(state, map, placement.tx, placement.ty, stats.size);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ok ? '#5ec95e' : '#d4453c';
  ctx.fillRect(placement.tx * TILE - camX, placement.ty * TILE - camY, w, w);
  ctx.globalAlpha = 1;
}

export function render(ctx, state, map, fow) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const camX = state.camera.x;
  const camY = state.camera.y;

  const minTx = Math.max(0, Math.floor(camX / TILE));
  const maxTx = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / TILE));
  const minTy = Math.max(0, Math.floor(camY / TILE));
  const maxTy = Math.min(MAP_H - 1, Math.ceil((camY + VIEW_H) / TILE));

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const vis = visibilityAt(fow, map, tx, ty);
      const px = tx * TILE - camX;
      const py = ty * TILE - camY;
      if (vis === 0) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      drawTile(ctx, map.tiles[ty][tx], px, py, vis);
    }
  }

  const sorted = [...state.entities].sort((a, b) => a.y - b.y);
  for (const e of sorted) {
    let dim = false;
    if (e.side === 'enemy') {
      const tx = e.kind === 'building' ? e.tx + Math.floor(e.size / 2) : Math.floor(e.x / TILE);
      const ty = e.kind === 'building' ? e.ty + Math.floor(e.size / 2) : Math.floor(e.y / TILE);
      const vis = visibilityAt(fow, map, tx, ty);
      if (e.kind === 'unit') {
        if (vis !== 2) continue; // units still hide fully once out of direct sight
      } else if (vis === 0) {
        continue; // buildings are static — remain visible (dimmed) once explored, like terrain
      } else {
        dim = vis === 1;
      }
    }
    if (e.kind === 'building') drawBuilding(ctx, state, e, camX, camY, dim);
    else drawUnit(ctx, state, e, camX, camY);
  }

  drawProjectiles(ctx, state, map, fow, camX, camY);
  drawPlacementGhost(ctx, state, map, camX, camY);

  if (state.selectBox) {
    const b = state.selectBox;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    ctx.fillStyle = 'rgba(255,224,102,0.12)';
    ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  }
}

export function renderMinimap(ctx, state, map, fow) {
  ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
  const sx = MINIMAP_W / MAP_W;
  const sy = MINIMAP_H / MAP_H;
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const vis = visibilityAt(fow, map, tx, ty);
      if (vis === 0) { ctx.fillStyle = '#050505'; }
      else {
        const tile = map.tiles[ty][tx];
        ctx.fillStyle = TILE_COLORS[tile.type] || '#333';
      }
      ctx.fillRect(tx * sx, ty * sy, sx + 0.6, sy + 0.6);
    }
  }
  for (const e of state.entities) {
    if (e.isDead) continue;
    let dim = false;
    if (e.side === 'enemy') {
      const tx = e.kind === 'building' ? e.tx + Math.floor(e.size / 2) : Math.floor(e.x / TILE);
      const ty = e.kind === 'building' ? e.ty + Math.floor(e.size / 2) : Math.floor(e.y / TILE);
      const vis = visibilityAt(fow, map, tx, ty);
      if (e.kind === 'unit') {
        if (vis !== 2) continue;
      } else if (vis === 0) {
        continue;
      } else {
        dim = vis === 1;
      }
    }
    ctx.globalAlpha = dim ? 0.5 : 1;
    ctx.fillStyle = FACTIONS[e.side].color;
    const mx = (e.x / TILE) * sx;
    const my = (e.y / TILE) * sy;
    const size = e.kind === 'building' ? 3 : 2;
    ctx.fillRect(mx - size / 2, my - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    (state.camera.x / TILE) * sx,
    (state.camera.y / TILE) * sy,
    (VIEW_W / TILE) * sx,
    (VIEW_H / TILE) * sy,
  );
}

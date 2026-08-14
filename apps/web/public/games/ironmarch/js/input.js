import { TILE, VIEW_W, VIEW_H, MAP_W, MAP_H, BUILDING_DATA } from './constants.js';
import { clamp, dist } from './util.js';
import { pixelToTile, tileAt, tileCenterPixel } from './map.js';
import { getById, moveUnitTo, resetForNewOrder } from './entities.js';
import { orderHarvest, assistBuild, orderBuild, footprintClear } from './economy.js';
import { issueAttack } from './combat.js';
import { pushMessage } from './messages.js';
import { toggleMute, initSfx } from './sfx.js';

function entityAtPoint(state, wx, wy) {
  for (const e of state.entities) {
    if (e.isDead || e.kind !== 'unit') continue;
    const r = Math.max(9, e.radius * TILE);
    if (dist(wx, wy, e.x, e.y) <= r) return e;
  }
  for (const e of state.entities) {
    if (e.isDead || e.kind !== 'building') continue;
    const half = (e.size * TILE) / 2;
    if (wx >= e.x - half && wx <= e.x + half && wy >= e.y - half && wy <= e.y + half) return e;
  }
  return null;
}

function spiralOffsets(n) {
  const offsets = [{ x: 0, y: 0 }];
  let r = 1;
  while (offsets.length < n && r < 12) {
    for (let dy = -r; dy <= r && offsets.length < n; dy++) {
      for (let dx = -r; dx <= r && offsets.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        offsets.push({ x: dx, y: dy });
      }
    }
    r++;
  }
  return offsets;
}

function moveGroup(state, map, units, tx, ty) {
  if (!units.length) return;
  const offsets = spiralOffsets(units.length);
  units.forEach((u, i) => {
    const off = offsets[i] || { x: 0, y: 0 };
    const destTx = clamp(tx + off.x, 0, MAP_W - 1);
    const destTy = clamp(ty + off.y, 0, MAP_H - 1);
    resetForNewOrder(state, u);
    u.order = { type: 'move', tx: destTx, ty: destTy };
    u.homeAnchor = tileCenterPixel(destTx, destTy);
    moveUnitTo(state, map, u, destTx, destTy);
  });
}

function handleRightClick(state, map, wx, wy) {
  if (!state.selection.length) return;
  const selectedEntities = state.selection.map((id) => getById(state, id)).filter(Boolean);
  const units = selectedEntities.filter((e) => e.kind === 'unit' && e.side === 'player');
  const buildings = selectedEntities.filter((e) => e.kind === 'building' && e.side === 'player');
  const targetTile = pixelToTile(wx, wy);
  const targetEntity = entityAtPoint(state, wx, wy);

  if (!units.length) {
    if (buildings.length) {
      for (const b of buildings) {
        if (BUILDING_DATA[b.type].produces) b.rallyPoint = { x: targetTile.x, y: targetTile.y };
      }
    }
    return;
  }

  if (targetEntity && targetEntity.side === 'enemy' && !targetEntity.isDead) {
    for (const u of units) issueAttack(state, map, u, targetEntity);
    return;
  }

  const tile = tileAt(map, targetTile.x, targetTile.y);
  if (tile && (tile.type === 'forest' || tile.type === 'gold')) {
    const workers = units.filter((u) => u.isWorker);
    const others = units.filter((u) => !u.isWorker);
    for (const w of workers) orderHarvest(state, map, w, targetTile.x, targetTile.y);
    moveGroup(state, map, others, targetTile.x, targetTile.y);
    return;
  }

  if (targetEntity && targetEntity.side === 'player' && targetEntity.kind === 'building' && targetEntity.constructing) {
    const workers = units.filter((u) => u.isWorker);
    const others = units.filter((u) => !u.isWorker);
    for (const w of workers) assistBuild(state, map, w, targetEntity);
    moveGroup(state, map, others, targetTile.x, targetTile.y);
    return;
  }

  moveGroup(state, map, units, targetTile.x, targetTile.y);
}

function trySingleSelect(state, wx, wy, shiftKey) {
  const e = entityAtPoint(state, wx, wy);
  if (!e || e.side !== 'player') {
    if (!shiftKey) state.selection = [];
    return;
  }
  if (shiftKey) {
    if (!state.selection.includes(e.id)) state.selection.push(e.id);
  } else {
    state.selection = [e.id];
  }
}

function tryBoxSelect(state, wx0, wy0, wx1, wy1, shiftKey) {
  const minX = Math.min(wx0, wx1);
  const maxX = Math.max(wx0, wx1);
  const minY = Math.min(wy0, wy1);
  const maxY = Math.max(wy0, wy1);
  const found = state.entities
    .filter((e) => e.kind === 'unit' && e.side === 'player' && !e.isDead && e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY)
    .map((e) => e.id);
  if (!found.length) {
    if (!shiftKey) state.selection = [];
    return;
  }
  state.selection = shiftKey ? Array.from(new Set([...state.selection, ...found])) : found;
}

export function startPlacement(state, buildKey) {
  state.placement = { buildKey, tx: 0, ty: 0 };
}

export function cancelPlacement(state) {
  state.placement = null;
}

function confirmPlacement(state, map) {
  const placement = state.placement;
  if (!placement) return;
  const stats = BUILDING_DATA[placement.buildKey];
  const builder = state.selection.map((id) => getById(state, id)).find((e) => e && e.kind === 'unit' && e.isWorker && !e.isDead);
  if (!builder) { state.placement = null; return; }
  if (!footprintClear(state, map, placement.tx, placement.ty, stats.size)) return;
  orderBuild(state, map, 'player', placement.buildKey, placement.tx, placement.ty, builder);
  state.placement = null;
}

export function setupInput(state, map, canvas, minimapCanvas) {
  initSfx();
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = sx + state.camera.x;
    const wy = sy + state.camera.y;

    if (state.placement) {
      if (e.button === 0) confirmPlacement(state, map);
      else if (e.button === 2) cancelPlacement(state);
      return;
    }

    if (e.button === 0) {
      state.input.dragStart = { sx, sy, wx, wy };
      state.selectBox = { x0: sx, y0: sy, x1: sx, y1: sy };
    } else if (e.button === 2) {
      handleRightClick(state, map, wx, wy);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    state.input.mouseX = sx;
    state.input.mouseY = sy;

    if (state.placement) {
      const wx = sx + state.camera.x;
      const wy = sy + state.camera.y;
      const t = pixelToTile(wx, wy);
      const stats = BUILDING_DATA[state.placement.buildKey];
      state.placement.tx = clamp(t.x, 0, MAP_W - stats.size);
      state.placement.ty = clamp(t.y, 0, MAP_H - stats.size);
    }

    if (state.input.dragStart) {
      state.selectBox = { x0: state.input.dragStart.sx, y0: state.input.dragStart.sy, x1: sx, y1: sy };
    }
  });

  canvas.addEventListener('mouseenter', () => { state.input.overCanvas = true; });
  canvas.addEventListener('mouseleave', () => { state.input.overCanvas = false; });

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !state.input.dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const sx = clamp(e.clientX - rect.left, 0, VIEW_W);
    const sy = clamp(e.clientY - rect.top, 0, VIEW_H);
    const wx = sx + state.camera.x;
    const wy = sy + state.camera.y;
    const start = state.input.dragStart;
    const dragDist = Math.hypot(sx - start.sx, sy - start.sy);
    if (dragDist < 6) {
      trySingleSelect(state, wx, wy, e.shiftKey);
    } else {
      tryBoxSelect(state, start.wx, start.wy, wx, wy, e.shiftKey);
    }
    state.input.dragStart = null;
    state.selectBox = null;
  });

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    state.input.keysDown.add(key);
    if (key === 'escape') {
      if (state.placement) cancelPlacement(state);
      else state.selection = [];
      return;
    }
    if (key === 'm') {
      const nowMuted = toggleMute();
      pushMessage(state, nowMuted ? 'Sound muted (M to unmute)' : 'Sound on');
      return;
    }
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      // Ctrl/Cmd+1-9 are reserved browser-chrome shortcuts (switch tabs) in
      // Chrome, Edge, and Safari — they never reach the page, so control
      // groups are bound to Shift+1-9 instead, which isn't intercepted.
      if (e.shiftKey) {
        state.controlGroups[num] = [...state.selection];
      } else if (state.controlGroups[num] && state.controlGroups[num].length) {
        state.selection = state.controlGroups[num].filter((id) => state.entitiesById.has(id));
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    state.input.keysDown.delete(e.key.toLowerCase());
  });

  function jumpCamera(e) {
    // Use the canvas's actual RENDERED size (CSS layout, stretched by
    // style.css to fill the sidebar), not MINIMAP_W/H — those are only the
    // canvas's internal drawing-buffer resolution and can differ a lot from
    // the on-screen box, which silently misaligns every minimap click.
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = clamp(e.clientX - rect.left, 0, rect.width);
    const my = clamp(e.clientY - rect.top, 0, rect.height);
    const tx = (mx / rect.width) * MAP_W;
    const ty = (my / rect.height) * MAP_H;
    state.camera.x = clamp(tx * TILE - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
    state.camera.y = clamp(ty * TILE - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
  }
  minimapCanvas.addEventListener('mousedown', jumpCamera);
  minimapCanvas.addEventListener('mousemove', (e) => { if (e.buttons === 1) jumpCamera(e); });
}

export function updateCameraScroll(state, dt) {
  const speed = 640 * (dt / 1000);
  const keys = state.input.keysDown;
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (state.input.overCanvas && !state.input.dragStart) {
    if (state.input.mouseX < 14) dx -= 1;
    if (state.input.mouseX > VIEW_W - 14) dx += 1;
    if (state.input.mouseY < 14) dy -= 1;
    if (state.input.mouseY > VIEW_H - 14) dy += 1;
  }
  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    state.camera.x = clamp(state.camera.x + (dx / len) * speed, 0, MAP_W * TILE - VIEW_W);
    state.camera.y = clamp(state.camera.y + (dy / len) * speed, 0, MAP_H * TILE - VIEW_H);
  }
}

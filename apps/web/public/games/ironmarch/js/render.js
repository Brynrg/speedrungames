import { TILE, VIEW_W, VIEW_H, MINIMAP_W, MINIMAP_H, MAP_W, MAP_H, FACTIONS, BUILDING_DATA } from './constants.js';
import { visibilityAt } from './fow.js';
import { footprintClear } from './economy.js';
import { hitFlashAmount } from './vfx.js';

// ---- palette --------------------------------------------------------------

const GRASS_SHADES = ['#3a6a3d', '#3f7042', '#376538'];
const FOREST_FLOOR = '#28492e';
const TREE_DARK = '#1d3823';
const TREE_LIGHT = '#2f5636';
const ORE_ROCK = '#6b5d47';
const ORE_ROCK_DARK = '#564a38';
const ORE_VEIN = '#e8c94a';
const ORE_VEIN_BRIGHT = '#fff4c2';
const RUBBLE = '#5a5750';
const RUBBLE_DARK = '#454339';
const FOG_UNSEEN = '#050505';

// ---- small helpers ----------------------------------------------------------

// Deterministic per-tile pseudo-random in [0,1) — used for texture variation
// so it stays stable frame to frame instead of flickering.
function tileHash(tx, ty, salt = 0) {
  let h = (tx * 374761393 + ty * 668265263 + salt * 2654435761) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixColor(hexA, hexB, t) {
  if (t <= 0) return hexA;
  if (t >= 1) return hexB;
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function drawShadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- terrain ----------------------------------------------------------------

function drawTile(ctx, tile, tx, ty, px, py, vis, time) {
  if (tile.type === 'grass' || tile.type === 'forest' || tile.type === 'gold' || tile.type === 'rubble') {
    const shade = GRASS_SHADES[Math.floor(tileHash(tx, ty) * GRASS_SHADES.length)];
    ctx.fillStyle = tile.type === 'forest' ? FOREST_FLOOR : shade;
    ctx.fillRect(px, py, TILE, TILE);
  }

  // subtle blade/tuft texture on open grass only
  if (tile.type === 'grass') {
    ctx.fillStyle = 'rgba(20,40,22,0.35)';
    for (let i = 0; i < 3; i++) {
      const hx = tileHash(tx, ty, i * 7 + 1) * TILE;
      const hy = tileHash(tx, ty, i * 7 + 2) * TILE;
      ctx.fillRect(px + hx, py + hy, 2, 4);
    }
  }

  if (tile.type === 'forest') {
    const frac = Math.max(0, (tile.lumber ?? 0) / 400);
    const treeCount = frac > 0.6 ? 3 : frac > 0.25 ? 2 : 1;
    const spots = [[10, 20], [21, 12], [15, 26]];
    for (let i = 0; i < treeCount; i++) {
      const [ox, oy] = spots[i];
      const jx = (tileHash(tx, ty, i * 3 + 1) - 0.5) * 4;
      const jy = (tileHash(tx, ty, i * 3 + 2) - 0.5) * 4;
      const cx = px + ox + jx;
      const cy = py + oy + jy;
      const scale = 0.85 + tileHash(tx, ty, i * 3 + 3) * 0.3;
      drawShadow(ctx, cx, cy + 3 * scale, 6 * scale, 2.4 * scale);
      // trunk
      ctx.fillStyle = '#4a3826';
      ctx.fillRect(cx - 1.2 * scale, cy - 1, 2.4 * scale, 4 * scale);
      // two-tier pine canopy
      ctx.fillStyle = TREE_DARK;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12 * scale);
      ctx.lineTo(cx + 6.5 * scale, cy - 1 * scale);
      ctx.lineTo(cx - 6.5 * scale, cy - 1 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = TREE_LIGHT;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8 * scale);
      ctx.lineTo(cx + 4.6 * scale, cy - 0.5 * scale);
      ctx.lineTo(cx - 4.6 * scale, cy - 0.5 * scale);
      ctx.closePath();
      ctx.fill();
    }
  } else if (tile.type === 'gold') {
    const cx = px + 16;
    const cy = py + 17;
    drawShadow(ctx, cx, cy + 6, 12, 4);
    ctx.fillStyle = ORE_ROCK_DARK;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 6);
    ctx.lineTo(cx - 10, cy - 8);
    ctx.lineTo(cx - 1, cy - 13);
    ctx.lineTo(cx + 9, cy - 9);
    ctx.lineTo(cx + 13, cy + 3);
    ctx.lineTo(cx + 7, cy + 9);
    ctx.lineTo(cx - 6, cy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ORE_ROCK;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 3);
    ctx.lineTo(cx - 7, cy - 6);
    ctx.lineTo(cx - 1, cy - 10);
    ctx.lineTo(cx + 7, cy - 6);
    ctx.lineTo(cx + 9, cy + 1);
    ctx.lineTo(cx + 2, cy + 6);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const vx = cx - 8 + tileHash(tx, ty, i * 5 + 1) * 16;
      const vy = cy - 8 + tileHash(tx, ty, i * 5 + 2) * 12;
      const twinkle = 0.55 + 0.45 * Math.sin(time / 350 + tileHash(tx, ty, i) * 20);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i === 0 ? ORE_VEIN_BRIGHT : ORE_VEIN;
      ctx.beginPath();
      ctx.arc(vx, vy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (tile.type === 'rubble') {
    const cx = px + 16;
    const cy = py + 18;
    drawShadow(ctx, cx, cy + 4, 11, 3.5);
    for (let i = 0; i < 5; i++) {
      const rx = cx - 10 + tileHash(tx, ty, i * 3 + 1) * 20;
      const ry = cy - 6 + tileHash(tx, ty, i * 3 + 2) * 10;
      const rs = 2.5 + tileHash(tx, ty, i * 3 + 3) * 3;
      ctx.fillStyle = i % 2 === 0 ? RUBBLE : RUBBLE_DARK;
      ctx.beginPath();
      ctx.arc(rx, ry, rs, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (vis === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px, py, TILE, TILE);
  }
}

// ---- health bar ---------------------------------------------------------------

function drawHealthBar(ctx, hp, maxHp, forceShow, px, py, width) {
  if (hp >= maxHp && !forceShow) return;
  const w = width;
  const h = 4;
  const frac = Math.max(0, hp / maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(px - w / 2 - 1, py - 1, w + 2, h + 2);
  ctx.fillStyle = frac > 0.5 ? '#5ec95e' : frac > 0.25 ? '#e0c23c' : '#d4453c';
  ctx.fillRect(px - w / 2, py, w * frac, h);
}

// ---- units --------------------------------------------------------------------

function drawWeapon(ctx, unit, r, accent, dark) {
  const facing = unit.facing || 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const px = -fy; // perpendicular
  const py = fx;

  ctx.strokeStyle = dark;
  ctx.lineCap = 'round';

  if (unit.isWorker) {
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(-fx * r * 0.1, -fy * r * 0.1);
    ctx.lineTo(fx * r * 0.85, fy * r * 0.85);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(fx * r * 0.85, fy * r * 0.85, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (unit.ranged) {
    if (unit.type === 'archer') {
      // bow: an arc held perpendicular to facing
      ctx.lineWidth = Math.max(1.2, r * 0.14);
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(fx * r * 0.55, fy * r * 0.55, r * 0.5, Math.atan2(py, px) - 1.1, Math.atan2(py, px) + 1.1);
      ctx.stroke();
    } else {
      // spearman: a long spear line forward with a small blade
      ctx.lineWidth = Math.max(1.3, r * 0.15);
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-fx * r * 0.3, -fy * r * 0.3);
      ctx.lineTo(fx * r * 1.15, fy * r * 1.15);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(fx * r * 1.15, fy * r * 1.15);
      ctx.lineTo(fx * r * 0.85 + px * r * 0.18, fy * r * 0.85 + py * r * 0.18);
      ctx.lineTo(fx * r * 0.85 - px * r * 0.18, fy * r * 0.85 - py * r * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  // melee: shield on the off-hand side + short blade forward
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(-px * r * 0.68, -py * r * 0.68, r * 0.3, r * 0.4, facing, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = '#dfe6ee';
  ctx.lineWidth = Math.max(1.6, r * 0.2);
  ctx.beginPath();
  ctx.moveTo(fx * r * 0.15, fy * r * 0.15);
  ctx.lineTo(fx * r * 0.95, fy * r * 0.95);
  ctx.stroke();

  if (unit.type === 'knight' || unit.type === 'raider') {
    // plume/crest on top for heavy units
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.22, -r * 1.05);
    ctx.lineTo(-r * 0.05, -r * 0.75);
    ctx.closePath();
    ctx.fill();
  }
}

function drawUnit(ctx, state, unit, camX, camY) {
  const faction = FACTIONS[unit.side];
  const heavy = unit.type === 'knight' || unit.type === 'raider';
  const baseR = Math.max(9, unit.radius * TILE) * (heavy ? 1.12 : 1);
  const bob = unit.state === 'moving' && !unit.isDead ? Math.sin(state.time / 120 + unit.id) * 1.4 : 0;

  let lunge = 0;
  if (unit.state === 'attacking' && unit.atkCooldown > 0) {
    const phase = 1 - unit.cooldownTimer / unit.atkCooldown;
    if (phase >= 0 && phase < 0.18) lunge = (1 - phase / 0.18) * baseR * 0.22;
  }
  const facing = unit.facing || 0;
  const px = unit.x - camX + Math.cos(facing) * lunge;
  const py = unit.y - camY + Math.sin(facing) * lunge + bob;

  const selected = state.selection.includes(unit.id);
  ctx.globalAlpha = unit.isDead ? Math.max(0, 1 - unit.deathTimer / 700) : 1;

  drawShadow(ctx, unit.x - camX, unit.y - camY + baseR * 0.55, baseR * 0.85, baseR * 0.32);

  if (selected) {
    const pulse = 0.55 + 0.45 * Math.sin(state.time / 260);
    ctx.strokeStyle = `rgba(255,224,102,${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, baseR + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const flash = unit.isDead ? 0 : hitFlashAmount(state, unit.id);
  const bodyColor = unit.isDead ? '#4a4a4a' : mixColor(faction.dark, '#ffffff', flash * 0.85);
  const cloakColor = unit.isDead ? '#5c5c5c' : mixColor(faction.color, '#ffffff', flash * 0.7);

  // cloak: a soft wedge trailing opposite the facing direction
  if (!unit.isDead) {
    ctx.fillStyle = cloakColor;
    ctx.beginPath();
    ctx.ellipse(px - Math.cos(facing) * baseR * 0.25, py - Math.sin(facing) * baseR * 0.25, baseR * 0.95, baseR * 0.7, facing, 0, Math.PI * 2);
    ctx.fill();
  }

  // body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(px, py, baseR * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  if (!unit.isDead) drawWeapon(ctx, unit, baseR, faction.accent, faction.dark);

  if (unit.carrying) {
    const carryColor = unit.carrying.type === 'gold' ? '#e8c94a' : '#c98a4b';
    const wobble = Math.sin(state.time / 150) * 1.2;
    ctx.fillStyle = carryColor;
    ctx.beginPath();
    ctx.ellipse(px, py - baseR - 9 + wobble, 5.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawHealthBar(ctx, unit.hp, unit.maxHp, selected, px, py - baseR - 8, baseR * 2);
  ctx.globalAlpha = 1;
}

// ---- buildings ------------------------------------------------------------------

function buildingPalette(side) {
  return side === 'player'
    ? { wall: '#3a3f4a', wallDark: '#282c34', roof: '#2f4a72', roofDark: '#1f3350' }
    : { wall: '#463526', wallDark: '#2e2118', roof: '#6b241c', roofDark: '#481811' };
}

function drawBuildingIcon(ctx, stats, faction, px, py, w) {
  ctx.fillStyle = faction.accent;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  if (stats.isMain) {
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + w * 0.18);
    ctx.lineTo(px + w * 0.82, py + w * 0.5);
    ctx.lineTo(px + w * 0.5, py + w * 0.82);
    ctx.lineTo(px + w * 0.18, py + w * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stats.isDefense) {
    ctx.beginPath();
    ctx.arc(px + w / 2, py + w / 2, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + w * 0.5 - w * 0.32);
    ctx.lineTo(px + w / 2, py + w * 0.5 - w * 0.5);
    ctx.strokeStyle = faction.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (stats.food) {
    ctx.beginPath();
    ctx.moveTo(px + w * 0.5, py + w * 0.24);
    ctx.lineTo(px + w * 0.68, py + w * 0.62);
    ctx.lineTo(px + w * 0.32, py + w * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stats.unlocksTech) {
    ctx.beginPath();
    ctx.moveTo(px + w * 0.22, py + w * 0.68);
    ctx.lineTo(px + w * 0.5, py + w * 0.2);
    ctx.lineTo(px + w * 0.78, py + w * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stats.produces) {
    ctx.beginPath();
    ctx.arc(px + w * 0.36, py + w * 0.5, w * 0.11, 0, Math.PI * 2);
    ctx.arc(px + w * 0.64, py + w * 0.5, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawBuilding(ctx, state, building, camX, camY, dim) {
  const faction = FACTIONS[building.side];
  const stats = BUILDING_DATA[building.type];
  const pal = buildingPalette(building.side);
  const w = building.size * TILE;
  const px = building.x - camX - w / 2;
  const py = building.y - camY - w / 2;
  const selected = state.selection.includes(building.id);

  let alpha = building.isDead
    ? Math.max(0, 1 - building.deathTimer / 700)
    : building.constructing
      ? 0.4 + 0.5 * building.buildProgress
      : 1;
  if (dim) alpha *= 0.5;
  ctx.globalAlpha = alpha;

  drawShadow(ctx, building.x - camX + w * 0.08, building.y - camY + w * 0.16, w * 0.58, w * 0.22);

  if (selected) {
    const pulse = 0.55 + 0.45 * Math.sin(state.time / 260);
    ctx.strokeStyle = `rgba(255,224,102,${0.6 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(px - 3, py - 3, w + 6, w + 6);
  }

  const flash = building.isDead ? 0 : hitFlashAmount(state, building.id);
  const wallColor = building.isDead ? '#3a3a3a' : mixColor(pal.wall, '#ffffff', flash * 0.8);
  const roofColor = building.isDead ? '#4a4a4a' : mixColor(pal.roof, '#ffffff', flash * 0.8);

  // wall base
  ctx.fillStyle = wallColor;
  ctx.fillRect(px, py, w, w);
  ctx.strokeStyle = pal.wallDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, w, w);

  // pitched roof, inset from the walls, with a ridge + gable ends for a
  // top-down "building" read instead of a flat colored square
  const inset = w * 0.1;
  const rx = px + inset;
  const ry = py + inset;
  const rw = w - inset * 2;
  ctx.fillStyle = roofColor;
  ctx.fillRect(rx, ry, rw, rw);
  const baseAlpha = ctx.globalAlpha;
  ctx.fillStyle = pal.roofDark;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(rx + rw * 0.5, ry + rw * 0.5);
  ctx.lineTo(rx, ry + rw);
  ctx.closePath();
  ctx.globalAlpha = baseAlpha * 0.35;
  ctx.fill();
  ctx.globalAlpha = baseAlpha;
  ctx.strokeStyle = pal.roofDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx + rw * 0.5, ry);
  ctx.lineTo(rx + rw * 0.5, ry + rw);
  ctx.stroke();
  ctx.strokeStyle = building.side === 'player' ? '#141820' : '#1a0f0a';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rw);

  // faction corner accents — spikes for orc, banner posts for human
  ctx.fillStyle = faction.color;
  if (building.side === 'enemy') {
    for (const [cx0, cy0] of [[px, py], [px + w, py], [px, py + w], [px + w, py + w]]) {
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(cx0 + (cx0 === px ? 4 : -4), cy0 - 3);
      ctx.lineTo(cx0 + (cx0 === px ? 3 : -3), cy0 + (cy0 === py ? -6 : 6));
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillRect(px - 1.5, py - 4, 3, w + 8);
  }

  drawBuildingIcon(ctx, stats, faction, px, py, w);

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

// ---- projectiles & vfx ------------------------------------------------------------

function drawProjectiles(ctx, state, map, fow, camX, camY) {
  for (const p of state.projectiles) {
    const aVis = visibilityAt(fow, map, Math.floor(p.x1 / TILE), Math.floor(p.y1 / TILE)) === 2;
    const bVis = visibilityAt(fow, map, Math.floor(p.x2 / TILE), Math.floor(p.y2 / TILE)) === 2;
    if (!aVis && !bVis) continue;
    const t = Math.min(1, p.t / p.duration);
    const x = p.x1 + (p.x2 - p.x1) * t - camX;
    const y = p.y1 + (p.y2 - p.y1) * t - camY;
    const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const color = FACTIONS[p.side].accent;

    // faint trail behind the projectile
    const trailT = Math.max(0, t - 0.12);
    const tx = p.x1 + (p.x2 - p.x1) * trailT - camX;
    const ty = p.y1 + (p.y2 - p.y1) * trailT - camY;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 2.4);
    ctx.lineTo(-4, -2.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawVfx(ctx, state, camX, camY) {
  for (const v of state.vfx) {
    const t = v.t / v.duration;
    const x = v.x - camX;
    const y = v.y - camY;

    if (v.type === 'burst') {
      for (const p of v.particles) {
        const px = x + p.dx * t;
        const py = y + p.dy * t;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = v.color;
        ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    } else if (v.type === 'floatText') {
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(v.text, x + 1, y - t * 22 + 1);
      ctx.fillStyle = v.color;
      ctx.fillText(v.text, x, y - t * 22);
      ctx.globalAlpha = 1;
    } else if (v.type === 'dust') {
      for (let i = 0; i < v.puffs.length; i++) {
        const p = v.puffs[i];
        const px = x + p.dx * t;
        const py = y + p.dy * t;
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - t));
        ctx.fillStyle = '#c9bfa8';
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.6 + t), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (v.type === 'sparkle') {
      const scale = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      ctx.globalAlpha = Math.max(0, scale);
      ctx.fillStyle = v.color;
      ctx.save();
      ctx.translate(x, y - 6);
      ctx.rotate(t * 2);
      const s = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3);
      ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (v.type === 'impact') {
      const ringT = Math.min(1, t / 0.6);
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = '#fff7d6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 3 + ringT * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i + 0.4;
        const r1 = 2 + ringT * 4;
        const r2 = 2 + ringT * 11;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * r1, y + Math.sin(angle) * r1);
        ctx.lineTo(x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlacementGhost(ctx, state, map, camX, camY) {
  const placement = state.placement;
  if (!placement) return;
  const stats = BUILDING_DATA[placement.buildKey];
  const w = stats.size * TILE;
  const ok = footprintClear(state, map, placement.tx, placement.ty, stats.size);
  const pulse = 0.4 + 0.15 * Math.sin(state.time / 200);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = ok ? '#5ec95e' : '#d4453c';
  ctx.fillRect(placement.tx * TILE - camX, placement.ty * TILE - camY, w, w);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ok ? '#a8f0a8' : '#f0a8a8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(placement.tx * TILE - camX, placement.ty * TILE - camY, w, w);
}

// ---- main render --------------------------------------------------------------

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
        ctx.fillStyle = FOG_UNSEEN;
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      drawTile(ctx, map.tiles[ty][tx], tx, ty, px, py, vis, state.time);
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
  drawVfx(ctx, state, camX, camY);
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
  const MINI_COLORS = { grass: '#3a6a3d', forest: '#233f28', gold: '#8a7530', rubble: '#4c493f' };
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const vis = visibilityAt(fow, map, tx, ty);
      if (vis === 0) { ctx.fillStyle = FOG_UNSEEN; }
      else {
        const tile = map.tiles[ty][tx];
        ctx.fillStyle = MINI_COLORS[tile.type] || '#333';
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
    const mx = (e.x / TILE) * sx;
    const my = (e.y / TILE) * sy;
    const size = e.kind === 'building' ? 3.5 : 2;
    if (e.kind === 'building') {
      ctx.globalAlpha = dim ? 0.35 : 0.55;
      ctx.fillStyle = FACTIONS[e.side].color;
      ctx.beginPath();
      ctx.arc(mx, my, size + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = dim ? 0.5 : 1;
    ctx.fillStyle = FACTIONS[e.side].color;
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

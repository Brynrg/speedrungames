import { canBuildOnCell } from "./build.js";
import { COLS, HEIGHT, ROWS, TILE, WIDTH } from "./constants.js";
import { canvas, ctx } from "./dom.js";
import { clamp, inBounds, worldFromCell } from "./grid.js";
import { paintHalftoneFacet } from "./halftone.js";
import { getMazePreviewPoints } from "./maze.js";
import { DUEL_EXITS, DUEL_LANE_IDS, DUEL_SPAWNS, DUEL_WAYPOINTS, MAZE_EXIT, MAZE_START, WAYPOINTS } from "./paths.js";
import {
  BOARD_BOTTOM,
  BOARD_GRID_DARK,
  BOARD_GRID_LIGHT,
  BOARD_GRID_LINE,
  BOARD_TOP,
  CYAN_CHEVRON,
  FRIENDLY_WASH,
  GOLD,
  GOLD_BRIGHT,
  HOSTILE_ACCENT,
  INK,
  MEDAL_RIBBON,
  PATH_DASH,
  PATH_EDGE,
  PATH_TOP,
  PLINTH_SIDE,
  PLINTH_TOP,
  PORTAL_ENTRY,
  PORTAL_ENTRY_P2,
  PORTAL_EXIT,
  PORTAL_EXIT_P2,
  PROJECTILE_COLORS,
  STROKE_WEIGHT,
  TOWER_DETAIL_ZOOM,
} from "./palette.js";
import { game, getActivePlayerState, statusBanners } from "./state.js";
import { TOWER_DATA } from "./towers.js";

// Animated spawn/exit portal: pulsing core + rotating dashed ring. Purely
// visual — phase comes from wall-clock, never the sim. Recolored to the
// poster spot system (teal entry / vermillion exit) but the mechanic is
// unchanged.
function drawPortal(x, y, color, radius) {
  const t = performance.now() / 1000;
  const pulse = 0.82 + 0.18 * Math.sin(t * 2.6 + x * 0.01);

  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.1);
  glow.addColorStop(0, color + "55");
  glow.addColorStop(1, color + "00");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.52 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.52 * pulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([6, 7]);
  ctx.lineDashOffset = -((t * 26) % 13);
  ctx.beginPath();
  ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

// Soft teal "friendly territory" radial wash pooled at a safe zone — the one
// extra gradient the poster-flat palette allows itself (same exception the
// portal glow already uses).
function drawFriendlyWash(x, y, radius) {
  const wash = ctx.createRadialGradient(x, y, 0, x, y, radius);
  wash.addColorStop(0, FRIENDLY_WASH);
  wash.addColorStop(1, "rgba(66, 189, 173, 0)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function traceFrontLine(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

// Rust/blood-red dashed "front line": a dark warm-ink edge under a bright
// vermillion top stroke, with a marching cream dash on top reading as troop
// movement toward the exit. Shared by classic, maze, and duel routes.
function drawFrontLine(points, marchOffset = 0) {
  if (points.length < 2) {
    return;
  }
  traceFrontLine(points);
  ctx.strokeStyle = PATH_EDGE;
  ctx.lineWidth = 30;
  ctx.stroke();

  traceFrontLine(points);
  ctx.strokeStyle = PATH_TOP;
  ctx.lineWidth = 20;
  ctx.stroke();

  traceFrontLine(points);
  ctx.strokeStyle = PATH_DASH;
  ctx.lineWidth = 2.6;
  ctx.setLineDash([11, 15]);
  ctx.lineDashOffset = -((performance.now() / 42 + marchOffset) % 26);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

export function drawBoard() {
  // Deep indigo-navy, two-tone FLAT split (not a smooth gradient) — the
  // upper band reads as sky/haze over the war table, the lower band as the
  // table itself.
  ctx.fillStyle = BOARD_BOTTOM;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = BOARD_TOP;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.44);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? BOARD_GRID_LIGHT : BOARD_GRID_DARK;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.strokeStyle = BOARD_GRID_LINE;
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= COLS; gx += 1) {
    const px = gx * TILE + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy <= ROWS; gy += 1) {
    const py = gy * TILE + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(WIDTH, py);
    ctx.stroke();
  }

  // Friendly-territory teal wash near spawn/portal safe zones, painted under
  // the front line so it reads as ambient ground tint.
  if (game.mode === "duel") {
    for (let lane = 0; lane < DUEL_LANE_IDS.length; lane += 1) {
      const spawnPoint = worldFromCell(DUEL_SPAWNS[lane].cx, DUEL_SPAWNS[lane].cy);
      drawFriendlyWash(spawnPoint.x, spawnPoint.y, 130);
    }
  } else {
    const spawnPoint = worldFromCell(MAZE_START.cx, MAZE_START.cy);
    drawFriendlyWash(spawnPoint.x, spawnPoint.y, 150);
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (game.mode === "classic") {
    drawFrontLine(WAYPOINTS);
  } else if (game.mode === "maze") {
    const preview = getMazePreviewPoints();
    if (preview.length > 1) {
      drawFrontLine(preview);
    }
  } else {
    for (let lane = 0; lane < DUEL_WAYPOINTS.length; lane += 1) {
      drawFrontLine(DUEL_WAYPOINTS[lane], lane * 9);
    }

    ctx.strokeStyle = "rgba(230, 236, 220, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(HEIGHT / 2) + 0.5);
    ctx.lineTo(WIDTH, Math.floor(HEIGHT / 2) + 0.5);
    ctx.stroke();
  }

  if (game.mode === "duel") {
    for (let lane = 0; lane < DUEL_LANE_IDS.length; lane += 1) {
      const spawnPoint = worldFromCell(DUEL_SPAWNS[lane].cx, DUEL_SPAWNS[lane].cy);
      drawPortal(spawnPoint.x, spawnPoint.y, lane === 0 ? PORTAL_ENTRY : PORTAL_ENTRY_P2, 11);
      const exitPoint = worldFromCell(DUEL_EXITS[lane].cx, DUEL_EXITS[lane].cy);
      drawPortal(exitPoint.x, exitPoint.y, lane === 0 ? PORTAL_EXIT : PORTAL_EXIT_P2, 11);
    }
  } else {
    const spawnPoint = worldFromCell(MAZE_START.cx, MAZE_START.cy);
    drawPortal(spawnPoint.x, spawnPoint.y, PORTAL_ENTRY, 13);
    const exitPoint = worldFromCell(MAZE_EXIT.cx, MAZE_EXIT.cy);
    drawPortal(exitPoint.x, exitPoint.y, PORTAL_EXIT, 13);
  }

  if (game.hoverCell) {
    const { cx, cy } = game.hoverCell;
    if (inBounds(cx, cy)) {
      const center = worldFromCell(cx, cy);
      const canBuild = canBuildOnCell(cx, cy);
      const affordable = getActivePlayerState().gold >= TOWER_DATA[game.selectedType].cost;

      ctx.beginPath();
      ctx.arc(center.x, center.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = canBuild ? (affordable ? "rgba(63, 201, 180, 0.38)" : "rgba(225, 165, 33, 0.4)") : "rgba(226, 64, 42, 0.32)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = canBuild ? "rgba(214, 244, 236, 0.85)" : "rgba(240, 140, 120, 0.88)";
      ctx.stroke();
    }
  }
}

export function drawPolygon(cx, cy, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (Math.PI * 2 * i) / sides;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

// Alternating outer/inner radius star burst (Frost's snowflake silhouette).
function drawStarPolygon(cx, cy, outerR, innerR, points, rotation = 0) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rotation + i * step;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

// Trace a closed path from an array of [dx, dy] offsets relative to (x, y).
function tracePath(x, y, points) {
  ctx.beginPath();
  ctx.moveTo(x + points[0][0], y + points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(x + points[i][0], y + points[i][1]);
  }
  ctx.closePath();
}

export function getTowerAimAngle(tower) {
  const target = tower.acquireTarget();
  if (!target) {
    return -Math.PI / 2;
  }
  return Math.atan2(target.y - tower.y, target.x - tower.x);
}

// Cheap, always-on grounding: drop shadow + a small neutral-stone plinth
// with a thin family-color ring for identity insurance at extreme zoom-out.
// This is the whole tier-0 base pass — no stacked primitives.
export function drawTowerBasePad(tower) {
  const x = tower.x;
  const y = tower.y;
  const { color } = tower.data;

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 5, 17, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  drawPolygon(x, y + 2, 15, 8, Math.PI / 8);
  ctx.fillStyle = PLINTH_SIDE;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  drawPolygon(x, y, 12, 8, Math.PI / 8);
  ctx.fillStyle = PLINTH_TOP;
  ctx.fill();

  drawPolygon(x, y + 2, 15, 8, Math.PI / 8);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Thin rotating reticle — the one shared "aim" accent every tower type gets
// in its tier-1 detail pass, so branch-level rotation feedback survives the
// move to static iconographic silhouettes.
function drawAimAccent(tower, len = 11) {
  const aim = getTowerAimAngle(tower);
  ctx.save();
  ctx.translate(tower.x, tower.y - 3);
  ctx.rotate(aim);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(len, -2.2);
  ctx.lineTo(len + 3.5, 0);
  ctx.lineTo(len, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Arrow = crossbow-bolt fan: a fishtail-based arrowhead.
export function drawArrowTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  tracePath(x, y, [
    [0, -19],
    [13, -2],
    [5, -3],
    [7, 8],
    [0, 2],
    [-7, 8],
    [-5, -3],
    [-13, -2],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 2);
    ctx.lineTo(x, y - 15);
    ctx.lineTo(x + 4, y - 2);
    ctx.stroke();
    drawAimAccent(tower, 12);
  }
}

// Frost = snowflake-star burst.
export function drawFrostTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  drawStarPolygon(x, y - 2, 15, 6.5, 6, -Math.PI / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    const pulse = 0.75 + Math.sin(performance.now() * 0.005) * 0.25;
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x + Math.cos(a) * 13, y - 2 + Math.sin(a) * 13);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Cannon = fortress-block hex.
export function drawCannonTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  drawPolygon(x, y + 1, 14, 6, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    // Crenellation notches on the top edge.
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x - 5, y - 8);
    ctx.moveTo(x - 1.5, y - 8);
    ctx.lineTo(x + 1.5, y - 8);
    ctx.moveTo(x + 5, y - 8);
    ctx.lineTo(x + 8, y - 8);
    ctx.stroke();
    // Rivet dots at the plate corners.
    ctx.fillStyle = core;
    for (const [dx, dy] of [
      [-9, 3],
      [9, 3],
      [-9, -3],
      [9, -3],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    drawAimAccent(tower, 12);
  }
}

// Arcane = eye-in-triangle. The eye outline is part of the always-on base
// read (it IS the icon); the glowing pulse + pupil are tier-1 detail.
export function drawArcaneTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  tracePath(x, y, [
    [0, -18],
    [11, 7],
    [-11, 7],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y - 3, 4.4, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  if (detail) {
    const pulse = 0.7 + Math.sin(performance.now() * 0.006) * 0.3;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    drawAimAccent(tower, 12);
  }
}

// Venom = fanged-vial/drip — bespoke bulbous flask silhouette with flared
// "fang" shoulders.
export function drawVenomTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  tracePath(x, y, [
    [-3, -17],
    [3, -17],
    [5, -13],
    [3, -8],
    [9, 2],
    [0, 9],
    [-9, 2],
    [-3, -8],
    [-5, -13],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    ctx.fillStyle = `rgba(200, 244, 150, 0.75)`;
    ctx.beginPath();
    ctx.arc(x, y + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x - 1.6, y + 14);
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x + 1.6, y + 14);
    ctx.stroke();
    drawAimAccent(tower, 11);
  }
}

// Mortar = squat barrel-drum with a stubby raised muzzle nub.
export function drawMortarTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  tracePath(x, y, [
    [-11, 9],
    [-11, 1],
    [-9, -3],
    [-4, -6],
    [-4, -15],
    [4, -15],
    [4, -6],
    [9, -3],
    [11, 1],
    [11, 9],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    ctx.fillStyle = core;
    ctx.fillRect(x - 3, y - 14, 6, 2.4);
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 5);
    ctx.lineTo(x + 9, y + 5);
    ctx.stroke();
    drawAimAccent(tower, 10);
  }
}

// Obelisk = spire — a tall, narrow monolith.
export function drawObeliskTowerModel(tower, detail) {
  const x = tower.x;
  const y = tower.y;
  const { color, core } = tower.data;

  tracePath(x, y, [
    [0, -20],
    [4, -9],
    [4, 8],
    [-4, 8],
    [-4, -9],
  ]);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  if (detail) {
    const pulse = 0.7 + Math.sin(performance.now() * 0.005) * 0.3;
    ctx.strokeStyle = core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.65 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y - 4, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Interior "type-code" stencil — a tiny poster-plate ID stamped on the
// plinth, only worth the text-metrics cost once zoomed in.
function drawTypeCode(tower) {
  ctx.fillStyle = "rgba(232, 220, 184, 0.9)";
  ctx.font = "700 6px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tower.data.code || "", tower.x, tower.y + 16);
}

export function drawTowerRankAndBranch(tower) {
  // Level pips on a dark backing bar so they stay readable over any terrain.
  const pipW = 4;
  const pipGap = 1.6;
  const totalW = tower.level * pipW + (tower.level - 1) * pipGap;
  ctx.fillStyle = "rgba(20, 14, 10, 0.78)";
  ctx.fillRect(tower.x - totalW / 2 - 1.5, tower.y + 19.5, totalW + 3, 6.5);
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = tower.level >= 6 ? GOLD_BRIGHT : GOLD;
    ctx.fillRect(tower.x - totalW / 2 + i * (pipW + pipGap), tower.y + 21, pipW, 3.6);
  }

  // Branch marker: A = gold chevron up, B = cyan chevron down.
  if (tower.branchData) {
    const up = tower.branch === "a";
    ctx.fillStyle = up ? GOLD_BRIGHT : CYAN_CHEVRON;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(tower.x, tower.y - 26);
      ctx.lineTo(tower.x + 5.5, tower.y - 18);
      ctx.lineTo(tower.x - 5.5, tower.y - 18);
    } else {
      ctx.moveTo(tower.x, tower.y - 18);
      ctx.lineTo(tower.x + 5.5, tower.y - 26);
      ctx.lineTo(tower.x - 5.5, tower.y - 26);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Hero moment: max-tier towers get a monument/medal treatment — a small
  // laurel sprig curling up each side of the plinth plus a ribboned medal
  // disc under the pip bar. Cheap (a few strokes), always drawn — the
  // "maxed" badge is gameplay-relevant at any zoom.
  if (tower.level >= 6) {
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(tower.x + side * 13, tower.y + 12);
      ctx.quadraticCurveTo(tower.x + side * 19, tower.y + 6, tower.x + side * 14, tower.y - 1);
      ctx.stroke();
      for (const t of [0.3, 0.62, 0.9]) {
        const lx = tower.x + side * (13 + t * 6);
        const ly = tower.y + 12 - t * 13;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 2.1, 1, side * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = GOLD_BRIGHT;
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(tower.x, tower.y + 28.5, 4, 0, Math.PI * 2);
    ctx.fillStyle = MEDAL_RIBBON;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tower.x, tower.y + 28.5, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = GOLD_BRIGHT;
    ctx.fill();
  }
}

const TOWER_MODEL_DRAWERS = {
  arrow: drawArrowTowerModel,
  frost: drawFrostTowerModel,
  cannon: drawCannonTowerModel,
  arcane: drawArcaneTowerModel,
  mortar: drawMortarTowerModel,
  obelisk: drawObeliskTowerModel,
  venom: drawVenomTowerModel,
};

// LOD graft: below TOWER_DETAIL_ZOOM draw ONLY the outer silhouette
// fill+stroke (cheap, reads at any zoom); above it add the thin interior
// detail second pass (rivets/panel-seams/aim reticle/type code).
export function drawTower(tower, zoom = TOWER_DETAIL_ZOOM) {
  const detail = zoom >= TOWER_DETAIL_ZOOM;

  drawTowerBasePad(tower);

  const drawModel = TOWER_MODEL_DRAWERS[tower.type] || drawArrowTowerModel;
  drawModel(tower, detail);

  if (detail) {
    drawTypeCode(tower);
  }

  drawTowerRankAndBranch(tower);

  if (game.duelMode) {
    ctx.strokeStyle = tower.owner === 0 ? "rgba(63, 201, 180, 0.6)" : "rgba(124, 168, 220, 0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (tower.hasAura()) {
    const aura = tower.branchData.aura || tower.branchData.auraSlow;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, aura.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232, 220, 184, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (game.selectedTower === tower) {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.effectiveRange, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(225, 197, 110, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 220, 184, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawPolygon(tower.x, tower.y, 21, 8, Math.PI / 8);
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// Cheap heading estimate from routing state — used only for the per-family
// accent shapes (torn trailing edge / wing-slash), never for movement.
function getEnemyHeadingAngle(enemy) {
  if (enemy.routeMode === "maze-ground") {
    if (enemy.mazeTargetX !== null && enemy.mazeTargetY !== null) {
      return Math.atan2(enemy.mazeTargetY - enemy.y, enemy.mazeTargetX - enemy.x);
    }
    return 0;
  }
  const to = enemy.routePoints?.[Math.min(enemy.pathIndex + 1, (enemy.routePoints?.length || 1) - 1)];
  if (!to) {
    return 0;
  }
  return Math.atan2(to.y - enemy.y, to.x - enemy.x);
}

// Trailhead Press graft: one cheap accent shape per family, layered on top
// of the flat fill — never a full second silhouette pass.
function drawEnemyFamilyAccent(enemy) {
  const r = enemy.radius;

  if (enemy.splitter) {
    // Crack-line: a jagged fault across the body telegraphing "will split".
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(enemy.x - r * 0.6, enemy.y - r * 0.5);
    ctx.lineTo(enemy.x - r * 0.1, enemy.y - r * 0.05);
    ctx.lineTo(enemy.x + r * 0.25, enemy.y - r * 0.35);
    ctx.lineTo(enemy.x + r * 0.6, enemy.y + r * 0.5);
    ctx.stroke();
    return;
  }

  if (enemy.flying) {
    // Wing-slash chevrons flanking the body.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(enemy.x - r - 6, enemy.y - 3);
    ctx.lineTo(enemy.x - r + 1, enemy.y);
    ctx.lineTo(enemy.x - r - 6, enemy.y + 3);
    ctx.moveTo(enemy.x + r + 6, enemy.y - 3);
    ctx.lineTo(enemy.x + r - 1, enemy.y);
    ctx.lineTo(enemy.x + r + 6, enemy.y + 3);
    ctx.stroke();
    return;
  }

  if (enemy.armorType === "light") {
    // Torn trailing edge — a ragged little tail streaming opposite heading.
    const heading = getEnemyHeadingAngle(enemy);
    const back = heading + Math.PI;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(back);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.35);
    ctx.lineTo(r * 0.9, -r * 0.12);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(r * 0.9, r * 0.12);
    ctx.lineTo(r * 0.5, r * 0.35);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawEnemy(enemy, zoom = 0) {
  const r = enemy.radius;

  // Family silhouettes: shape carries the threat type before color does.
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  if (enemy.isBoss) {
    drawPolygon(enemy.x, enemy.y, r + 2, 6, Math.PI / 6);
  } else if (enemy.flying) {
    // ground shadow + diamond body
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(enemy.x + 3, enemy.y + r + 7, r * 0.9, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y - r - 2);
    ctx.lineTo(enemy.x + r, enemy.y);
    ctx.lineTo(enemy.x, enemy.y + r);
    ctx.lineTo(enemy.x - r, enemy.y);
    ctx.closePath();
  } else if (enemy.splitter) {
    // clustered blob: main body + two lobes that read as "it will split"
    ctx.arc(enemy.x, enemy.y, r * 0.86, 0, Math.PI * 2);
    ctx.moveTo(enemy.x - r * 0.7 + r * 0.55, enemy.y - r * 0.55);
    ctx.arc(enemy.x - r * 0.7, enemy.y - r * 0.55, r * 0.55, 0, Math.PI * 2);
    ctx.moveTo(enemy.x + r * 0.75 + r * 0.5, enemy.y + r * 0.45);
    ctx.arc(enemy.x + r * 0.75, enemy.y + r * 0.45, r * 0.5, 0, Math.PI * 2);
  } else if (enemy.magicImmune) {
    drawPolygon(enemy.x, enemy.y, r + 1, 6, 0);
  } else if (enemy.armorType === "heavy" || enemy.armorType === "fortified") {
    // angular plated body
    drawPolygon(enemy.x, enemy.y, r + 1, 4, Math.PI / 4);
  } else {
    ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
  }
  ctx.fill();

  // Uniform ink outline — the same stroke weight used on towers and UI.
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE_WEIGHT;
  ctx.stroke();

  // ONE halftone-shaded facet for directional form, picked by discrete zoom
  // tier — never a per-entity dot grid, never full-body.
  paintHalftoneFacet(ctx, enemy.x, enemy.y, r, zoom);

  // Universal hostile accent (grafted): a small hot-red rim-light, the same
  // family-agnostic "this is an enemy" tell on every unit.
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, r + 0.6, -2.55, -1.55);
  ctx.strokeStyle = HOSTILE_ACCENT;
  ctx.lineWidth = 1.7;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawEnemyFamilyAccent(enemy);

  if (enemy.isBoss) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(225, 197, 110, 0.55)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  if (enemy.slowTimer > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(95, 208, 218, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (enemy.burnTimer > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(226, 64, 42, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const barW = enemy.isBoss ? 46 : 30;
  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = "rgba(24, 17, 12, 0.88)";
  ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 14, barW, 5.2);

  ctx.fillStyle = enemy.isBoss ? GOLD : enemy.flying ? "#5fd0da" : "#8fc31f";
  ctx.fillRect(enemy.x - barW / 2 + 0.8, enemy.y - enemy.radius - 13.1, (barW - 1.6) * hpRatio, 3.4);

  const statusBadges = [];
  if (enemy.slowTimer > 0 || enemy.auraSlowFactor < 0.999) {
    statusBadges.push({ text: "S", color: "#5fd0da" });
  }
  if (enemy.burnTimer > 0) {
    statusBadges.push({ text: "B", color: HOSTILE_ACCENT });
  }
  if (enemy.magicImmune) {
    statusBadges.push({ text: "M", color: "#b79bf2" });
  }
  if (enemy.isBoss) {
    statusBadges.push({ text: "K", color: GOLD });
  }
  for (let i = 0; i < statusBadges.length; i += 1) {
    const badge = statusBadges[i];
    const bx = enemy.x - barW / 2 + i * 10;
    const by = enemy.y - enemy.radius - 22;
    ctx.fillStyle = "rgba(24, 17, 12, 0.86)";
    ctx.fillRect(bx, by, 9, 9);
    ctx.strokeStyle = "rgba(232, 220, 184, 0.4)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx + 0.4, by + 0.4, 8.2, 8.2);
    ctx.fillStyle = badge.color;
    ctx.font = "700 8px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(badge.text, bx + 4.5, by + 7);
  }

  if (game.hoverEnemy === enemy) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#f4ead0";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

export function drawProjectile(projectile) {
  ctx.fillStyle = PROJECTILE_COLORS[projectile.damageType] || PROJECTILE_COLORS.siege;

  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

export function drawAreaEffect(effect) {
  const t = effect.life / effect.duration;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
  ctx.fillStyle = effect.color.replace("0.34", `${0.34 * (1 - t)}`);
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 220, 184, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawEffect(effect) {
  const t = effect.life / effect.maxLife;
  if (effect.kind === "explosion") {
    const radius = effect.meta.radius || 18;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * t, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226, 64, 42, ${0.4 * (1 - t)})`;
    ctx.fill();
    return;
  }

  if (effect.kind === "ring") {
    const radius = effect.meta.radius || 20;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * Math.min(1, 0.2 + t), 0, Math.PI * 2);
    ctx.strokeStyle = effect.meta.color || `rgba(225, 197, 110, ${0.42 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  if (effect.kind === "text") {
    ctx.fillStyle = effect.meta.color || GOLD_BRIGHT;
    ctx.font = "700 13px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(effect.meta.text || "", effect.x, effect.y);
    return;
  }

  if (effect.kind === "muzzle") {
    // short-lived flash cone in the firing direction
    const a = effect.meta.angle || 0;
    const len = 10 * (1 - t) + 4;
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(255, 235, 190, ${0.75 * (1 - t)})`;
    ctx.beginPath();
    ctx.moveTo(0, -2.4);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (effect.kind === "kill") {
    // radial sparks + fading core, all derived from t (no extra objects)
    const seed = (effect.x * 7 + effect.y * 13) % 6.28;
    ctx.strokeStyle = `rgba(225, 197, 110, ${0.7 * (1 - t)})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i += 1) {
      const a = seed + (i / 5) * Math.PI * 2;
      const d1 = 3 + 11 * t;
      const d2 = d1 + 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(a) * d1, effect.y + Math.sin(a) * d1);
      ctx.lineTo(effect.x + Math.cos(a) * d2, effect.y + Math.sin(a) * d2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 5 * (1 - t) + 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 232, 170, ${0.6 * (1 - t)})`;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 6 * t + 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(232, 220, 184, ${0.35 * (1 - t)})`;
  ctx.fill();
}

export function drawOverlay() {
  const viewW = canvas.width;
  const viewH = canvas.height;
  if (statusBanners.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "700 14px Rajdhani, sans-serif";
    for (let i = 0; i < statusBanners.length; i += 1) {
      const banner = statusBanners[i];
      const alpha = clamp(banner.life / 3.2, 0, 1);
      const y = 44 + i * 22;
      ctx.fillStyle = `rgba(232, 220, 184, ${0.92 * alpha})`;
      ctx.fillRect(viewW / 2 - 220, y - 13, 440, 18);
      ctx.strokeStyle = `rgba(36, 24, 17, ${0.7 * alpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(viewW / 2 - 220, y - 13, 440, 18);
      ctx.fillStyle = `rgba(36, 24, 17, ${0.96 * alpha})`;
      ctx.fillText(banner.text, viewW / 2, y);
    }
  }

  if (game.paused && !game.gameOver) {
    ctx.fillStyle = "rgba(16, 26, 48, 0.5)";
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.fillStyle = "#e8dcb8";
    ctx.font = "700 44px Cinzel, serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", viewW / 2, viewH / 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeText("PAUSED", viewW / 2, viewH / 2);
  }

  if (!game.gameOver) {
    return;
  }

  // Dim the board; the #defeatOverlay modal carries the title, stats, and actions.
  ctx.fillStyle = "rgba(16, 26, 48, 0.68)";
  ctx.fillRect(0, 0, viewW, viewH);
}

export function updateStatusBanners(dt) {
  for (let i = statusBanners.length - 1; i >= 0; i -= 1) {
    statusBanners[i].life -= dt;
    if (statusBanners[i].life <= 0) {
      statusBanners.splice(i, 1);
    }
  }
}

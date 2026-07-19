import { camera, clampCamera } from "./camera.js";
import { HEIGHT, WIDTH } from "./constants.js";
import { canvas, miniMapCtx, miniMapEl } from "./dom.js";
import { clamp } from "./grid.js";
import { getMazePreviewPoints } from "./maze.js";
import { GOLD_BRIGHT, HOSTILE_ACCENT, PORTAL_ENTRY } from "./palette.js";
import { DUEL_WAYPOINTS, WAYPOINTS } from "./paths.js";
import { enemies, game, towers } from "./state.js";
import { setTooltip } from "./tooltip.js";

export function resizeMiniMapCanvas() {
  if (!miniMapEl || !miniMapCtx) {
    return;
  }
  const rect = miniMapEl.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(120, Math.round(rect.width * dpr));
  const nextHeight = Math.max(90, Math.round(rect.height * dpr));
  if (miniMapEl.width !== nextWidth || miniMapEl.height !== nextHeight) {
    miniMapEl.width = nextWidth;
    miniMapEl.height = nextHeight;
  }
}

export function drawMiniMapPolyline(points, color, width = 2) {
  if (!miniMapCtx || points.length < 2) {
    return;
  }
  miniMapCtx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const px = (points[i].x / WIDTH) * miniMapEl.width;
    const py = (points[i].y / HEIGHT) * miniMapEl.height;
    if (i === 0) {
      miniMapCtx.moveTo(px, py);
    } else {
      miniMapCtx.lineTo(px, py);
    }
  }
  miniMapCtx.strokeStyle = color;
  miniMapCtx.lineWidth = width;
  miniMapCtx.stroke();
}

export function drawMiniMap() {
  if (!miniMapEl || !miniMapCtx) {
    return;
  }
  resizeMiniMapCanvas();
  const w = miniMapEl.width;
  const h = miniMapEl.height;

  miniMapCtx.clearRect(0, 0, w, h);
  miniMapCtx.fillStyle = "#101a30";
  miniMapCtx.fillRect(0, 0, w, h);

  const gridStepX = w / 8;
  const gridStepY = h / 8;
  miniMapCtx.strokeStyle = "rgba(120, 146, 196, 0.22)";
  miniMapCtx.lineWidth = 1;
  for (let gx = 1; gx < 8; gx += 1) {
    const x = Math.round(gx * gridStepX) + 0.5;
    miniMapCtx.beginPath();
    miniMapCtx.moveTo(x, 0);
    miniMapCtx.lineTo(x, h);
    miniMapCtx.stroke();
  }
  for (let gy = 1; gy < 8; gy += 1) {
    const y = Math.round(gy * gridStepY) + 0.5;
    miniMapCtx.beginPath();
    miniMapCtx.moveTo(0, y);
    miniMapCtx.lineTo(w, y);
    miniMapCtx.stroke();
  }

  if (game.mode === "duel") {
    drawMiniMapPolyline(DUEL_WAYPOINTS[0], "rgba(178, 58, 44, 0.85)", 2.2);
    drawMiniMapPolyline(DUEL_WAYPOINTS[1], "rgba(178, 58, 44, 0.65)", 2.2);
  } else if (game.mode === "maze") {
    const mazePoints = getMazePreviewPoints();
    if (mazePoints.length > 1) {
      drawMiniMapPolyline(mazePoints, "rgba(178, 58, 44, 0.85)", 2.2);
    } else {
      drawMiniMapPolyline(WAYPOINTS, "rgba(178, 58, 44, 0.65)", 2);
    }
  } else {
    drawMiniMapPolyline(WAYPOINTS, "rgba(178, 58, 44, 0.85)", 2.2);
  }

  for (const tower of towers) {
    const tx = (tower.x / WIDTH) * w;
    const ty = (tower.y / HEIGHT) * h;
    miniMapCtx.fillStyle = tower.owner === 1 ? "#7c5cc9" : GOLD_BRIGHT;
    miniMapCtx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
  }

  for (const enemy of enemies) {
    const ex = (enemy.x / WIDTH) * w;
    const ey = (enemy.y / HEIGHT) * h;
    miniMapCtx.fillStyle = HOSTILE_ACCENT;
    miniMapCtx.beginPath();
    miniMapCtx.arc(ex, ey, enemy.isBoss ? 2.4 : 1.7, 0, Math.PI * 2);
    miniMapCtx.fill();
  }

  const viewWorldW = canvas.width / camera.zoom;
  const viewWorldH = canvas.height / camera.zoom;
  const vx = ((camera.x - viewWorldW / 2) / WIDTH) * w;
  const vy = ((camera.y - viewWorldH / 2) / HEIGHT) * h;
  const vw = (viewWorldW / WIDTH) * w;
  const vh = (viewWorldH / HEIGHT) * h;
  miniMapCtx.strokeStyle = PORTAL_ENTRY;
  miniMapCtx.lineWidth = 1.4;
  miniMapCtx.strokeRect(vx, vy, vw, vh);
}

export function handleMiniMapPointer(event) {
  if (!miniMapEl || !miniMapCtx) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const rect = miniMapEl.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  camera.x = nx * WIDTH;
  camera.y = ny * HEIGHT;
  clampCamera();
  setTooltip("Camera centered from minimap.");
  event.preventDefault();
}


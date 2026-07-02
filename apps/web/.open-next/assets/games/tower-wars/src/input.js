import { ensureAudioActive } from "./audio.js";
import { tryBuildTower } from "./build.js";
import { camera, clampCamera, getScreenPos, keyState, panState, screenToWorld } from "./camera.js";
import { CAMERA_KEY_PAN_SPEED } from "./constants.js";
import { describeEnemy, describeTower } from "./describe.js";
import { canvas } from "./dom.js";
import { clamp, getCellAt, inBounds } from "./grid.js";
import { getEnemyAtPoint, getTowerAtPoint } from "./picking.js";
import { game } from "./state.js";
import { status } from "./status.js";
import { defaultTooltip, setCommandTab, setTooltip } from "./tooltip.js";

export function handleBoardClick(event) {
  ensureAudioActive();

  if (game.gameOver) {
    return;
  }
  if (event.altKey) {
    return;
  }
  if (panState.moved) {
    panState.moved = false;
    return;
  }

  const screen = getScreenPos(event);
  const pos = screenToWorld(screen.x, screen.y);

  const clickedTower = getTowerAtPoint(pos.x, pos.y);
  if (clickedTower) {
    if (game.duelMode && clickedTower.owner !== game.activePlayer) {
      status(`That tower belongs to P${clickedTower.owner + 1}. Switch active player to control it.`);
      game.selectedTower = null;
      return;
    }
    game.selectedTower = clickedTower;
    setCommandTab("selection");
    status(`${clickedTower.data.name} selected.`);
    return;
  }

  game.selectedTower = null;

  const { cx, cy } = getCellAt(pos.x, pos.y);
  if (!inBounds(cx, cy)) {
    return;
  }

  tryBuildTower(cx, cy);
}

export function handleCanvasMove(event) {
  const screen = getScreenPos(event);
  if (panState.active) {
    const dx = screen.x - panState.lastScreenX;
    const dy = screen.y - panState.lastScreenY;
    panState.lastScreenX = screen.x;
    panState.lastScreenY = screen.y;

    if (Math.abs(dx) + Math.abs(dy) > 1.5) {
      panState.moved = true;
    }

    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    clampCamera();
    game.hoverEnemy = null;
    game.hoverCell = null;
    setTooltip("Panning map.");
    return;
  }

  const pos = screenToWorld(screen.x, screen.y);
  const { cx, cy } = getCellAt(pos.x, pos.y);
  game.hoverCell = inBounds(cx, cy) ? { cx, cy } : null;

  const enemy = getEnemyAtPoint(pos.x, pos.y);
  game.hoverEnemy = enemy;
  if (enemy) {
    setTooltip(describeEnemy(enemy));
    return;
  }

  const tower = getTowerAtPoint(pos.x, pos.y);
  if (tower) {
    setTooltip(describeTower(tower));
    return;
  }

  setTooltip(defaultTooltip());
}

export function updateCameraFromKeys(dt) {
  let dx = 0;
  let dy = 0;
  if (keyState.left) {
    dx -= 1;
  }
  if (keyState.right) {
    dx += 1;
  }
  if (keyState.up) {
    dy -= 1;
  }
  if (keyState.down) {
    dy += 1;
  }
  if (dx === 0 && dy === 0) {
    return;
  }

  const len = Math.hypot(dx, dy) || 1;
  camera.x += (dx / len) * CAMERA_KEY_PAN_SPEED * dt;
  camera.y += (dy / len) * CAMERA_KEY_PAN_SPEED * dt;
  clampCamera();
}

export function handleCanvasMouseDown(event) {
  if (!(event.button === 1 || event.button === 2 || (event.button === 0 && event.altKey))) {
    return;
  }
  event.preventDefault();
  const screen = getScreenPos(event);
  panState.active = true;
  panState.moved = false;
  panState.lastScreenX = screen.x;
  panState.lastScreenY = screen.y;
  canvas.style.cursor = "grabbing";
}

export function handleCanvasMouseUp() {
  if (!panState.active) {
    return;
  }
  panState.active = false;
  canvas.style.cursor = "default";
}

export function handleCanvasWheel(event) {
  if (event.currentTarget !== canvas || event.target !== canvas) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const insideCanvas =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!insideCanvas) {
    return;
  }

  if (event.shiftKey) {
    const panDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    camera.x += (panDelta * 0.8) / camera.zoom;
    clampCamera();
    event.preventDefault();
    return;
  }

  const screen = getScreenPos(event);
  const worldBefore = screenToWorld(screen.x, screen.y);
  const zoomFactor = Math.exp(-event.deltaY * 0.0012);
  camera.zoom = clamp(camera.zoom * zoomFactor, camera.minZoom, camera.maxZoom);
  const worldAfter = screenToWorld(screen.x, screen.y);
  camera.x += worldBefore.x - worldAfter.x;
  camera.y += worldBefore.y - worldAfter.y;
  clampCamera();
  event.preventDefault();
}

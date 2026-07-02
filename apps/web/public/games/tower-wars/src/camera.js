import { HEIGHT, WIDTH } from "./constants.js";
import { canvas, ctx } from "./dom.js";
import { clamp } from "./grid.js";

// Cover-fit: fills the viewport (crops one axis). The default zoom.
export function getFitZoom() {
  return Math.max(canvas.width / WIDTH, canvas.height / HEIGHT);
}

// Contain-fit: whole board visible (letterboxed). The minimum zoom.
export function getContainZoom() {
  return Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
}

export const camera = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  zoom: getFitZoom(),
  minZoom: getFitZoom(),
  maxZoom: 5,
};
export const keyState = {
  left: false,
  right: false,
  up: false,
  down: false,
};
export const panState = {
  active: false,
  lastScreenX: 0,
  lastScreenY: 0,
  moved: false,
};

export function clampCamera() {
  camera.minZoom = getContainZoom();
  camera.maxZoom = Math.max(2.8, getFitZoom() * 2.1);
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
  const halfW = canvas.width / (2 * camera.zoom);
  const halfH = canvas.height / (2 * camera.zoom);

  if (halfW >= WIDTH / 2) {
    camera.x = WIDTH / 2;
  } else {
    camera.x = clamp(camera.x, halfW, WIDTH - halfW);
  }

  if (halfH >= HEIGHT / 2) {
    camera.y = HEIGHT / 2;
  } else {
    camera.y = clamp(camera.y, halfH, HEIGHT - halfH);
  }
}

export function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - canvas.width / 2) / camera.zoom + camera.x,
    y: (screenY - canvas.height / 2) / camera.zoom + camera.y,
  };
}

export function applyCameraTransform() {
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

export function getScreenPos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

// Measure the fixed HUD/panels and publish their edges as CSS vars. The panels
// dock: .game-wrap sits BETWEEN them (via --board-*), so no gameplay is ever
// underneath UI. Collapsing a panel re-runs this and widens the board.
export function syncLayoutOffsets() {
  const root = document.documentElement.style;
  const hudBar = document.querySelector(".hud-bar");
  if (hudBar) {
    const bottom = Math.ceil(hudBar.getBoundingClientRect().bottom + 10);
    root.setProperty("--panel-top", `${bottom}px`);
    root.setProperty("--board-top", `${bottom}px`);
  }
  const right = document.querySelector(".panel");
  if (window.matchMedia("(max-width: 920px)").matches) {
    // Mobile: full-width board on top, the command card is a bottom sheet.
    root.setProperty("--board-left", "0px");
    root.setProperty("--board-right", "0px");
    if (right) {
      const sheetTop = right.getBoundingClientRect().top;
      root.setProperty("--board-bottom", `${Math.max(0, Math.ceil(window.innerHeight - sheetTop + 6))}px`);
    }
    return;
  }
  root.setProperty("--board-bottom", "0px");
  const left = document.querySelector(".utility-panel");
  if (left) {
    root.setProperty("--board-left", `${Math.ceil(left.getBoundingClientRect().right + 8)}px`);
  }
  if (right) {
    root.setProperty("--board-right", `${Math.ceil(window.innerWidth - right.getBoundingClientRect().left + 8)}px`);
  }
}

export function resizeCanvasToViewport() {
  syncLayoutOffsets();
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(320, Math.round(rect.width * dpr));
  const nextHeight = Math.max(240, Math.round(rect.height * dpr));
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  camera.zoom = clamp(camera.zoom, getContainZoom(), camera.maxZoom);
  clampCamera();
}


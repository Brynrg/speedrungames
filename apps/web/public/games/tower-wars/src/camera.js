import { HEIGHT, WIDTH } from "./constants.js";
import { canvas, ctx } from "./dom.js";
import { clamp } from "./grid.js";

export function getFitZoom() {
  return Math.max(canvas.width / WIDTH, canvas.height / HEIGHT);
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
  camera.minZoom = Math.max(canvas.width / WIDTH, canvas.height / HEIGHT);
  camera.maxZoom = Math.max(2.8, camera.minZoom * 2.1);
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

export function resizeCanvasToViewport() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(320, Math.round(rect.width * dpr));
  const nextHeight = Math.max(240, Math.round(rect.height * dpr));
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  camera.minZoom = getFitZoom();
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
  clampCamera();
}


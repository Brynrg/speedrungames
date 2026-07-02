import { camera, clampCamera, getScreenPos, screenToWorld } from "./camera.js";
import { canvas } from "./dom.js";
import { clamp } from "./grid.js";
import { handleBoardClick } from "./input.js";

// Touch input (pointer events, pointerType === "touch" only — the mouse path in
// input.js is untouched): tap = board click (build/select), one-finger drag =
// pan, two-finger pinch = zoom anchored on the pinch midpoint. preventDefault
// on pointerdown suppresses the browser's compatibility mouse events, so taps
// don't double-fire through the mouse handlers.

const touchPoints = new Map(); // pointerId -> {x, y} canvas coords
let tapCandidate = null; // {id, clientX, clientY, moved}
let lastPinchDist = 0;
let lastMid = null;

const TAP_SLOP = 12; // canvas px of movement before a tap becomes a pan

function midpoint() {
  const pts = [...touchPoints.values()];
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

function pinchDist() {
  const pts = [...touchPoints.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
}

function onPointerDown(event) {
  if (event.pointerType !== "touch") {
    return;
  }
  event.preventDefault();
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // some devices throw on capture — panning still works without it
  }
  const pos = getScreenPos(event);
  touchPoints.set(event.pointerId, pos);

  if (touchPoints.size === 1) {
    tapCandidate = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, moved: false };
  } else {
    tapCandidate = null; // second finger: it's a pinch, never a tap
    if (touchPoints.size === 2) {
      lastPinchDist = pinchDist();
      lastMid = midpoint();
    }
  }
}

function onPointerMove(event) {
  if (event.pointerType !== "touch" || !touchPoints.has(event.pointerId)) {
    return;
  }
  event.preventDefault();
  const prev = touchPoints.get(event.pointerId);
  const pos = getScreenPos(event);
  touchPoints.set(event.pointerId, pos);

  if (touchPoints.size === 1) {
    const dx = pos.x - prev.x;
    const dy = pos.y - prev.y;
    if (tapCandidate && Math.hypot(pos.x - prev.x, pos.y - prev.y) >= 0) {
      // accumulate slop against the tap's start via total movement per event
      if (Math.abs(dx) + Math.abs(dy) > 1 && Math.hypot(dx, dy) > 0) {
        tapCandidate.dist = (tapCandidate.dist || 0) + Math.hypot(dx, dy);
        if (tapCandidate.dist > TAP_SLOP) {
          tapCandidate.moved = true;
        }
      }
    }
    if (tapCandidate && !tapCandidate.moved) {
      return; // still a potential tap — don't pan yet
    }
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    clampCamera();
    return;
  }

  if (touchPoints.size === 2) {
    const dist = pinchDist();
    const mid = midpoint();
    // zoom anchored on the midpoint
    const before = screenToWorld(mid.x, mid.y);
    camera.zoom = clamp((camera.zoom * dist) / (lastPinchDist || dist), camera.minZoom, camera.maxZoom);
    clampCamera();
    const after = screenToWorld(mid.x, mid.y);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    // two-finger pan by midpoint delta
    if (lastMid) {
      camera.x -= (mid.x - lastMid.x) / camera.zoom;
      camera.y -= (mid.y - lastMid.y) / camera.zoom;
    }
    clampCamera();
    lastPinchDist = dist;
    lastMid = mid;
  }
}

function onPointerEnd(event) {
  if (event.pointerType !== "touch") {
    return;
  }
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) {
    lastPinchDist = 0;
    lastMid = null;
  }
  if (tapCandidate && tapCandidate.id === event.pointerId) {
    const tap = tapCandidate;
    tapCandidate = null;
    if (!tap.moved && event.type === "pointerup") {
      handleBoardClick({ clientX: tap.clientX, clientY: tap.clientY, altKey: false });
    }
  }
}

export function bindTouchInput() {
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerEnd);
  canvas.addEventListener("pointercancel", onPointerEnd);
}

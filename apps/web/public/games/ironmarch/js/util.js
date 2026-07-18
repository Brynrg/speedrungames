export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

let uidCounter = 1;
export function nextUid() {
  return uidCounter++;
}

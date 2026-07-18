import { randRange } from './util.js';

// Transient, presentation-only effects. Game logic (combat.js, economy.js)
// calls the spawn* functions at the moment something happens; render.js
// reads state.vfx to draw them. Mirrors the existing state.projectiles
// pattern — nothing here affects simulation outcome, so it's safe for
// gameplay code to fire-and-forget these calls.

export function spawnHitFlash(state, entityId) {
  state.vfx.push({ type: 'hitFlash', entityId, t: 0, duration: 160 });
}

export function spawnDeathBurst(state, x, y, color) {
  const particles = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + randRange(-0.3, 0.3);
    const speed = randRange(50, 110);
    particles.push({ dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, size: randRange(2, 4) });
  }
  state.vfx.push({ type: 'burst', x, y, color, particles, t: 0, duration: 480 });
}

export function spawnFloatText(state, x, y, text, color) {
  state.vfx.push({ type: 'floatText', x, y, text, color, t: 0, duration: 850 });
}

export function spawnDust(state, x, y) {
  const puffs = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const angle = randRange(-Math.PI, 0); // upward-ish hemisphere
    const speed = randRange(10, 28);
    puffs.push({ dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 8, size: randRange(3, 6) });
  }
  state.vfx.push({ type: 'dust', x, y, puffs, t: 0, duration: 600 });
}

export function spawnSparkle(state, x, y, color) {
  state.vfx.push({ type: 'sparkle', x, y, color, t: 0, duration: 380 });
}

export function spawnImpact(state, x, y, color) {
  state.vfx.push({ type: 'impact', x, y, color, t: 0, duration: 200 });
}

export function hitFlashAmount(state, entityId, now) {
  for (const v of state.vfx) {
    if (v.type === 'hitFlash' && v.entityId === entityId) {
      return Math.max(0, 1 - v.t / v.duration);
    }
  }
  return 0;
}

export function updateVfx(state, dt) {
  for (const v of state.vfx) v.t += dt;
  state.vfx = state.vfx.filter((v) => v.t < v.duration);
}

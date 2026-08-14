// SFX — WebAudio synth routed through a small bus tree (audio-design pattern:
// buses not per-sound volume, gain in dB, variation on repeated sounds).
// No assets, no network. Master ← {sfx, ui}. The AudioContext is created
// lazily on the first user gesture (browser autoplay policy). Mute preference
// persists via save.js.
import { loadSave, updateSettings } from './save.js';

let ctx = null;
let buses = null; // { master, sfx, ui }
let muted = loadSave().settings.muted;

const dbToGain = (db) => Math.pow(10, db / 20);

function ensure() {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : dbToGain(-6); // headroom on the master
    master.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = dbToGain(-2);
    sfx.connect(master);
    const ui = ctx.createGain();
    ui.gain.value = dbToGain(-4);
    ui.connect(master);
    buses = { master, sfx, ui };
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One synthesized blip into a bus. Pitch glides f0→f1; exponential fade.
// `vary` adds the audio-design variation rule: ±6% random pitch so repeated
// hits don't sound robotic.
function blip(bus, f0, f1, dur, type = 'square', gainDb = -12, delay = 0, vary = true) {
  if (muted || !ensure()) return;
  const k = vary ? 1 + (Math.random() * 0.12 - 0.06) : 1;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, f0 * k), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * k), t0 + dur);
  g.gain.setValueAtTime(dbToGain(gainDb), t0);
  g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  osc.connect(g);
  g.connect(buses[bus]);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Rate limiters — combat ticks fire constantly; alarms must not spam.
let lastImpact = 0;
let lastAlarm = 0;

export function initSfx() {
  window.addEventListener('pointerdown', ensure, { once: true });
  window.addEventListener('keydown', ensure, { once: true });
}

export function toggleMute() {
  muted = !muted;
  updateSettings({ muted });
  if (buses) buses.master.gain.value = muted ? 0 : dbToGain(-6);
  return muted;
}

export function isMuted() {
  return muted;
}

/** Weapon impact: quiet varied tick, rate-limited (mass battles ≠ buzz). */
export function sfxImpact() {
  const n = performance.now();
  if (n - lastImpact < 60) return;
  lastImpact = n;
  blip('sfx', 320, 140, 0.05, 'square', -20);
}

/** A unit died: short thud. */
export function sfxUnitDeath() {
  blip('sfx', 180, 60, 0.16, 'triangle', -12);
}

/** A building fell: low boom, layered. */
export function sfxBuildingDeath() {
  blip('sfx', 140, 32, 0.5, 'sawtooth', -8);
  blip('sfx', 70, 26, 0.6, 'triangle', -10, 0.04);
}

/** "Under attack" alarm — only when YOUR side takes damage; 8s cooldown. */
export function sfxUnderAttack() {
  const n = performance.now();
  if (n - lastAlarm < 8000) return;
  lastAlarm = n;
  blip('ui', 520, 260, 0.22, 'sawtooth', -10, 0, false);
  blip('ui', 520, 260, 0.22, 'sawtooth', -10, 0.28, false);
}

/** Construction complete: rising confirm. */
export function sfxComplete() {
  blip('ui', 330, 494, 0.12, 'triangle', -12, 0, false);
}

/** Unit trained and spawned: short ready chirp. */
export function sfxUnitReady() {
  blip('ui', 440, 587, 0.09, 'square', -14, 0, false);
}

export function sfxVictory() {
  [523, 659, 784, 1047].forEach((f, i) => blip('ui', f, f, 0.18, 'triangle', -8, i * 0.13, false));
}

export function sfxDefeat() {
  [392, 330, 262, 196].forEach((f, i) => blip('ui', f, f * 0.94, 0.2, 'sawtooth', -8, i * 0.15, false));
}

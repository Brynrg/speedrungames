import { game } from "./state.js";
import { INK, GOLD_BRIGHT, HOSTILE_ACCENT } from "./palette.js";

const MAX_PARTICLES = 180;
const MAX_SHOCKWAVES = 32;
const MAX_SCARS = 36;
const MOTION_STORAGE_KEY = "speedrungames:tower-wars:motion_v1";

export const vfxParticles = [];
export const vfxShockwaves = [];
export const vfxScars = [];

let reducedMotionFallback = false;

export function isReducedMotion() {
try {
if (typeof localStorage !== "undefined") {
const stored = localStorage.getItem(MOTION_STORAGE_KEY);
if (stored !== null) {
return stored === "1" || stored === "true";
}
return reducedMotionFallback;
}
} catch {
// ignore storage errors
}
return reducedMotionFallback;
}

export function setReducedMotion(val) {
const next = Boolean(val);
reducedMotionFallback = next;
try {
if (typeof localStorage !== "undefined") {
localStorage.setItem(MOTION_STORAGE_KEY, next ? "1" : "0");
}
} catch {
// ignore storage errors
}
return next;
}

export function toggleReducedMotion() {
return setReducedMotion(!isReducedMotion());
}

export function triggerShake(amount) {
if (!isReducedMotion()) {
game.shake = Math.min(4.5, Math.max(game.shake || 0, amount));
}
}

export function spawnBurst(
x,
y,
color = GOLD_BRIGHT,
count = 8,
speed = 75,
size = 2.6,
life = 0.36
) {
const n = Math.max(0, Math.floor(count));
for (let i = 0; i < n; i++) {
while (vfxParticles.length >= MAX_PARTICLES) {
vfxParticles.shift();
}
const angle = (Math.PI * 2 * i) / Math.max(1, n) + (Math.random() - 0.5) * 0.45;
const spd = speed * (0.55 + Math.random() * 0.65);
vfxParticles.push({
x,
y,
vx: Math.cos(angle) * spd,
vy: Math.sin(angle) * spd,
color,
size: size * (0.75 + Math.random() * 0.5),
life,
maxLife: life,
shape: i % 2 === 0 ? "diamond" : "circle",
});
}
}

export function spawnShockwave(
x,
y,
maxRadius = 42,
color = HOSTILE_ACCENT,
life = 0.32
) {
while (vfxShockwaves.length >= MAX_SHOCKWAVES) {
vfxShockwaves.shift();
}
vfxShockwaves.push({
x,
y,
radius: 2,
maxRadius,
color,
life,
maxLife: life,
});
}

export function spawnGroundScar(
x,
y,
radius = 18,
kind = "scorch",
life = 6.5
) {
while (vfxScars.length >= MAX_SCARS) {
vfxScars.shift();
}
vfxScars.push({
x,
y,
radius,
kind,
life,
maxLife: life,
rotation: Math.random() * Math.PI * 2,
});
}

export function clearVfx() {
vfxParticles.length = 0;
vfxShockwaves.length = 0;
vfxScars.length = 0;
}

export function updateVfx(dt) {
const step = Math.max(0, dt || 0);
const drag = Math.pow(0.92, step * 60);

for (let i = vfxParticles.length - 1; i >= 0; i--) {
const p = vfxParticles[i];
p.x += p.vx * step;
p.y += p.vy * step;
p.vx *= drag;
p.vy *= drag;
p.life -= step;
if (p.life <= 0) {
vfxParticles.splice(i, 1);
}
}

for (let i = vfxShockwaves.length - 1; i >= 0; i--) {
const sw = vfxShockwaves[i];
sw.life -= step;
if (sw.life <= 0) {
vfxShockwaves.splice(i, 1);
} else {
const progress = 1 - sw.life / Math.max(0.001, sw.maxLife);
sw.radius = 2 + (sw.maxRadius - 2) * progress;
}
}

for (let i = vfxScars.length - 1; i >= 0; i--) {
const scar = vfxScars[i];
scar.life -= step;
if (scar.life <= 0) {
vfxScars.splice(i, 1);
}
}

game.shake = Math.max(0, (game.shake || 0) - step * 18);
}

export function drawGroundScars(ctx) {
if (!ctx || vfxScars.length === 0) return;

for (let i = 0; i < vfxScars.length; i++) {
const scar = vfxScars[i];
const alpha = Math.max(0, Math.min(1, scar.life / Math.max(0.001, scar.maxLife)));
ctx.save();
ctx.translate(scar.x, scar.y);
ctx.rotate(scar.rotation || 0);

if (scar.kind === "frost") {
ctx.globalAlpha = alpha * 0.65;
ctx.fillStyle = "rgba(120, 225, 255, 0.28)";
ctx.strokeStyle = "#7ce8ff";
ctx.lineWidth = 1.5;

ctx.beginPath();
const spikes = 6;
for (let j = 0; j < spikes * 2; j++) {
const r = j % 2 === 0 ? scar.radius : scar.radius * 0.45;
const a = (Math.PI * j) / spikes;
const px = Math.cos(a) * r;
const py = Math.sin(a) * r;
if (j === 0) ctx.moveTo(px, py);
else ctx.lineTo(px, py);
}
ctx.closePath();
ctx.fill();
ctx.stroke();

ctx.beginPath();
ctx.arc(0, 0, scar.radius * 0.55, 0, Math.PI * 2);
ctx.stroke();
} else {
ctx.globalAlpha = alpha * 0.72;
ctx.fillStyle = INK;
ctx.beginPath();
ctx.arc(0, 0, scar.radius * 0.68, 0, Math.PI * 2);
ctx.fill();

ctx.strokeStyle = INK;
ctx.lineWidth = 1.4;
ctx.beginPath();
const teeth = 10;
for (let j = 0; j < teeth; j++) {
const a = (Math.PI * 2 * j) / teeth;
const r = scar.radius * (j % 2 === 0 ? 0.98 : 0.72);
const px = Math.cos(a) * r;
const py = Math.sin(a) * r;
if (j === 0) ctx.moveTo(px, py);
else ctx.lineTo(px, py);
}
ctx.closePath();
ctx.stroke();
}

ctx.restore();
}
}

export function drawVfxOverlay(ctx) {
if (!ctx) return;

for (let i = 0; i < vfxShockwaves.length; i++) {
const sw = vfxShockwaves[i];
const alpha = Math.max(0, Math.min(1, sw.life / Math.max(0.001, sw.maxLife)));
ctx.save();
ctx.globalAlpha = alpha;
ctx.strokeStyle = INK;
ctx.lineWidth = 3.5;
ctx.beginPath();
ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
ctx.stroke();

ctx.strokeStyle = sw.color;
ctx.lineWidth = 1.8;
ctx.beginPath();
ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
ctx.stroke();
ctx.restore();
}

for (let i = 0; i < vfxParticles.length; i++) {
const p = vfxParticles[i];
const alpha = Math.max(0, Math.min(1, p.life / Math.max(0.001, p.maxLife)));
const r = Math.max(0.5, p.size * (0.4 + 0.6 * alpha));
ctx.save();
ctx.globalAlpha = alpha;
ctx.translate(p.x, p.y);
ctx.fillStyle = p.color;
ctx.strokeStyle = INK;
ctx.lineWidth = 1.2;

ctx.beginPath();
if (p.shape === "diamond") {
ctx.moveTo(0, -r * 1.25);
ctx.lineTo(r * 0.9, 0);
ctx.lineTo(0, r * 1.25);
ctx.lineTo(-r * 0.9, 0);
ctx.closePath();
} else {
ctx.arc(0, 0, r, 0, Math.PI * 2);
}
ctx.fill();
ctx.stroke();
ctx.restore();
}
}

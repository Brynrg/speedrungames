// Modular "Ink & Iron" Canvas 2D vector art and animation helpers (zero external dependencies).
import {
  INK,
  GOLD,
  GOLD_BRIGHT,
  CYAN_CHEVRON,
  HOSTILE_ACCENT,
  PLINTH_TOP,
  PLINTH_SIDE,
  PROJECTILE_COLORS,
} from "./palette.js";
import { TOWER_DATA } from "./towers.js";
const CREAM_TEXT = "rgba(244, 236, 216, 0.28)";
const BRASS_MARK = "rgba(212, 168, 83, 0.55)";

function traceOctagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function getTowerCenter(t, tileSize) {
  if (typeof t.x === "number" && typeof t.y === "number") {
    return { x: t.x, y: t.y };
  }
  return {
    x: (t.cx ?? 0) * tileSize + tileSize / 2,
    y: (t.cy ?? 0) * tileSize + tileSize / 2,
  };
}

export function drawCartographicBackdrop(ctx, worldW, worldH, cols, rows, tileSize) {
  ctx.save();

  // Subtle dark-ink outer map vignette frame
  const edge = Math.max(18, tileSize * 0.65);
  const topGrad = ctx.createLinearGradient(0, 0, 0, edge);
  topGrad.addColorStop(0, "rgba(18, 16, 14, 0.42)");
  topGrad.addColorStop(1, "rgba(18, 16, 14, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, worldW, edge);

  const botGrad = ctx.createLinearGradient(0, worldH - edge, 0, worldH);
  botGrad.addColorStop(0, "rgba(18, 16, 14, 0)");
  botGrad.addColorStop(1, "rgba(18, 16, 14, 0.45)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, worldH - edge, worldW, edge);

  const leftGrad = ctx.createLinearGradient(0, 0, edge, 0);
  leftGrad.addColorStop(0, "rgba(18, 16, 14, 0.4)");
  leftGrad.addColorStop(1, "rgba(18, 16, 14, 0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, edge, worldH);

  const rightGrad = ctx.createLinearGradient(worldW - edge, 0, worldW, 0);
  rightGrad.addColorStop(0, "rgba(18, 16, 14, 0)");
  rightGrad.addColorStop(1, "rgba(18, 16, 14, 0.4)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(worldW - edge, 0, edge, worldH);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, worldW - 2, worldH - 2);

  // Faint tactical sector coordinate labels
  ctx.fillStyle = CREAM_TEXT;
  ctx.font = '600 10px "Rajdhani", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let c = 0; c < cols; c++) {
    const label = String.fromCharCode(65 + (c % 26));
    ctx.fillText(label, c * tileSize + tileSize / 2, 4);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    ctx.fillText(String(r + 1), 5, r * tileSize + tileSize / 2);
  }

  // Small brass corner registration marks
  const m = 12;
  const pad = 6;
  ctx.strokeStyle = BRASS_MARK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(pad, pad + m);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + m, pad);
  // Top-right
  ctx.moveTo(worldW - pad - m, pad);
  ctx.lineTo(worldW - pad, pad);
  ctx.lineTo(worldW - pad, pad + m);
  // Bottom-left
  ctx.moveTo(pad, worldH - pad - m);
  ctx.lineTo(pad, worldH - pad);
  ctx.lineTo(pad + m, worldH - pad);
  // Bottom-right
  ctx.moveTo(worldW - pad - m, worldH - pad);
  ctx.lineTo(worldW - pad, worldH - pad);
  ctx.lineTo(worldW - pad, worldH - pad - m);
  ctx.stroke();

  ctx.restore();
}

export function drawMazeBastionWalls(ctx, towers, tileSize) {
  if (!towers || towers.length < 2) return;
  const maxDist = 1.15 * tileSize;
  const alignTol = 0.25 * tileSize;

  ctx.save();
  for (let i = 0; i < towers.length; i++) {
    const a = getTowerCenter(towers[i], tileSize);
    for (let j = i + 1; j < towers.length; j++) {
      const b = getTowerCenter(towers[j], tileSize);
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const isHoriz = dx <= maxDist && dy <= alignTol;
      const isVert = dy <= maxDist && dx <= alignTol;
      if (!isHoriz && !isVert) continue;

      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const wallThick = Math.max(8, tileSize * 0.28);
      const capThick = wallThick * 0.62;

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(angle);

      // Stone base (PLINTH_SIDE)
      ctx.fillStyle = PLINTH_SIDE;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.rect(0, -wallThick / 2, len, wallThick);
      ctx.fill();
      ctx.stroke();

      // Top parapet cap (PLINTH_TOP)
      ctx.fillStyle = PLINTH_TOP;
      ctx.fillRect(2, -capThick / 2, Math.max(0, len - 4), capThick);

      // Subtle battlement notches & iron rivets
      const step = Math.max(10, len / 4);
      ctx.fillStyle = INK;
      for (let sx = step * 0.7; sx < len - step * 0.4; sx += step) {
        ctx.fillRect(sx - 1.5, -wallThick / 2 + 1, 3, 2.5);
        ctx.fillRect(sx - 1.5, wallThick / 2 - 3.5, 3, 2.5);
        ctx.beginPath();
        ctx.arc(sx, 0, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawGhostTowerPreview(ctx, cx, cy, tileSize, selectedType, canBuild) {
  const x = cx * tileSize + tileSize / 2;
  const y = cy * tileSize + tileSize / 2;
  const data = TOWER_DATA ? TOWER_DATA[selectedType] : null;
  const strokeColor = canBuild ? "#38d9c0" : HOSTILE_ACCENT;
  const fillColor = canBuild ? "rgba(56, 217, 192, 0.1)" : "rgba(217, 68, 68, 0.12)";

  ctx.save();

  // Translucent dashed range ring
  if (data && typeof data.range === "number" && data.range > 0) {
    ctx.beginPath();
    ctx.arc(x, y, data.range, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Translucent octagonal plinth & tower silhouette
  const plinthR = tileSize * 0.42;
  ctx.globalAlpha = 0.55;
  traceOctagon(ctx, x, y, plinthR);
  ctx.fillStyle = canBuild ? PLINTH_TOP : HOSTILE_ACCENT;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(x, y, tileSize * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x, y - tileSize * 0.06, tileSize * 0.28, tileSize * 0.12);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function getSmoothedTowerMotion(tower, rawAngle, nowSec) {
  const prevSec = tower._lastMotionSec ?? nowSec;
  const dt = Math.min(0.1, Math.max(0.001, nowSec - prevSec));
  tower._lastMotionSec = nowSec;

  if (typeof tower._renderAngle !== "number") {
    tower._renderAngle = rawAngle;
  } else {
    let diff = rawAngle - tower._renderAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const t = 1 - Math.exp(-14 * dt);
    tower._renderAngle += diff * t;
  }

  const cd = tower.cooldown ?? 0;
  const prevCd = tower._prevCooldown ?? cd;
  if (cd > prevCd + 0.01) {
    tower._recoil = 1;
  }
  tower._prevCooldown = cd;

  const currentRecoil = tower._recoil ?? 0;
  tower._recoil = Math.max(0, currentRecoil * Math.exp(-12 * dt) - 0.01 * dt);
  if (tower._recoil < 0.005) tower._recoil = 0;

  return {
    angle: tower._renderAngle,
    recoilPx: tower._recoil * 3.8,
  };
}

export function drawTowerVisualExtras(ctx, tower, nowSec) {
  const x = tower.x ?? 0;
  const y = tower.y ?? 0;
  const r = tower.radius ?? 14;
  const kind = String(tower.type || tower.family || "").toLowerCase();
  const angle = tower._renderAngle ?? tower.angle ?? 0;

  ctx.save();

  if (kind.includes("arcane")) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(nowSec * 0.7);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (kind.includes("venom")) {
    for (let i = 0; i < 3; i++) {
      const phase = nowSec * 2.4 + i * 2.1;
      const bx = x + Math.cos(i * 2.1 + nowSec * 0.4) * (r * 0.42);
      const by = y + Math.sin(i * 2.1 + nowSec * 0.4) * (r * 0.36) - ((phase % 1) * 5);
      const br = 1.4 + 0.9 * (0.5 + 0.5 * Math.sin(phase * 2));
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = "#8df556";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (kind.includes("mortar")) {
    const mx = x + Math.cos(angle) * (r * 0.95);
    const my = y + Math.sin(angle) * (r * 0.95);
    const pulse = 0.65 + 0.35 * Math.sin(nowSec * 6.5);
    ctx.beginPath();
    ctx.arc(mx, my, 3.8 + pulse * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 132, 42, ${0.42 + 0.25 * pulse})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd180";
    ctx.fill();
  } else if (kind.includes("obelisk")) {
    for (let i = 0; i < 2; i++) {
      const a = nowSec * 1.8 + i * Math.PI;
      const sx = x + Math.cos(a) * (r * 1.08);
      const sy = y + Math.sin(a) * (r * 1.08);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -4.2);
      ctx.lineTo(2.6, 0);
      ctx.lineTo(0, 4.2);
      ctx.lineTo(-2.6, 0);
      ctx.closePath();
      ctx.fillStyle = CYAN_CHEVRON;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Branch A/B badge crest: twin wing/chevron accents
  if (tower.branch) {
    const isBranchA = String(tower.branch).toUpperCase() === "A";
    const crestColor = isBranchA ? GOLD_BRIGHT : CYAN_CHEVRON;
    const cy = y + r * 0.72;
    ctx.fillStyle = crestColor;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;

    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 2.5, cy);
      ctx.lineTo(x + dir * 8.5, cy - 3.5);
      ctx.lineTo(x + dir * 6.8, cy + 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawEnemyVisualExtras(ctx, enemy, nowSec) {
  const x = enemy.x ?? 0;
  const y = enemy.y ?? 0;
  const r = enemy.radius ?? 10;
  const angle = enemy.angle ?? 0;
  const arch = String(enemy.archetype || "").toLowerCase();

  ctx.save();

  // Hit-flash warm-cream silhouette highlight
  if (enemy.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, enemy.hitFlash / 0.085)) * 0.85;
    ctx.beginPath();
    ctx.arc(x, y, r + 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "#fff5dc";
    ctx.fill();
    ctx.restore();
  }

  // Heavy / fortified armored front plate
  if (enemy.heavy || enemy.fortified || arch === "heavy" || arch === "fortified") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.5, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.strokeStyle = PLINTH_TOP;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // Flying flapping wing strokes
  if (enemy.flying || arch === "flying") {
    const flap = Math.sin(nowSec * 14 + x * 0.1) * (r * 0.45);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - 2);
    ctx.quadraticCurveTo(x - r * 1.15, y - 6 + flap, x - r * 1.55, y - 1 + flap);
    ctx.moveTo(x + r * 0.4, y - 2);
    ctx.quadraticCurveTo(x + r * 1.15, y - 6 + flap, x + r * 1.55, y - 1 + flap);
    ctx.stroke();
  }

  // Splitter pulsing nodes
  if (enemy.splitter || arch === "splitter") {
    const pulse = 0.7 + 0.3 * Math.sin(nowSec * 5.5);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + nowSec * 1.2;
      const nx = x + Math.cos(a) * (r * 0.65);
      const ny = y + Math.sin(a) * (r * 0.65);
      ctx.beginPath();
      ctx.arc(nx, ny, 2.2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = "#a3ff6e";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Magic-immune shimmering arcane ward hex
  if (enemy.magicImmune || arch === "magicimmune") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(nowSec * 0.9);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const hx = Math.cos(a) * (r + 4.5);
      const hy = Math.sin(a) * (r + 4.5);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.strokeStyle = CYAN_CHEVRON;
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(nowSec * 5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Boss gold war-crown / crest
  if (enemy.isBoss) {
    const cy = y - r - 4;
    ctx.beginPath();
    ctx.moveTo(x - 7, cy + 3);
    ctx.lineTo(x - 8, cy - 4);
    ctx.lineTo(x - 3, cy);
    ctx.lineTo(x, cy - 6);
    ctx.lineTo(x + 3, cy);
    ctx.lineTo(x + 8, cy - 4);
    ctx.lineTo(x + 7, cy + 3);
    ctx.closePath();
    ctx.fillStyle = GOLD_BRIGHT;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawSmartHealthBar(ctx, enemy) {
  if (!enemy || !enemy.maxHp || enemy.maxHp <= 0) return;
  if (enemy.hp >= enemy.maxHp && !enemy.isBoss) return;

  const x = enemy.x ?? 0;
  const y = enemy.y ?? 0;
  const r = enemy.radius ?? 10;
  const w = enemy.isBoss ? Math.max(36, r * 2.4) : Math.max(22, r * 2);
  const h = enemy.isBoss ? 5.5 : 4;
  const bx = x - w / 2;
  const by = y - r - (enemy.isBoss ? 15 : 9);

  const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const trailRatio = Math.max(hpRatio, Math.min(1, (enemy._trailHp ?? enemy.hp) / enemy.maxHp));

  ctx.save();

  // Dark inked backing
  ctx.fillStyle = INK;
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);

  // Cream trailing damage bar
  if (trailRatio > hpRatio) {
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(bx, by, w * trailRatio, h);
  }

  // Crisp HP fill on top
  ctx.fillStyle = enemy.isBoss ? GOLD_BRIGHT : hpRatio > 0.45 ? "#52d16c" : HOSTILE_ACCENT;
  ctx.fillRect(bx, by, w * hpRatio, h);

  ctx.restore();
}

export function drawEnhancedProjectile(ctx, p) {
  if (!p) return;
  const baseColor =
    (PROJECTILE_COLORS && PROJECTILE_COLORS[p.damageType]) || GOLD_BRIGHT;

  ctx.save();

  // 5-point tapered motion trail
  if (Array.isArray(p.trail) && p.trail.length > 1) {
    const pts = p.trail.slice(-5);
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = t * 0.55;
      ctx.lineWidth = 1 + t * 2.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const lift = Math.sin((p.progress || 0) * Math.PI) * (p.arcHeight || 0);

  // Ground shadow when airborne
  if (lift > 1) {
    ctx.save();
    ctx.fillStyle = "rgba(18, 16, 14, 0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 4.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.translate(p.x, p.y - lift);
  ctx.rotate(p.angle || 0);

  if (p.damageType === "piercing") {
    // Fletched arrow dart
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();

    // Triangular arrowhead
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(3, -3.2);
    ctx.lineTo(3, 3.2);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Twin tail feathers
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-10, -3);
    ctx.moveTo(-6, 0);
    ctx.lineTo(-10, 3);
    ctx.strokeStyle = "#f4ecd8";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (p.damageType === "magic") {
    // Elongated faceted cyan frost crystal shard
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(0, -3.5);
    ctx.lineTo(-8, 0);
    ctx.lineTo(0, 3.5);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(0, -1.4);
    ctx.lineTo(-4, 0);
    ctx.lineTo(0, 1.4);
    ctx.closePath();
    ctx.fillStyle = "#e6ffff";
    ctx.fill();
  } else if (p.damageType === "spell") {
    // Glowing faceted diamond/orb with crisp ink outline
    ctx.beginPath();
    ctx.moveTo(6.5, 0);
    ctx.lineTo(0, -4.5);
    ctx.lineTo(-6.5, 0);
    ctx.lineTo(0, 4.5);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  } else if (p.damageType === "siege") {
    // Heavy iron cannonball / mortar shell scaled slightly up with lift
    const scale = 1 + Math.min(0.35, lift * 0.008);
    ctx.scale(scale, scale);

    // Ember fuse tail
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-9, -2.5);
    ctx.strokeStyle = "#ff8c2a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-9, -2.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd180";
    ctx.fill();

    // Iron shell body
    ctx.beginPath();
    ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = "#3a3632";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Warm specular highlight
    ctx.beginPath();
    ctx.arc(-1.6, -1.6, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244, 236, 216, 0.55)";
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPulsingSelectionReticle(ctx, tower, nowSec) {
  if (!tower) return;
  const x = tower.x ?? 0;
  const y = tower.y ?? 0;
  const baseR = (tower.radius ?? 16) + 7;
  const pulse = Math.sin(nowSec * 4.5) * 1.8;
  const r = baseR + pulse;

  ctx.save();

  // Gently pulsing GOLD_BRIGHT octagon
  traceOctagon(ctx, x, y, r);
  ctx.strokeStyle = GOLD_BRIGHT;
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = 0.85;
  ctx.stroke();

  // 4 rotating corner target brackets
  ctx.translate(x, y);
  ctx.rotate(nowSec * 0.9);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;

  const br = r + 4;
  const len = 6;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(br - len, -2.5);
    ctx.lineTo(br, 0);
    ctx.lineTo(br - len, 2.5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export function drawOutlinedFloatingText(ctx, text, x, y, color, alpha, progress) {
  const p = Math.max(0, Math.min(1, progress ?? 1));
  let scale = 1;
  if (p < 0.2) {
    const t = p / 0.2;
    const easeOut = 1 - Math.pow(1 - t, 3);
    scale = 1.28 - 0.28 * easeOut;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha ?? 1));
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.font = '700 13px "Rajdhani", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 0);

  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}


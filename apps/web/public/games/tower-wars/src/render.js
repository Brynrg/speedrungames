import { canBuildOnCell } from "./build.js";
import { COLS, HEIGHT, ROWS, TILE, WIDTH } from "./constants.js";
import { canvas, ctx } from "./dom.js";
import { clamp, inBounds, worldFromCell } from "./grid.js";
import { getMazePreviewPoints } from "./maze.js";
import { DUEL_EXITS, DUEL_LANE_IDS, DUEL_SPAWNS, DUEL_WAYPOINTS, MAZE_EXIT, MAZE_START, WAYPOINTS } from "./paths.js";
import { game, getActivePlayerState, statusBanners } from "./state.js";
import { TOWER_DATA } from "./towers.js";

export function drawBoard() {
  const grass = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grass.addColorStop(0, "#1c3e21");
  grass.addColorStop(1, "#17341d");

  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(52, 98, 53, 0.14)" : "rgba(40, 82, 42, 0.1)";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.strokeStyle = "rgba(13, 22, 12, 0.23)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= COLS; gx += 1) {
    const px = gx * TILE + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy <= ROWS; gy += 1) {
    const py = gy * TILE + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(WIDTH, py);
    ctx.stroke();
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (game.mode === "classic") {
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i += 1) {
      ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.strokeStyle = "#6d6657";
    ctx.lineWidth = 33;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i += 1) {
      ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.strokeStyle = "#8e846f";
    ctx.lineWidth = 24;
    ctx.stroke();
  } else if (game.mode === "maze") {
    const preview = getMazePreviewPoints();
    if (preview.length > 1) {
      ctx.beginPath();
      ctx.moveTo(preview[0].x, preview[0].y);
      for (let i = 1; i < preview.length; i += 1) {
        ctx.lineTo(preview[i].x, preview[i].y);
      }
      ctx.strokeStyle = "rgba(190, 216, 146, 0.45)";
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  } else {
    for (let lane = 0; lane < DUEL_WAYPOINTS.length; lane += 1) {
      const points = DUEL_WAYPOINTS[lane];
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = "#6d6657";
      ctx.lineWidth = 30;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = lane === 0 ? "#9ea07c" : "#7f8ca6";
      ctx.lineWidth = 22;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(230, 236, 195, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(HEIGHT / 2) + 0.5);
    ctx.lineTo(WIDTH, Math.floor(HEIGHT / 2) + 0.5);
    ctx.stroke();
  }

  if (game.mode === "duel") {
    for (let lane = 0; lane < DUEL_LANE_IDS.length; lane += 1) {
      const spawnPoint = worldFromCell(DUEL_SPAWNS[lane].cx, DUEL_SPAWNS[lane].cy);
      ctx.fillStyle = lane === 0 ? "#9add7a" : "#7ab5e4";
      ctx.beginPath();
      ctx.arc(spawnPoint.x, spawnPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();

      const exitPoint = worldFromCell(DUEL_EXITS[lane].cx, DUEL_EXITS[lane].cy);
      ctx.fillStyle = lane === 0 ? "#e89a85" : "#e082a5";
      ctx.beginPath();
      ctx.arc(exitPoint.x, exitPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const spawnPoint = worldFromCell(MAZE_START.cx, MAZE_START.cy);
    ctx.fillStyle = "#91d164";
    ctx.beginPath();
    ctx.arc(spawnPoint.x, spawnPoint.y, 9, 0, Math.PI * 2);
    ctx.fill();

    const exitPoint = worldFromCell(MAZE_EXIT.cx, MAZE_EXIT.cy);
    ctx.fillStyle = "#e98a75";
    ctx.beginPath();
    ctx.arc(exitPoint.x, exitPoint.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.hoverCell) {
    const { cx, cy } = game.hoverCell;
    if (inBounds(cx, cy)) {
      const center = worldFromCell(cx, cy);
      const canBuild = canBuildOnCell(cx, cy);
      const affordable = getActivePlayerState().gold >= TOWER_DATA[game.selectedType].cost;

      ctx.beginPath();
      ctx.arc(center.x, center.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = canBuild ? (affordable ? "rgba(131, 210, 86, 0.4)" : "rgba(220, 155, 92, 0.4)") : "rgba(216, 86, 86, 0.32)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = canBuild ? "rgba(203, 244, 166, 0.85)" : "rgba(236, 122, 122, 0.88)";
      ctx.stroke();
    }
  }
}

export function drawPolygon(cx, cy, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (Math.PI * 2 * i) / sides;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

export function getTowerAimAngle(tower) {
  const target = tower.acquireTarget();
  if (!target) {
    return -Math.PI / 2;
  }
  return Math.atan2(target.y - tower.y, target.x - tower.x);
}

export function drawTowerBasePad(tower) {
  const x = tower.x;
  const y = tower.y;
  const { color } = tower.data;

  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 20, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  drawPolygon(x, y + 1, 18, 8, Math.PI / 8);
  ctx.fillStyle = "#3e4730";
  ctx.fill();
  ctx.strokeStyle = "rgba(10, 15, 9, 0.62)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  drawPolygon(x, y - 1, 13, 8, Math.PI / 8);
  ctx.fillStyle = "#566542";
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x - 2, y - 3, 4, 4);
}

export function drawArrowTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const aim = getTowerAimAngle(tower);

  ctx.fillStyle = "#6f5230";
  ctx.fillRect(x - 9, y - 3, 4, 13);
  ctx.fillRect(x + 5, y - 3, 4, 13);
  ctx.fillStyle = "#5a4024";
  ctx.fillRect(x - 9, y + 8, 18, 3);

  ctx.fillStyle = "#89653d";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 3);
  ctx.lineTo(x + 8, y - 3);
  ctx.lineTo(x + 5, y - 10);
  ctx.lineTo(x - 5, y - 10);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - 7);
  ctx.rotate(aim);
  ctx.strokeStyle = "#d4bb7d";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.lineTo(6, 0);
  ctx.lineTo(-7, 3);
  ctx.stroke();
  ctx.fillStyle = "#e8d7a4";
  ctx.fillRect(3, -1, 10, 2);
  ctx.restore();
}

export function drawFrostTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const pulse = 0.8 + Math.sin(performance.now() * 0.005) * 0.2;

  ctx.fillStyle = "#58717e";
  ctx.fillRect(x - 8, y - 2, 16, 12);
  ctx.fillStyle = "#6f8f9f";
  ctx.fillRect(x - 6, y - 5, 12, 6);

  ctx.beginPath();
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x + 7, y - 4);
  ctx.lineTo(x, y + 1);
  ctx.lineTo(x - 7, y - 4);
  ctx.closePath();
  ctx.fillStyle = `rgba(148, 220, 255, ${0.75 * pulse})`;
  ctx.fill();
  ctx.strokeStyle = "#def4ff";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "rgba(190, 236, 255, 0.7)";
  ctx.fillRect(x - 1, y - 14, 2, 10);
}

export function drawCannonTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const aim = getTowerAimAngle(tower);

  ctx.fillStyle = "#6f6253";
  ctx.fillRect(x - 11, y - 2, 22, 12);
  ctx.fillStyle = "#857665";
  for (let i = -10; i <= 6; i += 5) {
    ctx.fillRect(x + i, y - 7, 4, 5);
  }

  ctx.save();
  ctx.translate(x, y - 2);
  ctx.rotate(aim);
  ctx.fillStyle = "#5b5146";
  ctx.fillRect(-2, -3, 16, 6);
  ctx.fillStyle = "#3f3730";
  ctx.fillRect(11, -4, 4, 8);
  ctx.restore();
}

export function drawArcaneTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const aim = getTowerAimAngle(tower);
  const pulse = 0.76 + Math.sin(performance.now() * 0.006) * 0.24;

  ctx.fillStyle = "#5f4f83";
  drawPolygon(x, y - 2, 11, 6, Math.PI / 6);
  ctx.fill();

  ctx.fillStyle = "#8f79d8";
  ctx.beginPath();
  ctx.moveTo(x, y - 17);
  ctx.lineTo(x + 8, y - 6);
  ctx.lineTo(x, y);
  ctx.lineTo(x - 8, y - 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(211, 192, 255, ${0.66 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y - 8, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - 8);
  ctx.rotate(aim);
  ctx.strokeStyle = "rgba(232, 217, 255, 0.88)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(12, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawVenomTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const aim = getTowerAimAngle(tower);

  ctx.fillStyle = "#4a6130";
  ctx.fillRect(x - 9, y - 2, 18, 12);
  ctx.fillStyle = "#5f7d3b";
  drawPolygon(x, y - 4, 9, 5, -Math.PI / 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - 3);
  ctx.rotate(aim);
  ctx.fillStyle = "#83bd58";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(13, -3);
  ctx.lineTo(16, 0);
  ctx.lineTo(13, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(188, 244, 138, 0.8)";
  ctx.beginPath();
  ctx.arc(x, y - 6, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawMortarTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const aim = getTowerAimAngle(tower);

  ctx.fillStyle = "#75503e";
  ctx.fillRect(x - 10, y - 1, 20, 11);
  ctx.fillStyle = "#8f634d";
  ctx.fillRect(x - 8, y - 5, 16, 5);

  ctx.save();
  ctx.translate(x, y - 2);
  ctx.rotate(aim);
  ctx.fillStyle = "#6e4533";
  ctx.fillRect(-3, -4, 14, 8);
  ctx.fillStyle = "#bd774f";
  ctx.fillRect(8, -3, 6, 6);
  ctx.restore();

  ctx.fillStyle = "rgba(255, 172, 117, 0.65)";
  ctx.beginPath();
  ctx.arc(x, y - 7, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawObeliskTowerModel(tower) {
  const x = tower.x;
  const y = tower.y;
  const pulse = 0.76 + Math.sin(performance.now() * 0.005) * 0.24;

  ctx.fillStyle = "#466378";
  drawPolygon(x, y + 1, 10, 6, Math.PI / 6);
  ctx.fill();

  ctx.fillStyle = "#77b0d6";
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 7, y - 3);
  ctx.lineTo(x, y + 3);
  ctx.lineTo(x - 7, y - 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(203, 241, 255, ${0.7 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y - 8, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(205, 239, 255, 0.7)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y);
  ctx.stroke();
}

export function drawTowerRankAndBranch(tower) {
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = "#f2d86e";
    ctx.fillRect(tower.x - 11 + i * 4, tower.y + 11, 3, 3);
  }

  if (tower.branchData) {
    ctx.fillStyle = "#ffd78d";
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y - 17);
    ctx.lineTo(tower.x + 4, tower.y - 11);
    ctx.lineTo(tower.x - 4, tower.y - 11);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawTower(tower) {
  drawTowerBasePad(tower);

  if (tower.type === "arrow") {
    drawArrowTowerModel(tower);
  } else if (tower.type === "frost") {
    drawFrostTowerModel(tower);
  } else if (tower.type === "cannon") {
    drawCannonTowerModel(tower);
  } else if (tower.type === "arcane") {
    drawArcaneTowerModel(tower);
  } else if (tower.type === "mortar") {
    drawMortarTowerModel(tower);
  } else if (tower.type === "obelisk") {
    drawObeliskTowerModel(tower);
  } else {
    drawVenomTowerModel(tower);
  }

  drawTowerRankAndBranch(tower);

  if (game.duelMode) {
    ctx.strokeStyle = tower.owner === 0 ? "rgba(173, 239, 139, 0.55)" : "rgba(146, 201, 255, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (tower.hasAura()) {
    const aura = tower.branchData.aura || tower.branchData.auraSlow;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, aura.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(152, 211, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (game.selectedTower === tower) {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.effectiveRange, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(231, 217, 120, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(237, 222, 144, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawPolygon(tower.x, tower.y, 21, 8, Math.PI / 8);
    ctx.strokeStyle = "#f4e092";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawEnemy(enemy) {
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = enemy.rim;
  ctx.lineWidth = enemy.isBoss ? 2.6 : 1.5;
  ctx.stroke();

  if (enemy.flying) {
    ctx.beginPath();
    ctx.moveTo(enemy.x - enemy.radius - 4, enemy.y);
    ctx.lineTo(enemy.x + enemy.radius + 4, enemy.y);
    ctx.strokeStyle = "rgba(209, 236, 255, 0.65)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (enemy.slowTimer > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(132, 210, 255, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (enemy.burnTimer > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 136, 85, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const barW = enemy.isBoss ? 46 : 30;
  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = "rgba(15, 18, 12, 0.88)";
  ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 14, barW, 5.2);

  ctx.fillStyle = enemy.isBoss ? "#f9c76d" : enemy.flying ? "#9dd8ff" : "#98d872";
  ctx.fillRect(enemy.x - barW / 2 + 0.8, enemy.y - enemy.radius - 13.1, (barW - 1.6) * hpRatio, 3.4);

  const statusBadges = [];
  if (enemy.slowTimer > 0 || enemy.auraSlowFactor < 0.999) {
    statusBadges.push({ text: "S", color: "#9adfff" });
  }
  if (enemy.burnTimer > 0) {
    statusBadges.push({ text: "B", color: "#ffb38a" });
  }
  if (enemy.magicImmune) {
    statusBadges.push({ text: "M", color: "#d0bcff" });
  }
  if (enemy.isBoss) {
    statusBadges.push({ text: "K", color: "#f4d577" });
  }
  for (let i = 0; i < statusBadges.length; i += 1) {
    const badge = statusBadges[i];
    const bx = enemy.x - barW / 2 + i * 10;
    const by = enemy.y - enemy.radius - 22;
    ctx.fillStyle = "rgba(9, 16, 9, 0.84)";
    ctx.fillRect(bx, by, 9, 9);
    ctx.strokeStyle = "rgba(201, 222, 161, 0.4)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx + 0.4, by + 0.4, 8.2, 8.2);
    ctx.fillStyle = badge.color;
    ctx.font = "700 8px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(badge.text, bx + 4.5, by + 7);
  }

  if (game.hoverEnemy === enemy) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff7ce";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

export function drawProjectile(projectile) {
  if (projectile.damageType === "piercing") {
    ctx.fillStyle = "#f6e28d";
  } else if (projectile.damageType === "magic") {
    ctx.fillStyle = "#a6e4ff";
  } else if (projectile.damageType === "spell") {
    ctx.fillStyle = "#cfbbff";
  } else {
    ctx.fillStyle = "#dbab82";
  }

  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawAreaEffect(effect) {
  const t = effect.life / effect.duration;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
  ctx.fillStyle = effect.color.replace("0.34", `${0.34 * (1 - t)}`);
  ctx.fill();
  ctx.strokeStyle = "rgba(190, 228, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawEffect(effect) {
  const t = effect.life / effect.maxLife;
  if (effect.kind === "explosion") {
    const radius = effect.meta.radius || 18;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * t, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(246, 172, 99, ${0.42 * (1 - t)})`;
    ctx.fill();
    return;
  }

  if (effect.kind === "ring") {
    const radius = effect.meta.radius || 20;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * Math.min(1, 0.2 + t), 0, Math.PI * 2);
    ctx.strokeStyle = effect.meta.color || `rgba(255, 227, 153, ${0.42 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  if (effect.kind === "text") {
    ctx.fillStyle = effect.meta.color || "#fff2bf";
    ctx.font = "700 13px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(effect.meta.text || "", effect.x, effect.y);
    return;
  }

  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 6 * t + 2, 0, Math.PI * 2);
  ctx.fillStyle = effect.kind === "kill" ? `rgba(255, 216, 140, ${0.55 * (1 - t)})` : `rgba(250, 245, 220, ${0.35 * (1 - t)})`;
  ctx.fill();
}

export function drawOverlay() {
  const viewW = canvas.width;
  const viewH = canvas.height;
  if (statusBanners.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "700 14px Rajdhani, sans-serif";
    for (let i = 0; i < statusBanners.length; i += 1) {
      const banner = statusBanners[i];
      const alpha = clamp(banner.life / 3.2, 0, 1);
      const y = 44 + i * 22;
      ctx.fillStyle = `rgba(8, 14, 8, ${0.56 * alpha})`;
      ctx.fillRect(viewW / 2 - 220, y - 13, 440, 18);
      ctx.fillStyle = `rgba(245, 229, 154, ${0.96 * alpha})`;
      ctx.fillText(banner.text, viewW / 2, y);
    }
  }

  if (game.paused && !game.gameOver) {
    ctx.fillStyle = "rgba(8, 11, 8, 0.4)";
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.fillStyle = "#f2d486";
    ctx.font = "700 44px Cinzel, serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused", viewW / 2, viewH / 2);
  }

  if (!game.gameOver) {
    return;
  }

  ctx.fillStyle = "rgba(8, 11, 8, 0.63)";
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.fillStyle = "#f2d486";
  ctx.font = "700 56px Cinzel, serif";
  ctx.textAlign = "center";
  ctx.fillText(game.duelMode ? "Match End" : "Defeat", viewW / 2, viewH / 2 - 20);

  ctx.font = "700 20px Rajdhani, sans-serif";
  ctx.fillStyle = "#ebf2d7";
  const scoreText = game.duelMode
    ? `Wave ${game.wave} | P1 ${Math.floor(game.players[0].score)} vs P2 ${Math.floor(game.players[1].score)}`
    : `You reached wave ${game.wave} | Score ${game.score}`;
  ctx.fillText(scoreText, viewW / 2, viewH / 2 + 20);
  ctx.fillText("Use New Run or Load Run to continue.", viewW / 2, viewH / 2 + 50);
}

export function updateStatusBanners(dt) {
  for (let i = statusBanners.length - 1; i >= 0; i -= 1) {
    statusBanners[i].life -= dt;
    if (statusBanners[i].life <= 0) {
      statusBanners.splice(i, 1);
    }
  }
}

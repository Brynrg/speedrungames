import { playSfx } from "./audio.js";
import { updateBuffsAndAuras } from "./auras.js";
import { applyCameraTransform } from "./camera.js";
import { SPEED_LEVELS } from "./constants.js";
import { ctx } from "./dom.js";
import { updateCameraFromKeys } from "./input.js";
import { startWave } from "./lifecycle.js";
import { drawAreaEffect, drawBoard, drawEffect, drawEnemy, drawOverlay, drawProjectile, drawTower, updateStatusBanners } from "./render.js";
import { saveRun } from "./save.js";
import { recordHighScore } from "./scores.js";
import { getIncomePayout } from "./sends.js";
import { areaEffects, effects, enemies, game, getEnemyDefenderState, getEnemyLane, projectiles, syncActiveToLegacyIfDuel, towers } from "./state.js";
import { status } from "./status.js";
import { syncUi } from "./ui-sync.js";
import { spawnEnemyFromQueue } from "./waves.js";

export function update(dt) {
  updateStatusBanners(dt);
  updateCameraFromKeys(dt);

  if (game.gameOver || game.paused) {
    return;
  }

  syncActiveToLegacyIfDuel();
  updateBuffsAndAuras(dt);

  const incomeStates = game.duelMode ? game.players : [game];
  for (let i = 0; i < incomeStates.length; i += 1) {
    const state = incomeStates[i];
    state.incomeTimer += dt;
    if (state.incomeTimer >= state.incomeInterval) {
      const ticks = Math.floor(state.incomeTimer / state.incomeInterval);
      state.incomeTimer -= ticks * state.incomeInterval;
      const payout = ticks * getIncomePayout(state);
      if (payout > 0) {
        state.gold += payout;
        if (payout >= 3 && (!game.duelMode || i === game.activePlayer)) {
          status(`${game.duelMode ? `P${i + 1} ` : ""}Income +${payout}g`);
        }
      }
    }
  }
  syncActiveToLegacyIfDuel();

  if (game.waveActive) {
    game.spawnCooldown -= dt;
    if (game.spawnQueue.length > 0 && game.spawnCooldown <= 0) {
      spawnEnemyFromQueue();
      game.spawnCooldown = game.spawnInterval;
    }

    if (game.spawnQueue.length === 0 && enemies.length === 0) {
      game.waveActive = false;
      game.autoWaveTimer = game.autoWaveEnabled ? 2.8 : 0;
      const bounty = 24 + game.wave * 3;
      let cleanWaveIncome = false;
      if (game.duelMode) {
        for (const state of game.players) {
          state.gold += bounty;
          state.score += 120 + game.wave * 30;
          if (game.wave % 4 === 0) {
            state.lives = Math.min(30, state.lives + 1);
          }
          // Clean-wave recovery: leaked income comes back one point per perfect wave.
          if (!state.leakedThisWave && state.income < 25) {
            state.income += 1;
          }
          state.leakedThisWave = false;
        }
      } else {
        game.gold += bounty;
        game.score += 120 + game.wave * 30;
        if (game.wave % 4 === 0) {
          game.lives = Math.min(30, game.lives + 1);
        }
        if (!game.leakedThisWave && game.income < 25) {
          game.income += 1;
          cleanWaveIncome = true;
        }
        game.leakedThisWave = false;
      }
      const autoText = game.autoWaveEnabled ? " Auto next in 2.8s." : "";
      const incomeText = cleanWaveIncome ? " Clean wave: +1 income." : "";
      status(`Wave ${game.wave} (${game.waveTag}) cleared. Bonus +${bounty}g.${incomeText}${autoText}`);
      playSfx("clear");
      syncActiveToLegacyIfDuel();
      saveRun(false);
    }
  }

  if (!game.waveActive && !game.gameOver && game.autoWaveEnabled && game.autoWaveTimer > 0) {
    game.autoWaveTimer = Math.max(0, game.autoWaveTimer - dt);
    if (game.autoWaveTimer <= 0) {
      startWave();
    }
  }

  for (const tower of towers) {
    tower.update(dt);
  }

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    projectiles[i].update(dt);
    if (projectiles[i].dead) {
      projectiles.splice(i, 1);
    }
  }

  for (let i = areaEffects.length - 1; i >= 0; i -= 1) {
    if (areaEffects[i].update(dt)) {
      areaEffects.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.update(dt);

    if (enemy.leaked) {
      enemies.splice(i, 1);
      const defender = getEnemyDefenderState(enemy);
      defender.lives -= enemy.leakDamage;
      // Floor at 1 so a bad early wave can never permanently kill the economy.
      defender.income = Math.max(1, defender.income - enemy.leakDamage);
      defender.leakedThisWave = true;
      status(
        game.duelMode
          ? `${enemy.name} leaked vs P${getEnemyLane(enemy) + 1}. Lives: ${defender.lives}. Income: ${defender.income}`
          : `${enemy.name} leaked through. Lives: ${defender.lives}. Income: ${defender.income}`
      );
      playSfx("leak");
      game.shake = Math.max(game.shake, 5);

      if (defender.lives <= 0) {
        defender.lives = 0;
        game.gameOver = true;
        if (game.duelMode) {
          const winner = getEnemyLane(enemy) === 0 ? 2 : 1;
          status(`P${winner} wins on wave ${game.wave}.`);
          game.score = game.players[0].score + game.players[1].score;
        } else {
          status(`Defeat on wave ${game.wave}.`);
        }
        syncActiveToLegacyIfDuel();
        recordHighScore();
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i -= 1) {
    if (effects[i].update(dt)) {
      effects.splice(i, 1);
    }
  }

  game.shake = Math.max(0, game.shake - dt * 12);

  game.autoSaveTimer += dt;
  if (game.autoSaveTimer >= 5) {
    game.autoSaveTimer = 0;
    saveRun(false);
  }
}

export function render() {
  ctx.save();
  if (game.shake > 0) {
    const offsetX = (Math.random() * 2 - 1) * game.shake;
    const offsetY = (Math.random() * 2 - 1) * game.shake;
    ctx.translate(offsetX, offsetY);
  }
  applyCameraTransform();

  drawBoard();

  for (const tower of towers) {
    drawTower(tower);
  }

  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  for (const projectile of projectiles) {
    drawProjectile(projectile);
  }

  for (const areaEffect of areaEffects) {
    drawAreaEffect(areaEffect);
  }

  for (const effect of effects) {
    drawEffect(effect);
  }

  ctx.restore();

  drawOverlay();
}
export let previousTime = performance.now();
export function tick(now) {
  const dtRaw = (now - previousTime) / 1000;
  previousTime = now;
  const dtFrame = Math.min(0.033, Math.max(0, dtRaw));
  let dtScaled = dtFrame * SPEED_LEVELS[game.speedIndex];
  while (dtScaled > 0.00001) {
    const step = Math.min(0.033, dtScaled);
    update(step);
    dtScaled -= step;
  }
  render();
  syncUi();

  requestAnimationFrame(tick);
}

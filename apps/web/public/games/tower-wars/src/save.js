import { setSelectedType } from "./build.js";
import { clampCamera } from "./camera.js";
import { COMMAND_TABS, RUN_SAVE_KEY, SPEED_LEVELS } from "./constants.js";
import { menuOverlayEl } from "./dom.js";
import { Enemy } from "./enemies.js";
import { rebuildMazeDistances } from "./maze.js";
import { AreaEffect } from "./projectiles.js";
import { areaEffects, buffZones, createPlayerState, effects, enemies, game, projectiles, syncLegacyEconomyFromActive, towers } from "./state.js";
import { status } from "./status.js";
import { Tower } from "./towers.js";

export function getRunSnapshot() {
  return {
    game: {
      mode: game.mode,
      duelMode: game.duelMode,
      activePlayer: game.activePlayer,
      gold: game.gold,
      income: game.income,
      incomeTimer: game.incomeTimer,
      incomeInterval: game.incomeInterval,
      sendQueue: game.sendQueue,
      lives: game.lives,
      wave: game.wave,
      score: game.score,
      waveActive: game.waveActive,
      spawnQueue: game.spawnQueue,
      spawnCooldown: game.spawnCooldown,
      spawnInterval: game.spawnInterval,
      waveTag: game.waveTag,
      selectedType: game.selectedType,
      commandTab: game.commandTab,
      paused: game.paused,
      speedIndex: game.speedIndex,
      autoWaveEnabled: game.autoWaveEnabled,
      autoWaveTimer: game.autoWaveTimer,
      gameOver: game.gameOver,
      message: game.message,
      scoreRecorded: game.scoreRecorded,
      runMs: game.runMs,
      runSubmitted: game.runSubmitted,
      players: game.players,
    },
    towers: towers.map((tower) => tower.serialize()),
    enemies: enemies.map((enemy) => enemy.serialize()),
    areaEffects: areaEffects.map((fx) => ({
      x: fx.x,
      y: fx.y,
      radius: fx.radius,
      duration: fx.duration,
      interval: fx.interval,
      damage: fx.damage,
      damageType: fx.damageType,
      slowFactor: fx.slowFactor,
      slowDuration: fx.slowDuration,
      color: fx.color,
      life: fx.life,
      tick: fx.tick,
    })),
    buffZones: buffZones.map((zone) => ({ ...zone })),
  };
}

export function saveRun(showMessage = true) {
  try {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(getRunSnapshot()));
    if (showMessage) {
      status("Run saved.");
    }
  } catch {
    if (showMessage) {
      status("Save failed (storage unavailable).");
    }
  }
}

export function loadRun(showMessage = true) {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) {
      if (showMessage) {
        status("No saved run found.");
      }
      return false;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.game || !Array.isArray(parsed.towers) || !Array.isArray(parsed.enemies)) {
      if (showMessage) {
        status("Save data is invalid.");
      }
      return false;
    }

    towers.length = 0;
    enemies.length = 0;
    projectiles.length = 0;
    effects.length = 0;
    areaEffects.length = 0;
    buffZones.length = 0;

    game.gold = parsed.game.gold !== undefined ? parsed.game.gold : 230;
    game.income = parsed.game.income !== undefined ? parsed.game.income : 2;
    game.incomeTimer = parsed.game.incomeTimer !== undefined ? parsed.game.incomeTimer : 0;
    game.incomeInterval = parsed.game.incomeInterval !== undefined ? parsed.game.incomeInterval : 10;
    game.sendQueue = Array.isArray(parsed.game.sendQueue) ? parsed.game.sendQueue : [];
    game.lives = parsed.game.lives !== undefined ? parsed.game.lives : 20;
    game.wave = parsed.game.wave;
    game.score = parsed.game.score !== undefined ? parsed.game.score : 0;
    game.waveActive = parsed.game.waveActive;
    game.spawnQueue = parsed.game.spawnQueue || [];
    game.spawnCooldown = parsed.game.spawnCooldown;
    game.spawnInterval = parsed.game.spawnInterval;
    game.waveTag = parsed.game.waveTag;
    game.selectedType = parsed.game.selectedType || "arrow";
    game.commandTab = COMMAND_TABS.includes(parsed.game.commandTab) ? parsed.game.commandTab : "build";
    game.mode = parsed.game.mode === "maze" ? "maze" : parsed.game.mode === "duel" ? "duel" : "classic";
    game.duelMode = game.mode === "duel" || !!parsed.game.duelMode;
    if (game.duelMode && game.mode !== "duel") {
      game.mode = "duel";
    }
    game.activePlayer = parsed.game.activePlayer === 1 ? 1 : 0;
    game.paused = !!parsed.game.paused;
    game.menuOpen = false;
    game.speedIndex = Math.max(0, Math.min(SPEED_LEVELS.length - 1, parsed.game.speedIndex || 0));
    game.autoWaveEnabled = parsed.game.autoWaveEnabled !== undefined ? !!parsed.game.autoWaveEnabled : true;
    game.autoWaveTimer = Math.max(0, parsed.game.autoWaveTimer || 0);
    game.gameOver = !!parsed.game.gameOver;
    game.message = parsed.game.message || "Run loaded.";
    game.scoreRecorded = !!parsed.game.scoreRecorded;
    game.runMs = parsed.game.runMs || 0;
    game.runSubmitted = !!parsed.game.runSubmitted;
    game.players = [createPlayerState(0), createPlayerState(1)];
    if (Array.isArray(parsed.game.players) && parsed.game.players.length >= 2) {
      for (let i = 0; i < 2; i += 1) {
        const saved = parsed.game.players[i] || {};
        game.players[i] = {
          id: i,
          gold: saved.gold !== undefined ? saved.gold : 230,
          lives: saved.lives !== undefined ? saved.lives : 20,
          score: saved.score !== undefined ? saved.score : 0,
          income: saved.income !== undefined ? saved.income : 2,
          incomeTimer: saved.incomeTimer !== undefined ? saved.incomeTimer : 0,
          incomeInterval: saved.incomeInterval !== undefined ? saved.incomeInterval : 10,
          sendQueue: Array.isArray(saved.sendQueue) ? saved.sendQueue : [],
        };
      }
    } else if (game.duelMode) {
      game.players = [createPlayerState(0), createPlayerState(1)];
    }

    for (const towerData of parsed.towers) {
      towers.push(Tower.fromSave(towerData));
    }
    for (const enemyData of parsed.enemies) {
      enemies.push(Enemy.fromSave(enemyData));
    }
    for (const fxData of parsed.areaEffects || []) {
      const fx = new AreaEffect(fxData);
      fx.life = fxData.life || 0;
      fx.tick = fxData.tick || 0;
      areaEffects.push(fx);
    }
    for (const zone of parsed.buffZones || []) {
      buffZones.push({ ...zone });
    }

    game.selectedTower = null;
    syncLegacyEconomyFromActive();
    setSelectedType(game.selectedType);
    rebuildMazeDistances();
    clampCamera();
    if (menuOverlayEl) {
      menuOverlayEl.classList.add("hidden");
      menuOverlayEl.setAttribute("aria-hidden", "true");
    }
    status(showMessage ? "Run loaded." : game.message);
    return true;
  } catch {
    if (showMessage) {
      status("Load failed.");
    }
    return false;
  }
}

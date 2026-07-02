import { playSfx } from "./audio.js";
import { setSelectedType } from "./build.js";
import { camera, clampCamera, getFitZoom } from "./camera.js";
import { HEIGHT, SPEED_LEVELS, WIDTH } from "./constants.js";
import { menuOverlayEl } from "./dom.js";
import { rebuildMazeDistances } from "./maze.js";
import { saveRun } from "./save.js";
import { consumeSendQueueForWave } from "./sends.js";
import { areaEffects, buffZones, createPlayerState, effects, enemies, game, getPlayerState, projectiles, syncActiveToLegacyIfDuel, syncLegacyEconomyFromActive, towers } from "./state.js";
import { status } from "./status.js";
import { buildDuelWavePlan, buildWavePlan } from "./waves.js";

export function startWave() {
  if (game.gameOver) {
    status("Defeat. Start a new run or load a save.");
    return;
  }

  if (game.waveActive) {
    status(`Wave ${game.wave} is already running.`);
    return;
  }

  if (game.mode === "maze") {
    const reachable = rebuildMazeDistances();
    if (!reachable) {
      status("Maze path is blocked. Open a route before starting the wave.");
      return;
    }
  }

  game.wave += 1;
  const plan = game.mode === "duel" ? buildDuelWavePlan(game.wave) : buildWavePlan(game.wave);
  let sendText = "";

  if (game.mode === "duel") {
    const p1Injection = consumeSendQueueForWave(getPlayerState(0), game.wave, 1);
    const p2Injection = consumeSendQueueForWave(getPlayerState(1), game.wave, 0);
    if (p1Injection.units.length > 0 || p2Injection.units.length > 0) {
      plan.tag = `${plan.tag} + Sends`;
    }
    plan.queue.push(...p1Injection.units, ...p2Injection.units);
    const parts = [];
    if (p1Injection.units.length > 0) {
      parts.push(`P1->P2 ${p1Injection.summary}`);
    }
    if (p2Injection.units.length > 0) {
      parts.push(`P2->P1 ${p2Injection.summary}`);
    }
    if (parts.length > 0) {
      sendText = ` Sends: ${parts.join(" | ")}.`;
    }
  } else {
    const sendInjection = consumeSendQueueForWave(game, game.wave, 0);
    if (sendInjection.units.length > 0) {
      plan.queue.push(...sendInjection.units);
      plan.tag = `${plan.tag} + Sends`;
      sendText = ` Includes sends: ${sendInjection.summary}.`;
    }
  }

  game.waveTag = plan.tag;
  game.spawnQueue = plan.queue;
  game.spawnInterval = plan.interval;
  game.spawnCooldown = 0;
  game.waveActive = true;
  game.autoWaveTimer = 0;

  status(`Wave ${game.wave} (${plan.tag}) started. ${game.spawnQueue.length} enemies incoming.${sendText}`);
  playSfx("wave");
  syncActiveToLegacyIfDuel();
  saveRun(false);
}

export function toggleAutoWave() {
  game.autoWaveEnabled = !game.autoWaveEnabled;
  game.autoWaveTimer = 0;
  status(game.autoWaveEnabled ? "Auto-next wave enabled." : "Auto-next wave disabled.");
  saveRun(false);
}

export function setGameMode(mode) {
  if (mode !== "classic" && mode !== "maze" && mode !== "duel") {
    return;
  }
  if (game.mode === mode) {
    return;
  }

  const hadProgress = game.wave > 0 || towers.length > 0 || enemies.length > 0 || game.waveActive;
  game.mode = mode;
  game.duelMode = mode === "duel";
  game.activePlayer = 0;
  resetRun({ keepMode: true, keepAutoWave: true });
  rebuildMazeDistances();
  saveRun(false);

  const modeLabel = mode === "maze" ? "Maze" : mode === "duel" ? "Duel" : "Classic";
  if (hadProgress) {
    status(`Switched to ${modeLabel} mode. New run started.`);
  } else {
    status(`${modeLabel} mode ready.`);
  }
}

export function setActivePlayer(id) {
  if (!game.duelMode) {
    return;
  }
  game.activePlayer = id === 1 ? 1 : 0;
  syncLegacyEconomyFromActive();
  if (game.selectedTower && game.selectedTower.owner !== game.activePlayer) {
    game.selectedTower = null;
  }
  status(`Active controls: P${game.activePlayer + 1}.`);
}

export function resetRun(options = {}) {
  game.runMs = 0;
  game.runSubmitted = false;
  const keepMode = options.keepMode !== undefined ? !!options.keepMode : true;
  const keepAutoWave = options.keepAutoWave !== undefined ? !!options.keepAutoWave : false;
  const modeValue = keepMode ? game.mode : "classic";
  const duelValue = modeValue === "duel";
  const autoWaveValue = keepAutoWave ? game.autoWaveEnabled : true;

  towers.length = 0;
  enemies.length = 0;
  projectiles.length = 0;
  effects.length = 0;
  areaEffects.length = 0;
  buffZones.length = 0;

  game.players = [createPlayerState(0), createPlayerState(1)];
  game.activePlayer = 0;
  game.duelMode = duelValue;
  game.gold = 230;
  game.income = 2;
  game.incomeTimer = 0;
  game.incomeInterval = 10;
  game.sendQueue = [];
  game.lives = 20;
  game.wave = 0;
  game.score = 0;
  game.waveActive = false;
  game.spawnQueue = [];
  game.spawnCooldown = 0;
  game.spawnInterval = 0.8;
  game.waveTag = "";
  game.mode = modeValue;
  game.selectedType = "arrow";
  game.commandTab = "build";
  game.selectedTower = null;
  game.hoverCell = null;
  game.hoverEnemy = null;
  game.gameOver = false;
  game.scoreRecorded = false;
  game.paused = false;
  game.menuOpen = false;
  game.speedIndex = 0;
  game.autoWaveEnabled = autoWaveValue;
  game.autoWaveTimer = 0;
  game.message = "Build towers and send wave 1.";
  game.shake = 0;
  game.autoSaveTimer = 0;
  syncLegacyEconomyFromActive();
  camera.x = WIDTH / 2;
  camera.y = HEIGHT / 2;
  camera.zoom = getFitZoom();
  clampCamera();
  if (menuOverlayEl) {
    menuOverlayEl.classList.add("hidden");
    menuOverlayEl.setAttribute("aria-hidden", "true");
  }

  rebuildMazeDistances();
  setSelectedType(game.selectedType);
  status(game.message);
}

export function openMenu() {
  if (!menuOverlayEl || game.menuOpen) {
    return;
  }
  game.menuOpen = true;
  game.paused = true;
  menuOverlayEl.classList.remove("hidden");
  menuOverlayEl.setAttribute("aria-hidden", "false");
  status("Menu opened.");
}

export function closeMenu(options = {}) {
  const resume = options.resume !== undefined ? !!options.resume : true;
  const silent = !!options.silent;
  if (!menuOverlayEl || !game.menuOpen) {
    return;
  }
  game.menuOpen = false;
  menuOverlayEl.classList.add("hidden");
  menuOverlayEl.setAttribute("aria-hidden", "true");
  if (resume && !game.gameOver) {
    game.paused = false;
  }
  if (!silent) {
    status(game.paused ? "Game paused." : "Game resumed.");
  }
}

export function restartRun() {
  resetRun();
  saveRun(false);
  status("New run started.");
}

export function togglePause() {
  if (game.menuOpen) {
    closeMenu({ resume: true, silent: true });
  }
  if (game.gameOver) {
    return;
  }
  game.paused = !game.paused;
  status(game.paused ? "Game paused." : "Game resumed.");
}

export function cycleSpeed() {
  game.speedIndex = (game.speedIndex + 1) % SPEED_LEVELS.length;
  status(`Game speed set to ${SPEED_LEVELS[game.speedIndex]}x.`);
}

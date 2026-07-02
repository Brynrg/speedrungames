import { SPEED_LEVELS } from "./constants.js";
import { autoWaveBtn, bestEl, duelActiveEl, duelBoardBodyEl, duelBoardCardEl, duelP1Btn, duelP1El, duelP2Btn, duelP2El, duelPlayerSwitchEl, duelStatsEl, goldEl, incomeEl, incomeTickEl, livesEl, menuBtn, modeClassicBtn, modeDuelBtn, modeMazeBtn, nextWaveBtn, pauseGameBtn, quickModeEl, quickSendsEl, quickStateEl, quickWaveTagEl, scoreEl, speedBtn, speedEl, speedGameBtn, waveEl } from "./dom.js";
import { drawMiniMap } from "./minimap.js";
import { highScores } from "./scores.js";
import { updateSelectionPanel } from "./selection.js";
import { updateSendUi } from "./sends.js";
import { game, getActivePlayerState, syncLegacyEconomyFromActive } from "./state.js";
import { setCommandTab } from "./tooltip.js";

export function syncUi() {
  setCommandTab(game.commandTab);

  if (game.duelMode) {
    syncLegacyEconomyFromActive();
    game.score = game.players[0].score + game.players[1].score;
    game.lives = getActivePlayerState().lives;
    game.income = getActivePlayerState().income;
    game.incomeTimer = getActivePlayerState().incomeTimer;
    game.incomeInterval = getActivePlayerState().incomeInterval;
  }

  goldEl.textContent = String(Math.floor(game.gold));
  livesEl.textContent = String(Math.floor(game.lives));
  waveEl.textContent = String(game.wave);
  scoreEl.textContent = String(Math.floor(game.score));

  const bestWave = highScores[0]?.wave || game.bestWave || 0;
  game.bestWave = bestWave;
  if (bestEl) {
    bestEl.textContent = `W${bestWave}`;
  }

  if (speedEl) {
    speedEl.textContent = `${SPEED_LEVELS[game.speedIndex]}x`;
  }
  incomeEl.textContent = String(Math.floor(game.income));
  if (incomeTickEl) {
    incomeTickEl.textContent = `${Math.max(0, game.incomeInterval - game.incomeTimer).toFixed(1)}s`;
  }
  pauseGameBtn.textContent = game.paused ? "Resume (P)" : "Pause (P)";
  speedGameBtn.textContent = `Speed ${SPEED_LEVELS[game.speedIndex]}x (T)`;
  if (speedBtn) {
    speedBtn.title = `Click to change game speed (1x-5x). Current: ${SPEED_LEVELS[game.speedIndex]}x.`;
  }
  if (nextWaveBtn) {
    const nextWaveLocked = game.gameOver || game.waveActive || game.menuOpen;
    nextWaveBtn.disabled = nextWaveLocked;
    nextWaveBtn.querySelector("strong").textContent = nextWaveLocked ? "Locked" : "Start";
  }
  if (menuBtn) {
    menuBtn.classList.toggle("active", game.menuOpen);
  }
  if (quickModeEl) {
    const modeLabel = game.mode === "maze" ? "Maze" : game.mode === "duel" ? "Duel" : "Classic";
    quickModeEl.textContent = modeLabel;
  }
  if (quickStateEl) {
    let stateLabel = "Build";
    if (game.gameOver) {
      stateLabel = game.duelMode ? "Match End" : "Defeat";
    } else if (game.menuOpen || game.paused) {
      stateLabel = "Paused";
    } else if (game.waveActive) {
      stateLabel = "Combat";
    }
    quickStateEl.textContent = stateLabel;
  }
  if (quickWaveTagEl) {
    quickWaveTagEl.textContent = game.waveTag || "-";
  }
  if (quickSendsEl) {
    const queueState = game.duelMode ? getActivePlayerState() : game;
    const queued = Array.isArray(queueState.sendQueue) ? queueState.sendQueue.length : 0;
    quickSendsEl.textContent = String(queued);
  }
  autoWaveBtn.textContent = game.autoWaveEnabled ? "Auto: On (A)" : "Auto: Off (A)";
  modeClassicBtn.classList.toggle("active", game.mode === "classic");
  modeMazeBtn.classList.toggle("active", game.mode === "maze");
  modeDuelBtn.classList.toggle("active", game.mode === "duel");
  modeClassicBtn.textContent = game.mode === "classic" ? "Mode: Classic *" : "Mode: Classic";
  modeMazeBtn.textContent = game.mode === "maze" ? "Mode: Maze *" : "Mode: Maze";
  modeDuelBtn.textContent = game.mode === "duel" ? "Mode: Duel *" : "Mode: Duel";

  if (game.duelMode) {
    duelStatsEl.classList.remove("hidden");
    duelPlayerSwitchEl.classList.remove("hidden");
    duelP1El.textContent = `G${Math.floor(game.players[0].gold)} | L${Math.floor(game.players[0].lives)} | I${Math.floor(game.players[0].income)} | S${Math.floor(game.players[0].score)}`;
    duelP2El.textContent = `G${Math.floor(game.players[1].gold)} | L${Math.floor(game.players[1].lives)} | I${Math.floor(game.players[1].income)} | S${Math.floor(game.players[1].score)}`;
    duelActiveEl.textContent = `P${game.activePlayer + 1}`;
    duelP1Btn.classList.toggle("active", game.activePlayer === 0);
    duelP2Btn.classList.toggle("active", game.activePlayer === 1);
  } else {
    duelStatsEl.classList.add("hidden");
    duelPlayerSwitchEl.classList.add("hidden");
    duelP1Btn.classList.remove("active");
    duelP2Btn.classList.remove("active");
  }
  if (duelBoardCardEl && duelBoardBodyEl) {
    duelBoardCardEl.classList.toggle("hidden", !game.duelMode);
    if (game.duelMode) {
      duelBoardBodyEl.innerHTML = `
        <tr><td>P1</td><td>${Math.floor(game.players[0].lives)}</td><td>${Math.floor(game.players[0].income)}</td><td>${Math.floor(game.players[0].score)}</td></tr>
        <tr><td>P2</td><td>${Math.floor(game.players[1].lives)}</td><td>${Math.floor(game.players[1].income)}</td><td>${Math.floor(game.players[1].score)}</td></tr>
      `;
    }
  }

  updateSelectionPanel();
  updateSendUi();
  drawMiniMap();
}

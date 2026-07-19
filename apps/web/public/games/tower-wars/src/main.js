import { ensureAudioActive } from "./audio.js";
import { castSelectedAbility, chooseBranch, sellSelectedTower, setSelectedType, tryUpgradeSelectedTower } from "./build.js";
import { clampCamera, keyState, resizeCanvasToViewport } from "./camera.js";
import { HOME_URL } from "./constants.js";
import { autoWaveBtn, branchAButton, branchBButton, canvas, castAbilityBtn, clearSendsBtn, commandTabButtons, duelP1Btn, duelP2Btn, loadRunBtn, menuBtn, menuHomeBtn, menuOverlayEl, menuRestartBtn, menuResumeBtn, miniMapEl, modeClassicBtn, modeDuelBtn, modeMazeBtn, newRunBtn, nextWaveBtn, pauseGameBtn, saveRunBtn, sendAirBtn, sendArmorBtn, sendBreakerBtn, sendMiniBossBtn, sendRunnerBtn, sendSplitterBtn, speedBtn, speedGameBtn, startWaveBtn, towerButtons, upgradeTowerBtn, sellTowerBtn, defeatNewRunBtn, defeatLoadRunBtn, defeatHomeBtn, collapseLeftBtn, collapseRightBtn } from "./dom.js";
import { runStartupGuardrails } from "./guardrails.js";
import { handleBoardClick, handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasMove, handleCanvasWheel } from "./input.js";
import { closeMenu, cycleSpeed, openMenu, restartRun, setActivePlayer, setGameMode, startWave, toggleAutoWave, togglePause } from "./lifecycle.js";
import { tick } from "./loop.js";
import { handleMiniMapPointer, resizeMiniMapCanvas } from "./minimap.js";
import { loadRun, saveRun } from "./save.js";
import { renderHighScores } from "./scores.js";
import { clearSendQueue, queueSend } from "./sends.js";
import { game } from "./state.js";
import { status } from "./status.js";
import { defaultTooltip, getButtonTooltip, setCommandTab, setTooltip } from "./tooltip.js";
import { bindTouchInput } from "./touch.js";
import { TOWER_DATA } from "./towers.js";
import { syncUi } from "./ui-sync.js";

export function bindEvents() {
  canvas.addEventListener("mousemove", handleCanvasMove);
  canvas.addEventListener("mousedown", handleCanvasMouseDown);
  canvas.addEventListener("mouseup", handleCanvasMouseUp);
  canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  canvas.addEventListener("mouseleave", () => {
    handleCanvasMouseUp();
    game.hoverCell = null;
    game.hoverEnemy = null;
    setTooltip(defaultTooltip());
  });
  canvas.addEventListener("click", handleBoardClick);
  bindTouchInput();
  if (miniMapEl) {
    miniMapEl.addEventListener("pointerdown", handleMiniMapPointer);
  }
  for (const tabBtn of commandTabButtons) {
    tabBtn.addEventListener("click", () => {
      setCommandTab(tabBtn.dataset.commandTab);
    });
  }

  if (nextWaveBtn) {
    nextWaveBtn.addEventListener("click", () => {
      ensureAudioActive();
      setCommandTab("wave");
      startWave();
    });
  }
  if (speedBtn) {
    speedBtn.addEventListener("click", () => {
      ensureAudioActive();
      cycleSpeed();
    });
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      ensureAudioActive();
      openMenu();
    });
  }

  startWaveBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("wave");
    startWave();
  });
  pauseGameBtn.addEventListener("click", () => {
    ensureAudioActive();
    togglePause();
  });
  speedGameBtn.addEventListener("click", () => {
    ensureAudioActive();
    cycleSpeed();
  });
  autoWaveBtn.addEventListener("click", () => {
    ensureAudioActive();
    toggleAutoWave();
  });
  modeClassicBtn.addEventListener("click", () => {
    ensureAudioActive();
    setGameMode("classic");
  });
  modeMazeBtn.addEventListener("click", () => {
    ensureAudioActive();
    setGameMode("maze");
  });
  modeDuelBtn.addEventListener("click", () => {
    ensureAudioActive();
    setGameMode("duel");
  });
  duelP1Btn.addEventListener("click", () => {
    ensureAudioActive();
    setActivePlayer(0);
  });
  duelP2Btn.addEventListener("click", () => {
    ensureAudioActive();
    setActivePlayer(1);
  });

  sendRunnerBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("runner");
  });
  sendArmorBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("armor");
  });
  sendAirBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("air");
  });
  sendBreakerBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("breaker");
  });
  sendSplitterBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("splitter");
  });
  sendMiniBossBtn.addEventListener("click", () => {
    ensureAudioActive();
    setCommandTab("send");
    queueSend("miniboss");
  });
  clearSendsBtn.addEventListener("click", () => {
    ensureAudioActive();
    clearSendQueue();
  });

  upgradeTowerBtn.addEventListener("click", () => {
    ensureAudioActive();
    tryUpgradeSelectedTower();
  });
  castAbilityBtn.addEventListener("click", () => {
    ensureAudioActive();
    castSelectedAbility();
  });
  if (sellTowerBtn) {
    sellTowerBtn.addEventListener("click", () => {
      ensureAudioActive();
      sellSelectedTower();
    });
  }
  branchAButton.addEventListener("click", () => {
    ensureAudioActive();
    chooseBranch("a");
  });
  branchBButton.addEventListener("click", () => {
    ensureAudioActive();
    chooseBranch("b");
  });

  saveRunBtn.addEventListener("click", () => {
    ensureAudioActive();
    saveRun(true);
  });
  loadRunBtn.addEventListener("click", () => {
    ensureAudioActive();
    loadRun(true);
  });
  newRunBtn.addEventListener("click", () => {
    ensureAudioActive();
    restartRun();
  });
  if (menuResumeBtn) {
    menuResumeBtn.addEventListener("click", () => {
      ensureAudioActive();
      closeMenu({ resume: true });
    });
  }
  if (menuRestartBtn) {
    menuRestartBtn.addEventListener("click", () => {
      ensureAudioActive();
      closeMenu({ resume: false, silent: true });
      restartRun();
    });
  }
  if (menuHomeBtn) {
    menuHomeBtn.addEventListener("click", () => {
      window.location.href = HOME_URL;
    });
  }
  if (menuOverlayEl) {
    menuOverlayEl.addEventListener("click", (event) => {
      if (event.target === menuOverlayEl) {
        closeMenu({ resume: true });
      }
    });
  }
  if (defeatNewRunBtn) {
    defeatNewRunBtn.addEventListener("click", () => {
      ensureAudioActive();
      restartRun();
    });
  }
  if (defeatLoadRunBtn) {
    defeatLoadRunBtn.addEventListener("click", () => {
      ensureAudioActive();
      loadRun();
    });
  }
  if (defeatHomeBtn) {
    defeatHomeBtn.addEventListener("click", () => {
      window.location.href = HOME_URL;
    });
  }
  const bindCollapse = (btn, expandGlyph, collapseGlyph) => {
    if (!btn) {
      return;
    }
    btn.addEventListener("click", () => {
      const panel = btn.parentElement;
      const collapsed = panel.classList.toggle("collapsed");
      btn.innerHTML = collapsed ? expandGlyph : collapseGlyph;
      resizeCanvasToViewport();
    });
  };
  bindCollapse(collapseLeftBtn, "&#10095;", "&#10094;");
  bindCollapse(collapseRightBtn, "&#10094;", "&#10095;");

  for (const button of towerButtons) {
    button.addEventListener("click", () => {
      ensureAudioActive();
      setCommandTab("build");
      setSelectedType(button.dataset.type);
      status(`${TOWER_DATA[button.dataset.type].name} selected for building.`);
    });
  }

  const allButtons = [...document.querySelectorAll("button")];
  for (const button of allButtons) {
    button.addEventListener("mouseenter", () => {
      setTooltip(getButtonTooltip(button));
    });
    button.addEventListener("mouseleave", () => {
      setTooltip(defaultTooltip());
    });
    button.addEventListener("focus", () => {
      setTooltip(getButtonTooltip(button));
    });
    button.addEventListener("blur", () => {
      setTooltip(defaultTooltip());
    });
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (game.menuOpen) {
      if (key === "escape" || key === "p") {
        event.preventDefault();
        closeMenu({ resume: true });
      }
      return;
    }
    if (key === "arrowleft") {
      keyState.left = true;
      event.preventDefault();
    }
    if (key === "arrowright") {
      keyState.right = true;
      event.preventDefault();
    }
    if (key === "arrowup") {
      keyState.up = true;
      event.preventDefault();
    }
    if (key === "arrowdown") {
      keyState.down = true;
      event.preventDefault();
    }

    if (key === "1") {
      setCommandTab("build");
      setSelectedType("arrow");
    }
    if (key === "2") {
      setCommandTab("build");
      setSelectedType("frost");
    }
    if (key === "3") {
      setCommandTab("build");
      setSelectedType("cannon");
    }
    if (key === "4") {
      setCommandTab("build");
      setSelectedType("arcane");
    }
    if (key === "5") {
      setCommandTab("build");
      setSelectedType("venom");
    }
    if (key === "0") {
      setCommandTab("build");
      setSelectedType("mortar");
    }
    if (key === "-") {
      setCommandTab("build");
      setSelectedType("obelisk");
    }
    if (key === "u") {
      event.preventDefault();
      tryUpgradeSelectedTower();
    }
    if (key === "s") {
      event.preventDefault();
      sellSelectedTower();
    }
    if (key === "f") {
      event.preventDefault();
      castSelectedAbility();
    }
    if (key === "p") {
      event.preventDefault();
      togglePause();
    }
    if (key === "t") {
      event.preventDefault();
      cycleSpeed();
    }
    if (key === "a") {
      event.preventDefault();
      toggleAutoWave();
    }
    if (key === "m") {
      event.preventDefault();
      if (game.mode === "classic") {
        setGameMode("maze");
      } else if (game.mode === "maze") {
        setGameMode("duel");
      } else {
        setGameMode("classic");
      }
    }
    if (event.code === "Tab" && game.duelMode) {
      event.preventDefault();
      setActivePlayer(game.activePlayer === 0 ? 1 : 0);
    }
    if (event.code === "Space") {
      event.preventDefault();
      setCommandTab("wave");
      startWave();
    }
  });

  window.addEventListener("pointerdown", () => {
    ensureAudioActive();
  });
  window.addEventListener("resize", () => {
    resizeCanvasToViewport();
    resizeMiniMapCanvas();
  });
  window.addEventListener("mouseup", handleCanvasMouseUp);
  window.addEventListener("blur", () => {
    handleCanvasMouseUp();
    keyState.left = false;
    keyState.right = false;
    keyState.up = false;
    keyState.down = false;
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft") {
      keyState.left = false;
    }
    if (key === "arrowright") {
      keyState.right = false;
    }
    if (key === "arrowup") {
      keyState.up = false;
    }
    if (key === "arrowdown") {
      keyState.down = false;
    }
  });
}

export function boot() {
  resizeCanvasToViewport();
  resizeMiniMapCanvas();
  runStartupGuardrails();
  bindEvents();
  setCommandTab(game.commandTab, true);
  clampCamera();
  setSelectedType(game.selectedType);
  renderHighScores();

  const loaded = loadRun(false);
  if (!loaded) {
    status(game.message);
  }

  syncUi();
  setTooltip(defaultTooltip());
  requestAnimationFrame(tick);

  // The HUD/panel chrome sizes itself off Cinzel/Rajdhani metrics
  // (syncLayoutOffsets reads real getBoundingClientRect() heights). Those
  // web fonts can finish loading after the first layout pass, leaving the
  // board docked against a stale (pre-font) HUD height. Re-run once fonts
  // settle so the canvas — and therefore click-to-world mapping — lines up
  // with what's actually on screen.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => resizeCanvasToViewport()).catch(() => {});
  }
}

boot();

"use strict";

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

export const goldEl = document.getElementById("gold");
export const livesEl = document.getElementById("lives");
export const waveEl = document.getElementById("wave");
export const scoreEl = document.getElementById("score");
export const bestEl = document.getElementById("best");
export const speedEl = document.getElementById("speed");
export const incomeEl = document.getElementById("income");
export const incomeTickEl = document.getElementById("incomeTick");
export const nextWaveBtn = document.getElementById("nextWaveBtn");
export const speedBtn = document.getElementById("speedBtn");
export const menuBtn = document.getElementById("menuBtn");
export const waveStatusEl = document.getElementById("waveStatus");
export const tooltipBoxEl = document.getElementById("tooltipBox");
export const menuOverlayEl = document.getElementById("menuOverlay");
export const menuResumeBtn = document.getElementById("menuResume");
export const menuRestartBtn = document.getElementById("menuRestart");
export const menuHomeBtn = document.getElementById("menuHome");
export const defeatOverlayEl = document.getElementById("defeatOverlay");
export const defeatTitleEl = document.getElementById("defeatTitle");
export const defeatStatsEl = document.getElementById("defeatStats");
export const defeatNewRunBtn = document.getElementById("defeatNewRun");
export const defeatLoadRunBtn = document.getElementById("defeatLoadRun");
export const defeatHomeBtn = document.getElementById("defeatHome");
export const collapseLeftBtn = document.getElementById("collapseLeft");
export const collapseRightBtn = document.getElementById("collapseRight");
export const quickModeEl = document.getElementById("quickMode");
export const quickStateEl = document.getElementById("quickState");
export const quickWaveTagEl = document.getElementById("quickWaveTag");
export const quickSendsEl = document.getElementById("quickSends");
export const quickNextWaveEl = document.getElementById("quickNextWave");
export const wavePreviewEl = document.getElementById("wavePreview");
export const quickRunTimeEl = document.getElementById("quickRunTime");
export const miniMapEl = document.getElementById("miniMap");
export const miniMapCtx = miniMapEl ? miniMapEl.getContext("2d") : null;
export const duelBoardCardEl = document.getElementById("duelBoardCard");
export const duelBoardBodyEl = document.getElementById("duelBoardBody");

export const startWaveBtn = document.getElementById("startWave");
export const pauseGameBtn = document.getElementById("pauseGame");
export const speedGameBtn = document.getElementById("speedGame");
export const autoWaveBtn = document.getElementById("autoWave");
export const modeClassicBtn = document.getElementById("modeClassic");
export const modeMazeBtn = document.getElementById("modeMaze");
export const modeDuelBtn = document.getElementById("modeDuel");
export const saveRunBtn = document.getElementById("saveRun");
export const loadRunBtn = document.getElementById("loadRun");
export const newRunBtn = document.getElementById("newRun");
export const upgradeTowerBtn = document.getElementById("upgradeTower");
export const castAbilityBtn = document.getElementById("castAbility");
export const targetPriorityBtn = document.getElementById("targetPriority");
export const sellTowerBtn = document.getElementById("sellTower");
export const branchAButton = document.getElementById("branchA");
export const branchBButton = document.getElementById("branchB");
export const branchControlsEl = document.getElementById("branchControls");
export const highScoresEl = document.getElementById("highScores");

export const sendRunnerBtn = document.getElementById("sendRunner");
export const sendArmorBtn = document.getElementById("sendArmor");
export const sendAirBtn = document.getElementById("sendAir");
export const sendBreakerBtn = document.getElementById("sendBreaker");
export const sendSplitterBtn = document.getElementById("sendSplitter");
export const sendMiniBossBtn = document.getElementById("sendMiniBoss");
export const clearSendsBtn = document.getElementById("clearSends");
export const sendQueueEl = document.getElementById("sendQueue");
export const duelPlayerSwitchEl = document.getElementById("duelPlayerSwitch");
export const duelP1Btn = document.getElementById("duelP1Btn");
export const duelP2Btn = document.getElementById("duelP2Btn");
export const duelStatsEl = document.getElementById("duelStats");
export const duelP1El = document.getElementById("duelP1");
export const duelP2El = document.getElementById("duelP2");
export const duelActiveEl = document.getElementById("duelActive");

export const selectionNoneEl = document.getElementById("selectionNone");
export const selectionDetailsEl = document.getElementById("selectionDetails");
export const selTypeEl = document.getElementById("selType");
export const selLevelEl = document.getElementById("selLevel");
export const selDamageEl = document.getElementById("selDamage");
export const selDamageTypeEl = document.getElementById("selDamageType");
export const selRangeEl = document.getElementById("selRange");
export const selRateEl = document.getElementById("selRate");
export const selBranchEl = document.getElementById("selBranch");
export const selAuraEl = document.getElementById("selAura");
export const selKillsEl = document.getElementById("selKills");
export const selTitleEl = document.getElementById("selTitle");
export const selSubEl = document.getElementById("selSub");
export const towerButtons = [...document.querySelectorAll(".tower-btn")];
export const commandTabButtons = [...document.querySelectorAll(".command-tab")];
export const commandPanels = [...document.querySelectorAll(".command-panel")];
export const sendButtons = {
  runner: sendRunnerBtn,
  armor: sendArmorBtn,
  air: sendAirBtn,
  breaker: sendBreakerBtn,
  splitter: sendSplitterBtn,
  miniboss: sendMiniBossBtn,
};

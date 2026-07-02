import { ROWS } from "./constants.js";

export const game = {
  mode: "classic",
  duelMode: false,
  activePlayer: 0,
  gold: 230,
  lives: 20,
  wave: 0,
  score: 0,
  bestWave: 0,
  waveActive: false,
  spawnQueue: [],
  spawnCooldown: 0,
  spawnInterval: 0.8,
  waveTag: "",
  selectedType: "arrow",
  selectedTower: null,
  hoverCell: null,
  hoverEnemy: null,
  gameOver: false,
  scoreRecorded: false,
  paused: false,
  menuOpen: false,
  speedIndex: 0,
  autoWaveEnabled: true,
  autoWaveTimer: 0,
  commandTab: "build",
  income: 2,
  incomeTimer: 0,
  incomeInterval: 10,
  sendQueue: [],
  message: "Build towers and send wave 1.",
  shake: 0,
  autoSaveTimer: 0,
  runMs: 0,            // sim-time speedrun clock: first wave start -> wave-20 clear
  runSubmitted: false, // one leaderboard submit per run
  players: [],
};

export const towers = [];
export const enemies = [];
export const projectiles = [];
export const effects = [];
export const areaEffects = [];
export const buffZones = [];
export const statusBanners = [];

export function createPlayerState(id) {
  return {
    id,
    gold: 230,
    lives: 20,
    score: 0,
    income: 2,
    incomeTimer: 0,
    incomeInterval: 10,
    sendQueue: [],
  };
}

export function getPlayerState(id) {
  if (!game.duelMode) {
    return game;
  }
  return game.players[id] || game.players[0];
}

export function getActivePlayerState() {
  return getPlayerState(game.activePlayer);
}

export function getEnemyDefenderState(enemy) {
  if (!game.duelMode) {
    return game;
  }
  if (enemy.targetPlayer !== undefined) {
    return getPlayerState(enemy.targetPlayer);
  }
  return getPlayerState(enemy.lane || 0);
}

export function getEnemyLane(enemy) {
  if (!game.duelMode) {
    return 0;
  }
  if (enemy.targetPlayer !== undefined) {
    return enemy.targetPlayer;
  }
  return enemy.lane || 0;
}

export function getLaneOwnerForCell(cx, cy) {
  if (!game.duelMode) {
    return game.activePlayer || 0;
  }
  return cy < Math.floor(ROWS / 2) ? 0 : 1;
}

export function syncLegacyEconomyFromActive() {
  if (!game.duelMode) {
    return;
  }
  const active = getActivePlayerState();
  game.gold = active.gold;
  game.lives = active.lives;
  game.score = active.score;
  game.income = active.income;
  game.incomeTimer = active.incomeTimer;
  game.incomeInterval = active.incomeInterval;
  game.sendQueue = active.sendQueue;
}

export function syncActiveToLegacyIfDuel() {
  if (!game.duelMode) {
    return;
  }
  syncLegacyEconomyFromActive();
}

export const audio = {
  ctx: null,
  master: null,
  musicTimer: null,
  musicStep: 0,
  started: false,
  lastEvent: new Map(),
};

game.players = [createPlayerState(0), createPlayerState(1)];

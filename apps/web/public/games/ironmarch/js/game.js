import { TILE, VIEW_W, VIEW_H, FOW_UPDATE_MS, MAIN_HALL } from './constants.js';
import { clamp } from './util.js';
import { generateMap } from './map.js';
import { createFow, recomputeVisibility } from './fow.js';
import { spawnUnit, spawnBuilding, updateMovement, pruneDead } from './entities.js';
import { updateHarvesting, updateConstruction, updateProduction } from './economy.js';
import { updateCombat, updateProjectiles } from './combat.js';
import { updateAI, createAIState } from './ai.js';
import { updateMessages } from './messages.js';
import { updateCameraScroll } from './input.js';
import { updateVfx } from './vfx.js';
import { recordResult } from './save.js';
import { sfxVictory, sfxDefeat } from './sfx.js';

function spawnStartingBase(state, side, base) {
  const hallKey = MAIN_HALL[side];
  const farmKey = side === 'player' ? 'farm' : 'pigfarm';
  const workerKey = side === 'player' ? 'peasant' : 'peon';
  spawnBuilding(state, side, hallKey, base.townhall.x, base.townhall.y, { constructing: false });
  spawnBuilding(state, side, farmKey, base.farm.x, base.farm.y, { constructing: false });
  for (let i = 0; i < 3; i++) {
    spawnUnit(state, side, workerKey, base.townhall.x + i, base.townhall.y + 4);
  }
}

function buildState(map) {
  const state = {
    time: 0,
    entities: [],
    entitiesById: new Map(),
    resources: { player: { gold: 400, lumber: 200 }, enemy: { gold: 400, lumber: 200 } },
    food: { player: { used: 0, max: 0 }, enemy: { used: 0, max: 0 } },
    tech: { player: new Set(), enemy: new Set() },
    upgrades: { player: { weapon: 0, armor: 0 }, enemy: { weapon: 0, armor: 0 } },
    selection: [],
    controlGroups: {},
    camera: {
      x: clamp(map.playerBase.center.x * TILE - VIEW_W / 2, 0, map.width * TILE - VIEW_W),
      y: clamp(map.playerBase.center.y * TILE - VIEW_H / 2, 0, map.height * TILE - VIEW_H),
    },
    mode: 'playing',
    messages: [],
    placement: null,
    selectBox: null,
    projectiles: [],
    vfx: [],
    input: { keysDown: new Set(), mouseX: 0, mouseY: 0, overCanvas: false, dragStart: null },
    ai: null,
    fowTimer: 0,
  };
  state.ai = createAIState(map);
  spawnStartingBase(state, 'player', map.playerBase);
  spawnStartingBase(state, 'enemy', map.enemyBase);
  return state;
}

export function createGame() {
  const map = generateMap();
  const fow = createFow(map);
  const state = buildState(map);
  recomputeVisibility(fow, state, map);
  return { state, map, fow };
}

export function resetGame(session) {
  const fresh = createGame();
  Object.assign(session.state, fresh.state);
  Object.assign(session.map, fresh.map);
  Object.assign(session.fow, fresh.fow);
}

function checkWinLose(state) {
  if (state.mode !== 'playing') return;
  const playerHasBuildings = state.entities.some((e) => e.kind === 'building' && e.side === 'player' && !e.isDead);
  const enemyHasBuildings = state.entities.some((e) => e.kind === 'building' && e.side === 'enemy' && !e.isDead);
  if (!playerHasBuildings) state.mode = 'defeat';
  else if (!enemyHasBuildings) state.mode = 'victory';
  if (state.mode !== 'playing') {
    // Autosave boundary (save-systems): record the match once, at game end.
    recordResult(state.mode === 'victory', state.time);
    if (state.mode === 'victory') sfxVictory();
    else sfxDefeat();
  }
}

export function updateGame(state, map, fow, dt) {
  updateCameraScroll(state, dt);
  if (state.mode !== 'playing') return;

  state.time += dt;
  updateMovement(state, dt);
  updateHarvesting(state, map, dt);
  updateConstruction(state, map, dt);
  updateProduction(state, map, dt);
  updateCombat(state, map, dt);
  updateProjectiles(state, dt);
  updateVfx(state, dt);
  updateAI(state, map, dt);

  state.fowTimer += dt;
  if (state.fowTimer >= FOW_UPDATE_MS) {
    state.fowTimer = 0;
    recomputeVisibility(fow, state, map);
  }

  updateMessages(state, dt);
  pruneDead(state, dt);
  checkWinLose(state);
}

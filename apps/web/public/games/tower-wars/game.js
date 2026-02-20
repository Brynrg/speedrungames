"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const goldEl = document.getElementById("gold");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const incomeEl = document.getElementById("income");
const incomeTickEl = document.getElementById("incomeTick");
const waveStatusEl = document.getElementById("waveStatus");
const tooltipBoxEl = document.getElementById("tooltipBox");

const startWaveBtn = document.getElementById("startWave");
const pauseGameBtn = document.getElementById("pauseGame");
const speedGameBtn = document.getElementById("speedGame");
const autoWaveBtn = document.getElementById("autoWave");
const modeClassicBtn = document.getElementById("modeClassic");
const modeMazeBtn = document.getElementById("modeMaze");
const modeDuelBtn = document.getElementById("modeDuel");
const saveRunBtn = document.getElementById("saveRun");
const loadRunBtn = document.getElementById("loadRun");
const newRunBtn = document.getElementById("newRun");
const upgradeTowerBtn = document.getElementById("upgradeTower");
const castAbilityBtn = document.getElementById("castAbility");
const branchAButton = document.getElementById("branchA");
const branchBButton = document.getElementById("branchB");
const branchControlsEl = document.getElementById("branchControls");
const highScoresEl = document.getElementById("highScores");

const sendRunnerBtn = document.getElementById("sendRunner");
const sendArmorBtn = document.getElementById("sendArmor");
const sendAirBtn = document.getElementById("sendAir");
const sendBreakerBtn = document.getElementById("sendBreaker");
const sendSplitterBtn = document.getElementById("sendSplitter");
const sendMiniBossBtn = document.getElementById("sendMiniBoss");
const clearSendsBtn = document.getElementById("clearSends");
const sendQueueEl = document.getElementById("sendQueue");
const duelPlayerSwitchEl = document.getElementById("duelPlayerSwitch");
const duelP1Btn = document.getElementById("duelP1Btn");
const duelP2Btn = document.getElementById("duelP2Btn");
const duelStatsEl = document.getElementById("duelStats");
const duelP1El = document.getElementById("duelP1");
const duelP2El = document.getElementById("duelP2");
const duelActiveEl = document.getElementById("duelActive");

const selectionNoneEl = document.getElementById("selectionNone");
const selectionDetailsEl = document.getElementById("selectionDetails");
const selTypeEl = document.getElementById("selType");
const selLevelEl = document.getElementById("selLevel");
const selDamageEl = document.getElementById("selDamage");
const selDamageTypeEl = document.getElementById("selDamageType");
const selRangeEl = document.getElementById("selRange");
const selRateEl = document.getElementById("selRate");
const selBranchEl = document.getElementById("selBranch");
const selAuraEl = document.getElementById("selAura");
const towerButtons = [...document.querySelectorAll(".tower-btn")];
const sendButtons = {
  runner: sendRunnerBtn,
  armor: sendArmorBtn,
  air: sendAirBtn,
  breaker: sendBreakerBtn,
  splitter: sendSplitterBtn,
  miniboss: sendMiniBossBtn,
};
const CONTROL_TOOLTIPS = {
  startWave: "Start the next wave when you are ready.",
  pauseGame: "Pause or resume the game simulation.",
  speedGame: "Cycle game speed: 1x, 2x, 3x.",
  autoWave: "Auto-start the next wave after a clear.",
  modeClassic: "Classic mode: fixed creep path.",
  modeMaze: "Maze mode: build towers to shape the path.",
  modeDuel: "Duel mode: two lanes, sends target the opponent.",
  duelP1Btn: "Switch active controls to Player 1.",
  duelP2Btn: "Switch active controls to Player 2.",
  upgradeTower: "Upgrade selected tower stats.",
  castAbility: "Cast selected tower branch ability.",
  branchA: "Choose branch A specialization.",
  branchB: "Choose branch B specialization.",
  sendRunner: "Queue fast light creeps for next wave.",
  sendArmor: "Queue durable heavy creeps for next wave.",
  sendAir: "Queue flying creeps for next wave.",
  sendBreaker: "Queue a magic-immune heavy creep.",
  sendSplitter: "Queue splitter creeps for next wave.",
  sendMiniBoss: "Queue one mini-boss for next wave.",
  clearSends: "Clear queued sends and refund cost/income.",
  saveRun: "Save current run to local storage.",
  loadRun: "Load the last saved run.",
  newRun: "Start a fresh run.",
};

const TILE = 48;
const COLS = 34;
const ROWS = 20;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const CAMERA_KEY_PAN_SPEED = 560;

const RUN_SAVE_KEY = "green_circle_td_run_v2";
const HIGH_SCORE_KEY = "green_circle_td_highscores_v2";
const SPEED_LEVELS = [1, 2, 3];

const DAMAGE_LABELS = {
  piercing: "Piercing",
  magic: "Magic",
  siege: "Siege",
  spell: "Spell",
};

const ARMOR_LABELS = {
  unarmored: "Unarmored",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  fortified: "Fortified",
};

const DAMAGE_TABLE = {
  piercing: { unarmored: 1, light: 1.5, medium: 1, heavy: 0.75, fortified: 0.35 },
  magic: { unarmored: 1.25, light: 1, medium: 0.75, heavy: 1.25, fortified: 0.35 },
  siege: { unarmored: 1, light: 0.75, medium: 0.75, heavy: 1, fortified: 1.5 },
  spell: { unarmored: 1.1, light: 1.1, medium: 1.1, heavy: 1.1, fortified: 1.1 },
};

const PATH_NODES = (() => {
  const midY = Math.floor(ROWS / 2);
  const topY = Math.max(2, Math.floor(ROWS * 0.18));
  const lowY = Math.min(ROWS - 3, Math.floor(ROWS * 0.82));
  const xA = Math.max(3, Math.floor(COLS * 0.14));
  const xB = Math.max(xA + 3, Math.floor(COLS * 0.3));
  const xC = Math.max(xB + 3, Math.floor(COLS * 0.47));
  const xD = Math.max(xC + 3, Math.floor(COLS * 0.64));
  const xE = Math.max(xD + 3, Math.floor(COLS * 0.81));
  return [
    [0, midY],
    [xA, midY],
    [xA, topY],
    [xB, topY],
    [xB, lowY],
    [xC, lowY],
    [xC, topY + 2],
    [xD, topY + 2],
    [xD, lowY],
    [xE, lowY],
    [xE, midY],
    [COLS - 1, midY],
  ];
})();

function buildPathCells(nodes) {
  const cells = [];

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const [x1, y1] = nodes[i];
    const [x2, y2] = nodes[i + 1];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

    for (let step = 0; step <= steps; step += 1) {
      cells.push([x1 + dx * step, y1 + dy * step]);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const [x, y] of cells) {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push([x, y]);
    }
  }

  return unique;
}

const PATH_CELLS = buildPathCells(PATH_NODES);

const WAYPOINTS = PATH_NODES.map(([cx, cy]) => ({
  x: cx * TILE + TILE / 2,
  y: cy * TILE + TILE / 2,
}));

const PATH_SET = new Set(PATH_CELLS.map(([x, y]) => `${x},${y}`));
const MAZE_START = { cx: PATH_NODES[0][0], cy: PATH_NODES[0][1] };
const MAZE_EXIT = { cx: PATH_NODES[PATH_NODES.length - 1][0], cy: PATH_NODES[PATH_NODES.length - 1][1] };
const DUEL_LANE_IDS = [0, 1];

function buildDuelPathNodes(laneId) {
  const laneCenter = laneId === 0 ? Math.max(3, Math.floor(ROWS * 0.26)) : Math.min(ROWS - 4, Math.floor(ROWS * 0.74));
  const bend = 3;
  const yUp = Math.max(1, laneCenter - bend);
  const yDown = Math.min(ROWS - 2, laneCenter + bend);
  const xA = Math.max(3, Math.floor(COLS * 0.14));
  const xB = Math.max(xA + 3, Math.floor(COLS * 0.31));
  const xC = Math.max(xB + 3, Math.floor(COLS * 0.5));
  const xD = Math.max(xC + 3, Math.floor(COLS * 0.69));

  return [
    [0, laneCenter],
    [xA, laneCenter],
    [xA, yUp],
    [xB, yUp],
    [xB, yDown],
    [xC, yDown],
    [xC, yUp],
    [xD, yUp],
    [xD, laneCenter],
    [COLS - 1, laneCenter],
  ];
}

const DUEL_PATH_NODES = DUEL_LANE_IDS.map((laneId) => buildDuelPathNodes(laneId));
const DUEL_PATH_CELLS = DUEL_PATH_NODES.map((nodes) => buildPathCells(nodes));
const DUEL_PATH_SET = new Set(DUEL_PATH_CELLS.flat().map(([x, y]) => `${x},${y}`));
const DUEL_WAYPOINTS = DUEL_PATH_NODES.map((nodes) => nodes.map(([cx, cy]) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 })));
const DUEL_SPAWNS = DUEL_PATH_NODES.map((nodes) => ({ cx: nodes[0][0], cy: nodes[0][1] }));
const DUEL_EXITS = DUEL_PATH_NODES.map((nodes) => ({ cx: nodes[nodes.length - 1][0], cy: nodes[nodes.length - 1][1] }));
const DIR4 = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const FIT_ZOOM = Math.max(canvas.width / WIDTH, canvas.height / HEIGHT);
const camera = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  zoom: FIT_ZOOM,
  minZoom: Math.max(0.45, FIT_ZOOM * 0.85),
  maxZoom: 2,
};
const keyState = {
  left: false,
  right: false,
  up: false,
  down: false,
};
const panState = {
  active: false,
  lastScreenX: 0,
  lastScreenY: 0,
  moved: false,
};

const SEND_OPTIONS = {
  runner: {
    id: "runner",
    label: "Runner Pack",
    cost: 60,
    incomeGain: 1,
    description: "6 fast light creeps",
  },
  armor: {
    id: "armor",
    label: "Armor Column",
    cost: 90,
    incomeGain: 1,
    description: "4 heavy creeps",
  },
  air: {
    id: "air",
    label: "Air Squad",
    cost: 110,
    incomeGain: 2,
    description: "4 flying creeps",
  },
  breaker: {
    id: "breaker",
    label: "Spellbreaker",
    cost: 140,
    incomeGain: 2,
    description: "1 magic immune heavy",
  },
  splitter: {
    id: "splitter",
    label: "Splitter Nest",
    cost: 160,
    incomeGain: 2,
    description: "2 splitter creeps",
  },
  miniboss: {
    id: "miniboss",
    label: "Mini-Boss",
    cost: 220,
    incomeGain: 3,
    description: "1 mini boss",
  },
};

const TOWER_DATA = {
  arrow: {
    name: "Arrow Tower",
    cost: 70,
    color: "#dfcc7a",
    core: "#9d7f32",
    damageType: "piercing",
    canHitAir: true,
    damage: 16,
    range: 155,
    fireRate: 0.5,
    projectileSpeed: 500,
    projectileRadius: 4,
    branches: {
      a: {
        id: "ranger",
        name: "Ranger",
        description: "Long range marksman with Volley ability.",
        mods: { damageMul: 1.26, rangeAdd: 35, attackSpeedMul: 1.12 },
        ability: {
          id: "volley",
          name: "Volley",
          cooldown: 16,
          description: "Instantly hits up to 6 enemies in range.",
        },
      },
      b: {
        id: "captain",
        name: "Captain",
        description: "Aura support with Rally ability.",
        mods: { damageMul: 0.92, rangeAdd: 10, attackSpeedMul: 0.95 },
        aura: {
          name: "Command Aura",
          radius: 138,
          damageMul: 1.14,
          rateMul: 1.16,
        },
        ability: {
          id: "rally",
          name: "Rally",
          cooldown: 22,
          description: "Boost nearby towers for 6s.",
        },
      },
    },
  },
  frost: {
    name: "Frost Tower",
    cost: 95,
    color: "#98d6ff",
    core: "#4a86a5",
    damageType: "magic",
    canHitAir: true,
    damage: 10,
    range: 145,
    fireRate: 0.7,
    projectileSpeed: 400,
    projectileRadius: 5,
    slowFactor: 0.58,
    slowDuration: 1.5,
    branches: {
      a: {
        id: "glacier",
        name: "Glacier",
        description: "Heavier slow and Shatter wave.",
        mods: { damageMul: 1.2, rangeAdd: 15, attackSpeedMul: 0.94, slowFactorMul: 0.74, slowDurationMul: 1.25 },
        ability: {
          id: "shatter",
          name: "Shatter",
          cooldown: 18,
          description: "Magic blast around tower with strong slow.",
        },
      },
      b: {
        id: "storm",
        name: "Storm",
        description: "Blizzard caster with frost aura.",
        mods: { damageMul: 1.05, rangeAdd: 20, attackSpeedMul: 1.1 },
        aura: {
          name: "Winter Aura",
          radius: 124,
          damageMul: 1.08,
          rateMul: 1.14,
        },
        ability: {
          id: "blizzard",
          name: "Blizzard",
          cooldown: 20,
          description: "Create damaging slow field.",
        },
      },
    },
  },
  cannon: {
    name: "Cannon Tower",
    cost: 120,
    color: "#ce9462",
    core: "#7e4f2f",
    damageType: "siege",
    canHitAir: false,
    damage: 35,
    range: 166,
    fireRate: 1.2,
    projectileSpeed: 285,
    projectileRadius: 7,
    splashRadius: 58,
    branches: {
      a: {
        id: "demolisher",
        name: "Demolisher",
        description: "Siege specialist with Barrage.",
        mods: { damageMul: 1.32, rangeAdd: 12, splashMul: 1.3, attackSpeedMul: 0.9 },
        ability: {
          id: "barrage",
          name: "Barrage",
          cooldown: 24,
          description: "Huge area siege blast.",
        },
      },
      b: {
        id: "flak",
        name: "Flak",
        description: "Anti-air conversion with Skyfire.",
        mods: { damageMul: 0.86, rangeAdd: 25, canHitAir: true, attackSpeedMul: 1.15 },
        aura: {
          name: "Flak Screen",
          radius: 132,
          damageMul: 1,
          rateMul: 1.1,
          grantAir: true,
        },
        ability: {
          id: "skyfire",
          name: "Skyfire",
          cooldown: 19,
          description: "Hits all flying enemies in range.",
        },
      },
    },
  },
  arcane: {
    name: "Arcane Tower",
    cost: 145,
    color: "#b39bff",
    core: "#5d4b9c",
    damageType: "spell",
    canHitAir: true,
    damage: 24,
    range: 178,
    fireRate: 0.82,
    projectileSpeed: 455,
    projectileRadius: 5,
    branches: {
      a: {
        id: "astromancer",
        name: "Astromancer",
        description: "Burst specialist with Arcane Nova.",
        mods: { damageMul: 1.22, rangeAdd: 24, attackSpeedMul: 1.08 },
        ability: {
          id: "arcane_nova",
          name: "Arcane Nova",
          cooldown: 20,
          description: "Pulsing spell blast around the tower.",
        },
      },
      b: {
        id: "runelord",
        name: "Runelord",
        description: "Support caster with Time Lock.",
        mods: { damageMul: 0.95, rangeAdd: 16, attackSpeedMul: 0.98 },
        aura: {
          name: "Rune Aura",
          radius: 136,
          damageMul: 1.1,
          rateMul: 1.08,
        },
        ability: {
          id: "time_lock",
          name: "Time Lock",
          cooldown: 24,
          description: "Damages and slows all active enemies.",
        },
      },
    },
  },
  venom: {
    name: "Venom Tower",
    cost: 115,
    color: "#9ad76a",
    core: "#4f7e34",
    damageType: "magic",
    canHitAir: false,
    damage: 14,
    range: 150,
    fireRate: 0.58,
    projectileSpeed: 410,
    projectileRadius: 4,
    branches: {
      a: {
        id: "plaguebringer",
        name: "Plaguebringer",
        description: "Area poison specialist with Acid Rain.",
        mods: { damageMul: 1.18, rangeAdd: 10, attackSpeedMul: 1.05 },
        ability: {
          id: "acid_rain",
          name: "Acid Rain",
          cooldown: 18,
          description: "Creates a corrosive poison field.",
        },
      },
      b: {
        id: "serpent_watch",
        name: "Serpent Watch",
        description: "Long reach support with toxic aura.",
        mods: { damageMul: 1.02, rangeAdd: 28, attackSpeedMul: 0.92, canHitAir: true },
        aura: {
          name: "Toxic Aura",
          radius: 126,
          damageMul: 1.07,
          rateMul: 1.12,
        },
        ability: {
          id: "venom_spike",
          name: "Venom Spike",
          cooldown: 16,
          description: "Fires toxic spikes at multiple targets.",
        },
      },
    },
  },
  mortar: {
    name: "Fire Mortar",
    cost: 155,
    color: "#f08f5b",
    core: "#8b3e29",
    roleTags: ["AoE"],
    element: "Fire",
    damageType: "siege",
    canHitAir: false,
    damage: 26,
    range: 185,
    fireRate: 1.25,
    projectileSpeed: 360,
    projectileRadius: 5,
    splashRadius: 64,
    burnDps: 7,
    burnDuration: 2.8,
    branches: {
      a: {
        id: "shrapnel",
        name: "Shrapnel",
        description: "Wider splash with stronger burn.",
        mods: { damageMul: 1.06, splashAdd: 18, burnDpsAdd: 3, burnDurAdd: 0.8 },
      },
      b: {
        id: "incendiary",
        name: "Incendiary",
        description: "Leaves a burning patch on impact.",
        mods: { damageMul: 0.96, splashAdd: 6, burnDpsAdd: 2, burnDurAdd: 0.5, firePatch: true },
      },
    },
  },
  obelisk: {
    name: "Frost Obelisk",
    cost: 150,
    color: "#a4ddff",
    core: "#416786",
    roleTags: ["Control"],
    element: "Frost",
    damageType: "magic",
    canHitAir: true,
    damage: 9,
    range: 175,
    fireRate: 0.66,
    projectileSpeed: 430,
    projectileRadius: 4,
    slowFactor: 0.62,
    slowDuration: 1.05,
    branches: {
      a: {
        id: "permafrost",
        name: "Permafrost",
        description: "Projects a chilling aura around the obelisk.",
        mods: { damageMul: 0.9 },
        auraSlow: { radius: 130, factor: 0.8, name: "Permafrost Aura" },
      },
      b: {
        id: "ice_lance",
        name: "Ice Lance",
        description: "Periodic freeze-window shots with heavy slow.",
        mods: { damageMul: 1.18, rangeAdd: 12 },
        freeze: { factor: 0.2, duration: 0.65, cooldown: 4.0 },
      },
    },
  },
};

const game = {
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
  speedIndex: 0,
  autoWaveEnabled: true,
  autoWaveTimer: 0,
  income: 2,
  incomeTimer: 0,
  incomeInterval: 10,
  sendQueue: [],
  message: "Build towers and send wave 1.",
  shake: 0,
  autoSaveTimer: 0,
  players: [],
};

const towers = [];
const enemies = [];
const projectiles = [];
const effects = [];
const areaEffects = [];
const buffZones = [];

function createPlayerState(id) {
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

function getPlayerState(id) {
  if (!game.duelMode) {
    return game;
  }
  return game.players[id] || game.players[0];
}

function getActivePlayerState() {
  return getPlayerState(game.activePlayer);
}

function getEnemyDefenderState(enemy) {
  if (!game.duelMode) {
    return game;
  }
  if (enemy.targetPlayer !== undefined) {
    return getPlayerState(enemy.targetPlayer);
  }
  return getPlayerState(enemy.lane || 0);
}

function getEnemyLane(enemy) {
  if (!game.duelMode) {
    return 0;
  }
  if (enemy.targetPlayer !== undefined) {
    return enemy.targetPlayer;
  }
  return enemy.lane || 0;
}

function getLaneOwnerForCell(cx, cy) {
  if (!game.duelMode) {
    return game.activePlayer || 0;
  }
  return cy < Math.floor(ROWS / 2) ? 0 : 1;
}

function syncLegacyEconomyFromActive() {
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

function syncActiveToLegacyIfDuel() {
  if (!game.duelMode) {
    return;
  }
  syncLegacyEconomyFromActive();
}

const audio = {
  ctx: null,
  master: null,
  musicTimer: null,
  musicStep: 0,
  started: false,
  lastEvent: new Map(),
};

let highScores = loadHighScores();
let mazeDistances = null;
game.players = [createPlayerState(0), createPlayerState(1)];

class Enemy {
  constructor(stats) {
    this.name = stats.name || "Creep";
    this.armorType = stats.armorType || "medium";
    this.flying = !!stats.flying;
    this.magicImmune = !!stats.magicImmune;
    this.mechanical = !!stats.mechanical;
    this.slowImmune = !!stats.slowImmune;
    this.splitter = !!stats.splitter;
    this.splitDepth = stats.splitDepth || 0;
    this.isBoss = !!stats.isBoss;

    this.maxHp = Math.max(1, Math.round(stats.hp));
    this.hp = this.maxHp;
    this.speed = stats.speed;
    this.reward = stats.reward;
    this.leakDamage = stats.leakDamage || 1;
    this.radius = stats.radius || (this.isBoss ? 20 : this.flying ? 12 : 13);
    this.lane = stats.lane || 0;
    this.targetPlayer = stats.targetPlayer !== undefined ? stats.targetPlayer : this.lane;

    this.color = stats.color || (this.flying ? "#8bb8df" : "#c9645f");
    this.rim = stats.rim || (this.flying ? "#d5ecff" : "#f0c8a4");

    const spawn = stats.spawn || {};
    this.routeMode = stats.routeMode || this.inferRouteMode();
    this.pathIndex = spawn.pathIndex || 0;
    this.segmentProgress = spawn.segmentProgress || 0;
    this.progress = stats.progress || 0;

    const classicRoute = this.routeMode === "duel-classic" ? DUEL_WAYPOINTS[this.lane] || DUEL_WAYPOINTS[0] : WAYPOINTS;
    const classicAnchor = classicRoute[Math.min(this.pathIndex, classicRoute.length - 1)] || classicRoute[0];
    const mazeStartWorld = worldFromCell(MAZE_START.cx, MAZE_START.cy);
    const spawnAnchor = this.routeMode === "maze-ground" ? mazeStartWorld : classicAnchor;
    this.x = spawn.x ?? spawnAnchor.x;
    this.y = spawn.y ?? spawnAnchor.y;

    this.routePoints =
      this.routeMode === "maze-air"
        ? [mazeStartWorld, worldFromCell(MAZE_EXIT.cx, MAZE_EXIT.cy)]
        : this.routeMode === "duel-classic"
          ? DUEL_WAYPOINTS[this.lane] || DUEL_WAYPOINTS[0]
          : WAYPOINTS;
    this.mazeTargetX = spawn.mazeTargetX ?? null;
    this.mazeTargetY = spawn.mazeTargetY ?? null;

    this.slowFactor = 1;
    this.slowTimer = 0;
    this.auraSlowFactor = 1;
    this.burnDps = 0;
    this.burnTimer = 0;
    this.burnTick = 0;
    this.leaked = false;
    this.dead = false;
  }

  inferRouteMode() {
    if (game.mode === "duel") {
      return "duel-classic";
    }
    if (game.mode !== "maze") {
      return "classic";
    }
    return this.flying ? "maze-air" : "maze-ground";
  }

  serialize() {
    return {
      name: this.name,
      armorType: this.armorType,
      flying: this.flying,
      magicImmune: this.magicImmune,
      mechanical: this.mechanical,
      slowImmune: this.slowImmune,
      splitter: this.splitter,
      splitDepth: this.splitDepth,
      isBoss: this.isBoss,
      hp: this.hp,
      maxHp: this.maxHp,
      speed: this.speed,
      reward: this.reward,
      leakDamage: this.leakDamage,
      radius: this.radius,
      lane: this.lane,
      targetPlayer: this.targetPlayer,
      color: this.color,
      rim: this.rim,
      routeMode: this.routeMode,
      progress: this.progress,
      x: this.x,
      y: this.y,
      pathIndex: this.pathIndex,
      segmentProgress: this.segmentProgress,
      mazeTargetX: this.mazeTargetX,
      mazeTargetY: this.mazeTargetY,
      slowFactor: this.slowFactor,
      slowTimer: this.slowTimer,
      auraSlowFactor: this.auraSlowFactor,
      burnDps: this.burnDps,
      burnTimer: this.burnTimer,
      burnTick: this.burnTick,
    };
  }

  static fromSave(data) {
    const enemy = new Enemy({
      name: data.name,
      armorType: data.armorType,
      flying: data.flying,
      magicImmune: data.magicImmune,
      mechanical: data.mechanical,
      slowImmune: data.slowImmune,
      splitter: data.splitter,
      splitDepth: data.splitDepth,
      isBoss: data.isBoss,
      hp: data.maxHp,
      speed: data.speed,
      reward: data.reward,
      leakDamage: data.leakDamage,
      radius: data.radius,
      lane: data.lane || 0,
      targetPlayer: data.targetPlayer !== undefined ? data.targetPlayer : data.lane || 0,
      color: data.color,
      rim: data.rim,
      routeMode: data.routeMode,
      progress: data.progress,
      spawn: {
        x: data.x,
        y: data.y,
        pathIndex: data.pathIndex,
        segmentProgress: data.segmentProgress,
        mazeTargetX: data.mazeTargetX,
        mazeTargetY: data.mazeTargetY,
      },
    });

    enemy.hp = data.hp;
    enemy.maxHp = data.maxHp;
    enemy.slowFactor = data.slowFactor !== undefined ? data.slowFactor : 1;
    enemy.slowTimer = data.slowTimer !== undefined ? data.slowTimer : 0;
    enemy.auraSlowFactor = data.auraSlowFactor !== undefined ? data.auraSlowFactor : 1;
    enemy.burnDps = data.burnDps !== undefined ? data.burnDps : 0;
    enemy.burnTimer = data.burnTimer !== undefined ? data.burnTimer : 0;
    enemy.burnTick = data.burnTick !== undefined ? data.burnTick : 0;
    return enemy;
  }

  applySlow(factor, duration) {
    if (this.slowImmune || this.magicImmune || this.mechanical) {
      effects.push(new Effect(this.x, this.y, "text", { text: "Immune", color: "#ffdca8" }));
      return;
    }

    if (this.slowTimer <= 0 || factor < this.slowFactor) {
      this.slowFactor = factor;
      this.slowTimer = duration;
      return;
    }

    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyBurn(dps, duration) {
    if (dps <= 0 || duration <= 0) {
      return;
    }
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
    this.burnTick = 0;
  }

  getGridCell() {
    return {
      cx: Math.max(0, Math.min(COLS - 1, Math.floor(this.x / TILE))),
      cy: Math.max(0, Math.min(ROWS - 1, Math.floor(this.y / TILE))),
    };
  }

  chooseNextMazeTarget() {
    if (!mazeDistances) {
      return false;
    }

    const { cx, cy } = this.getGridCell();
    if (cx === MAZE_EXIT.cx && cy === MAZE_EXIT.cy) {
      this.leaked = true;
      return false;
    }

    const here = mazeDistances[cy]?.[cx] ?? -1;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [dx, dy] of DIR4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) {
        continue;
      }
      const d = mazeDistances[ny]?.[nx] ?? -1;
      if (d < 0) {
        continue;
      }
      if (d < bestDistance) {
        bestDistance = d;
        best = { cx: nx, cy: ny };
      }
    }

    if (!best) {
      this.leaked = true;
      return false;
    }

    if (here >= 0 && bestDistance > here) {
      this.leaked = true;
      return false;
    }

    const target = worldFromCell(best.cx, best.cy);
    this.mazeTargetX = target.x;
    this.mazeTargetY = target.y;
    return true;
  }

  updateClassicOrAir(travel) {
    const from = this.routePoints[this.pathIndex];
    const to = this.routePoints[this.pathIndex + 1];
    if (!to) {
      this.leaked = true;
      return;
    }

    const dx = to.x - this.x;
    const dy = to.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (travel >= dist) {
      this.x = to.x;
      this.y = to.y;
      this.progress += dist;
      this.pathIndex += 1;
      this.segmentProgress = 0;
      if (this.pathIndex >= this.routePoints.length - 1) {
        this.leaked = true;
      }
      return;
    }

    this.x += (dx / dist) * travel;
    this.y += (dy / dist) * travel;
    this.progress += travel;

    const segLen = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    this.segmentProgress = Math.min(1, Math.hypot(this.x - from.x, this.y - from.y) / segLen);
  }

  updateMazeGround(travel) {
    let remaining = travel;
    let safety = 0;

    while (remaining > 0 && safety < 8) {
      safety += 1;
      if (this.leaked) {
        return;
      }

      const cell = this.getGridCell();
      if (cell.cx === MAZE_EXIT.cx && cell.cy === MAZE_EXIT.cy) {
        this.leaked = true;
        return;
      }

      if (this.mazeTargetX === null || this.mazeTargetY === null) {
        const ok = this.chooseNextMazeTarget();
        if (!ok) {
          return;
        }
      }

      const dx = this.mazeTargetX - this.x;
      const dy = this.mazeTargetY - this.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (remaining >= dist) {
        this.x = this.mazeTargetX;
        this.y = this.mazeTargetY;
        this.progress += dist;
        remaining -= dist;
        this.mazeTargetX = null;
        this.mazeTargetY = null;
        continue;
      }

      this.x += (dx / dist) * remaining;
      this.y += (dy / dist) * remaining;
      this.progress += remaining;
      remaining = 0;
    }
  }

  update(dt) {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
      }
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.burnTick += dt;

      while (this.burnTick >= 0.25 && this.burnTimer > -0.001) {
        this.burnTick -= 0.25;
        if (!enemies.includes(this)) {
          break;
        }
        const burnDamage = this.burnDps * 0.25;
        dealDamageToEnemy(this, burnDamage, "spell", null, { allowZero: true });
      }

      if (this.burnTimer <= 0) {
        this.burnTimer = 0;
        this.burnDps = 0;
        this.burnTick = 0;
      }
    }

    const effectiveSlow = Math.min(this.slowFactor, this.auraSlowFactor || 1);
    const speedMul = this.flying ? 1.05 : 1;
    const travel = this.speed * effectiveSlow * speedMul * dt;

    if (this.routeMode === "maze-ground") {
      this.updateMazeGround(travel);
      return;
    }

    this.updateClassicOrAir(travel);
  }
}

class Tower {
  constructor(type, x, y, owner = 0) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.owner = owner;

    const base = TOWER_DATA[type];
    this.level = 1;
    this.baseDamage = base.damage;
    this.baseRange = base.range;
    this.baseFireRate = base.fireRate;
    this.cooldown = Math.random() * this.baseFireRate;

    this.branch = null;
    this.abilityCooldown = 0;

    this.tempDamageMul = 1;
    this.tempRateMul = 1;
    this.tempBuffTimer = 0;

    this.auraDamageMul = 1;
    this.auraRateMul = 1;
    this.auraGrantAir = false;
    this._freezeCd = 0;
  }

  static fromSave(data) {
    const tower = new Tower(data.type, data.x, data.y, data.owner || 0);
    tower.level = data.level;
    tower.baseDamage = data.baseDamage;
    tower.baseRange = data.baseRange;
    tower.baseFireRate = data.baseFireRate;
    tower.cooldown = data.cooldown;
    tower.branch = data.branch;
    tower.abilityCooldown = data.abilityCooldown;
    tower.tempDamageMul = data.tempDamageMul;
    tower.tempRateMul = data.tempRateMul;
    tower.tempBuffTimer = data.tempBuffTimer;
    tower._freezeCd = data._freezeCd || 0;
    return tower;
  }

  serialize() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      owner: this.owner,
      level: this.level,
      baseDamage: this.baseDamage,
      baseRange: this.baseRange,
      baseFireRate: this.baseFireRate,
      cooldown: this.cooldown,
      branch: this.branch,
      abilityCooldown: this.abilityCooldown,
      tempDamageMul: this.tempDamageMul,
      tempRateMul: this.tempRateMul,
      tempBuffTimer: this.tempBuffTimer,
      _freezeCd: this._freezeCd,
    };
  }

  get data() {
    return TOWER_DATA[this.type];
  }

  get branchData() {
    if (!this.branch) {
      return null;
    }
    return this.data.branches[this.branch] || null;
  }

  get branchCost() {
    return 130 + Math.max(0, this.level - 3) * 25;
  }

  get upgradeCost() {
    if (this.level >= 6) {
      return 0;
    }
    return Math.floor(this.data.cost * (0.72 + this.level * 0.58));
  }

  get damageType() {
    return this.data.damageType;
  }

  get canHitAir() {
    const branchHitAir = !!this.branchData?.mods?.canHitAir;
    return this.data.canHitAir || branchHitAir || this.auraGrantAir;
  }

  get slowFactor() {
    const base = this.data.slowFactor;
    if (!base) {
      return null;
    }
    const mul = this.branchData?.mods?.slowFactorMul || 1;
    return Math.max(0.2, base * mul);
  }

  get slowDuration() {
    const base = this.data.slowDuration;
    if (!base) {
      return 0;
    }
    const mul = this.branchData?.mods?.slowDurationMul || 1;
    return base * mul;
  }

  get splashRadius() {
    const base = this.data.splashRadius || 0;
    const mul = this.branchData?.mods?.splashMul || 1;
    const add = this.branchData?.mods?.splashAdd || 0;
    return base * mul + add;
  }

  get burnDps() {
    const base = this.data.burnDps || 0;
    const add = this.branchData?.mods?.burnDpsAdd || 0;
    return base + add;
  }

  get burnDuration() {
    const base = this.data.burnDuration || 0;
    const add = this.branchData?.mods?.burnDurAdd || 0;
    return base + add;
  }

  get effectiveDamage() {
    const branchMul = this.branchData?.mods?.damageMul || 1;
    return Math.round(this.baseDamage * branchMul * this.auraDamageMul * this.tempDamageMul);
  }

  get effectiveRange() {
    const branchAdd = this.branchData?.mods?.rangeAdd || 0;
    return this.baseRange + branchAdd;
  }

  get effectiveFireRate() {
    const branchMul = this.branchData?.mods?.attackSpeedMul || 1;
    const speedMul = this.auraRateMul * this.tempRateMul * branchMul;
    return Math.max(0.12, this.baseFireRate / speedMul);
  }

  get ability() {
    return this.branchData?.ability || null;
  }

  hasAura() {
    return !!(this.branchData?.aura || this.branchData?.auraSlow);
  }

  canChooseBranch() {
    return this.level >= 3 && !this.branch;
  }

  canUpgrade() {
    return this.level < 6;
  }

  canCastAbility() {
    return !!this.ability && this.abilityCooldown <= 0;
  }

  upgrade() {
    if (!this.canUpgrade()) {
      return false;
    }

    this.level += 1;
    this.baseDamage = Math.round(this.baseDamage * 1.34);
    this.baseRange += 8;
    this.baseFireRate = Math.max(0.16, this.baseFireRate * 0.93);
    return true;
  }

  chooseBranch(branchKey) {
    if (!this.canChooseBranch()) {
      return false;
    }
    if (!this.data.branches[branchKey]) {
      return false;
    }
    this.branch = branchKey;
    effects.push(new Effect(this.x, this.y, "text", { text: this.branchData.name, color: "#f8e59f" }));
    return true;
  }

  applyTempBuff(damageMul, rateMul, duration) {
    this.tempDamageMul = Math.max(this.tempDamageMul, damageMul);
    this.tempRateMul = Math.max(this.tempRateMul, rateMul);
    this.tempBuffTimer = Math.max(this.tempBuffTimer, duration);
  }

  canTarget(enemy) {
    if (enemy.flying && !this.canHitAir) {
      return false;
    }
    if (game.duelMode && getEnemyLane(enemy) !== this.owner) {
      return false;
    }

    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;
    return dx * dx + dy * dy <= this.effectiveRange * this.effectiveRange;
  }

  acquireTarget() {
    let best = null;
    let bestProgress = -1;

    for (const enemy of enemies) {
      if (!this.canTarget(enemy)) {
        continue;
      }
      const progress = getEnemyProgress(enemy);
      if (progress > bestProgress) {
        bestProgress = progress;
        best = enemy;
      }
    }

    return best;
  }

  fire(target) {
    let freezeOnHit = null;
    if (this.type === "obelisk") {
      const freeze = this.branchData?.freeze;
      if (freeze && this._freezeCd <= 0) {
        freezeOnHit = { factor: freeze.factor, duration: freeze.duration };
        this._freezeCd = freeze.cooldown;
      }
    }

    const projectile = new Projectile({
      x: this.x,
      y: this.y,
      target,
      sourceTower: this,
      speed: this.data.projectileSpeed,
      radius: this.data.projectileRadius,
      damage: this.effectiveDamage,
      damageType: this.damageType,
      splashRadius: this.splashRadius,
      canSlow: this.type === "frost" || this.type === "obelisk",
      slowFactor: this.slowFactor,
      slowDuration: this.slowDuration,
      burnDps: this.type === "mortar" ? this.burnDps : 0,
      burnDuration: this.type === "mortar" ? this.burnDuration : 0,
      spawnFirePatch: this.type === "mortar" && !!this.branchData?.mods?.firePatch,
      freezeOnHit,
    });
    projectiles.push(projectile);
    playSfx("shoot");
  }

  castAbility() {
    const ability = this.ability;
    if (!ability || this.abilityCooldown > 0) {
      return false;
    }

    const range = this.effectiveRange;

    if (ability.id === "volley") {
      const targets = enemies
        .filter((enemy) => this.canTarget(enemy))
        .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
        .slice(0, 6);

      for (const enemy of targets) {
        const dmg = Math.round(this.effectiveDamage * 1.4);
        dealDamageToEnemy(enemy, dmg, "piercing", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.85, color: "rgba(248, 223, 135, 0.45)" }));
    }

    if (ability.id === "rally") {
      buffZones.push({
        x: this.x,
        y: this.y,
        owner: this.owner,
        radius: 145,
        damageMul: 1.22,
        rateMul: 1.35,
        timer: 6,
        name: "Rally",
      });
      effects.push(new Effect(this.x, this.y, "ring", { radius: 145, color: "rgba(244, 214, 130, 0.35)" }));
    }

    if (ability.id === "shatter") {
      const blastRadius = Math.round(range * 0.6);
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d <= blastRadius) {
          const falloff = 1 - d / (blastRadius + 1);
          const dmg = Math.round(this.effectiveDamage * (1.6 * Math.max(0.4, falloff)));
          dealDamageToEnemy(enemy, dmg, "magic", this, { allowZero: true });
          enemy.applySlow(0.42, 1.4);
        }
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: blastRadius, color: "rgba(128, 210, 255, 0.45)" }));
    }

    if (ability.id === "blizzard") {
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: Math.round(range * 0.7),
          duration: 4.2,
          interval: 0.36,
          damage: Math.round(this.effectiveDamage * 0.7),
          damageType: "magic",
          slowFactor: 0.52,
          slowDuration: 0.7,
          color: "rgba(136, 214, 255, 0.34)",
        })
      );
    }

    if (ability.id === "barrage") {
      let target = null;
      let farthest = -1;
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > range || !this.canTarget(enemy)) {
          continue;
        }
        const progress = getEnemyProgress(enemy);
        if (progress > farthest) {
          farthest = progress;
          target = enemy;
        }
      }
      const center = target ? { x: target.x, y: target.y } : { x: this.x, y: this.y };
      const splash = Math.round(this.splashRadius * 1.8);
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
        if (d <= splash) {
          const dmg = Math.round(this.effectiveDamage * (2 - d / (splash + 1)));
          dealDamageToEnemy(enemy, dmg, "siege", this, { allowZero: false });
        }
      }
      effects.push(new Effect(center.x, center.y, "explosion", { radius: splash }));
      game.shake = Math.max(game.shake, 6);
    }

    if (ability.id === "skyfire") {
      const hitRadius = range + 40;
      let hits = 0;
      for (const enemy of [...enemies]) {
        if (!enemy.flying) {
          continue;
        }
        if (Math.hypot(enemy.x - this.x, enemy.y - this.y) > hitRadius) {
          continue;
        }
        hits += 1;
        const dmg = Math.round(this.effectiveDamage * 1.7);
        dealDamageToEnemy(enemy, dmg, "piercing", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: hitRadius, color: "rgba(193, 220, 255, 0.45)" }));
      if (hits === 0) {
        status("Skyfire cast, but no air targets in range.");
      }
    }

    if (ability.id === "arcane_nova") {
      const novaRadius = Math.round(range * 0.62);
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > novaRadius) {
          continue;
        }
        const falloff = 1 - d / (novaRadius + 1);
        const dmg = Math.round(this.effectiveDamage * (2.05 * Math.max(0.35, falloff)));
        dealDamageToEnemy(enemy, dmg, "spell", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: novaRadius, color: "rgba(186, 160, 255, 0.44)" }));
    }

    if (ability.id === "time_lock") {
      let affected = 0;
      for (const enemy of [...enemies]) {
        const dmg = Math.round(this.effectiveDamage * 0.9);
        dealDamageToEnemy(enemy, dmg, "spell", this, { allowZero: true });
        enemy.applySlow(0.58, 2.6);
        affected += 1;
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.96, color: "rgba(154, 186, 255, 0.42)" }));
      if (affected === 0) {
        status("Time Lock cast, but there were no targets.");
      }
    }

    if (ability.id === "acid_rain") {
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: Math.round(range * 0.76),
          duration: 5.1,
          interval: 0.38,
          damage: Math.round(this.effectiveDamage * 0.76),
          damageType: "magic",
          slowFactor: 0.82,
          slowDuration: 0.58,
          color: "rgba(133, 205, 112, 0.34)",
        })
      );
    }

    if (ability.id === "venom_spike") {
      const targets = enemies
        .filter((enemy) => this.canTarget(enemy))
        .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
        .slice(0, 5);
      for (const enemy of targets) {
        const dmg = Math.round(this.effectiveDamage * 1.35);
        dealDamageToEnemy(enemy, dmg, "magic", this, { allowZero: true });
        enemy.applySlow(0.68, 1.2);
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.84, color: "rgba(174, 225, 118, 0.42)" }));
      if (targets.length === 0) {
        status("Venom Spike cast, but no targets were in range.");
      }
    }

    this.abilityCooldown = ability.cooldown;
    playSfx("ability");
    return true;
  }

  update(dt) {
    if (this.tempBuffTimer > 0) {
      this.tempBuffTimer -= dt;
      if (this.tempBuffTimer <= 0) {
        this.tempBuffTimer = 0;
        this.tempDamageMul = 1;
        this.tempRateMul = 1;
      }
    }

    if (this.abilityCooldown > 0) {
      this.abilityCooldown -= dt;
    }
    this._freezeCd = Math.max(0, this._freezeCd - dt);

    this.cooldown -= dt;
    if (this.cooldown > 0) {
      return;
    }

    const target = this.acquireTarget();
    if (!target) {
      this.cooldown = Math.min(this.cooldown, 0);
      return;
    }

    this.fire(target);
    this.cooldown = this.effectiveFireRate;
  }
}

class Projectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.target = config.target;
    this.sourceTower = config.sourceTower;
    this.speed = config.speed;
    this.radius = config.radius;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.splashRadius = config.splashRadius || 0;
    this.canSlow = config.canSlow;
    this.slowFactor = config.slowFactor;
    this.slowDuration = config.slowDuration;
    this.burnDps = config.burnDps || 0;
    this.burnDuration = config.burnDuration || 0;
    this.spawnFirePatch = !!config.spawnFirePatch;
    this.freezeOnHit = config.freezeOnHit || null;

    this.trackX = config.target.x;
    this.trackY = config.target.y;
    this.dead = false;
  }

  impact(enemy, amount) {
    const result = dealDamageToEnemy(enemy, amount, this.damageType, this.sourceTower, { allowZero: true });

    if (this.canSlow && result.damageDealt > 0 && this.slowFactor) {
      enemy.applySlow(this.slowFactor, this.slowDuration);
    }
    if (this.burnDps > 0 && this.burnDuration > 0) {
      enemy.applyBurn(this.burnDps, this.burnDuration);
    }
    if (this.freezeOnHit && result.damageDealt > 0) {
      enemy.applySlow(this.freezeOnHit.factor, this.freezeOnHit.duration);
      effects.push(new Effect(enemy.x, enemy.y, "ring", { radius: enemy.radius + 7, color: "rgba(182, 230, 255, 0.48)" }));
    }

    return result;
  }

  explode() {
    const splash = this.splashRadius;
    effects.push(new Effect(this.x, this.y, "explosion", { radius: splash }));
    game.shake = Math.max(game.shake, 2.6);

    for (const enemy of [...enemies]) {
      const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (d > splash) {
        continue;
      }
      const falloff = 1 - 0.45 * (d / (splash + 1));
      const amount = Math.max(1, Math.round(this.damage * falloff));
      this.impact(enemy, amount);
    }

    if (this.spawnFirePatch) {
      const patchRadius = Math.max(18, Math.round(splash * 0.9));
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: patchRadius,
          duration: 3.6,
          interval: 0.45,
          damage: Math.max(1, Math.round(this.damage * 0.22)),
          damageType: "spell",
          color: "rgba(255, 110, 44, 0.34)",
        })
      );
    }
  }

  update(dt) {
    if (this.dead) {
      return;
    }

    if (this.target && enemies.includes(this.target)) {
      this.trackX = this.target.x;
      this.trackY = this.target.y;
    }

    const dx = this.trackX - this.x;
    const dy = this.trackY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      this.dead = true;
      return;
    }

    const travel = this.speed * dt;
    if (travel >= dist) {
      this.x = this.trackX;
      this.y = this.trackY;

      if (this.splashRadius > 0) {
        this.explode();
      } else if (this.target && enemies.includes(this.target)) {
        this.impact(this.target, this.damage);
      }

      this.dead = true;
      return;
    }

    this.x += (dx / dist) * travel;
    this.y += (dy / dist) * travel;
  }
}

class Effect {
  constructor(x, y, kind, meta = {}) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.meta = meta;
    this.life = 0;
    this.maxLife = kind === "explosion" ? 0.45 : kind === "text" ? 0.7 : 0.3;
  }

  update(dt) {
    this.life += dt;
    if (this.kind === "text") {
      this.y -= dt * 12;
    }
    return this.life >= this.maxLife;
  }
}

class AreaEffect {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.radius = config.radius;
    this.duration = config.duration;
    this.interval = config.interval;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.slowFactor = config.slowFactor;
    this.slowDuration = config.slowDuration;
    this.color = config.color;

    this.life = 0;
    this.tick = 0;
  }

  update(dt) {
    this.life += dt;
    this.tick -= dt;

    if (this.tick <= 0) {
      this.tick = this.interval;
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > this.radius) {
          continue;
        }
        dealDamageToEnemy(enemy, this.damage, this.damageType, null, { allowZero: true });
        if (this.slowFactor) {
          enemy.applySlow(this.slowFactor, this.slowDuration);
        }
      }
    }

    return this.life >= this.duration;
  }
}

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry) => entry && typeof entry.wave === "number" && typeof entry.score === "number").slice(0, 12);
  } catch {
    return [];
  }
}

function saveHighScores() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
  } catch {
    // ignore localStorage failures
  }
}

function defaultTooltip() {
  return "Hover buttons, towers, and enemies for detail. Scroll pans, ctrl/cmd + wheel zooms.";
}

function setTooltip(text) {
  tooltipBoxEl.textContent = text || defaultTooltip();
}

function getButtonTooltip(button) {
  if (button.dataset.tip) {
    return button.dataset.tip;
  }
  if (button.id && CONTROL_TOOLTIPS[button.id]) {
    return CONTROL_TOOLTIPS[button.id];
  }
  if (button.title) {
    return button.title;
  }
  return button.textContent.replace(/\s+/g, " ").trim();
}

function status(text) {
  game.message = text;
  waveStatusEl.textContent = text;
}

function isSendLocked() {
  return game.waveActive || game.gameOver;
}

function getIncomePayout(state = game) {
  return Math.max(0, Math.floor(state.income));
}

function buildRunnerSendUnits(wave) {
  const w = Math.max(1, wave);
  const units = [];
  for (let i = 0; i < 6; i += 1) {
    units.push({
      name: "Runner",
      armorType: "light",
      hp: 28 + w * 8,
      speed: 110 + w * 2 + (i % 2 === 0 ? 0 : 4),
      reward: 4 + Math.floor(w * 0.7),
      leakDamage: 1,
      color: "#d8897a",
      rim: "#f3c9b4",
    });
  }
  return units;
}

function buildArmorSendUnits(wave) {
  const w = Math.max(1, wave);
  const units = [];
  for (let i = 0; i < 4; i += 1) {
    units.push({
      name: "Armor Guard",
      armorType: "heavy",
      hp: 95 + w * 20,
      speed: 52 + w,
      reward: 7 + w,
      leakDamage: 2,
      color: "#8f6558",
      rim: "#e1c49c",
    });
  }
  return units;
}

function buildAirSendUnits(wave) {
  const w = Math.max(1, wave);
  const units = [];
  for (let i = 0; i < 4; i += 1) {
    units.push({
      name: "Harpy Scout",
      armorType: "light",
      hp: 70 + w * 16,
      speed: 96 + w * 2,
      reward: 8 + w,
      leakDamage: 1,
      flying: true,
      color: "#76a4d6",
      rim: "#d5ebff",
    });
  }
  return units;
}

function buildBreakerSendUnits(wave) {
  const w = Math.max(1, wave);
  return [
    {
      name: "Send Spellbreaker",
      armorType: "heavy",
      hp: 220 + w * 28,
      speed: 64 + Math.floor(w * 1.2),
      reward: 18 + w,
      leakDamage: 2,
      magicImmune: true,
      color: "#7e7b8f",
      rim: "#d9d5ff",
    },
  ];
}

function buildSplitterSendUnits(wave) {
  const w = Math.max(1, wave);
  const depth = w >= 12 ? 2 : 1;
  return [
    {
      name: "Send Broodling",
      armorType: "medium",
      hp: 110 + w * 20,
      speed: 72 + w,
      reward: 12 + w,
      leakDamage: 1,
      splitter: true,
      splitDepth: depth,
      color: "#cf8a67",
      rim: "#f8d8b6",
    },
    {
      name: "Send Broodling",
      armorType: "medium",
      hp: 110 + w * 20,
      speed: 72 + w,
      reward: 12 + w,
      leakDamage: 1,
      splitter: true,
      splitDepth: depth,
      color: "#cf8a67",
      rim: "#f8d8b6",
    },
  ];
}

function buildMiniBossSendUnits(wave) {
  const w = Math.max(1, wave);
  return [
    {
      name: "Mini Tyrant",
      armorType: "fortified",
      hp: 520 + w * 110,
      speed: 48 + w * 0.6,
      reward: 60 + w * 8,
      leakDamage: 3,
      radius: 19,
      color: "#764940",
      rim: "#f2c894",
      slowImmune: w >= 16,
    },
  ];
}

function makeSendUnits(key, wave) {
  if (key === "runner") {
    return buildRunnerSendUnits(wave);
  }
  if (key === "armor") {
    return buildArmorSendUnits(wave);
  }
  if (key === "air") {
    return buildAirSendUnits(wave);
  }
  if (key === "breaker") {
    return buildBreakerSendUnits(wave);
  }
  if (key === "splitter") {
    return buildSplitterSendUnits(wave);
  }
  if (key === "miniboss") {
    return buildMiniBossSendUnits(wave);
  }
  return [];
}

function queueSend(key) {
  const option = SEND_OPTIONS[key];
  if (!option) {
    return;
  }

  if (isSendLocked()) {
    status("Sends can only be managed between waves.");
    return;
  }

  const player = getActivePlayerState();

  if (player.gold < option.cost) {
    status(`Not enough gold for ${option.label}.`);
    return;
  }

  player.gold -= option.cost;
  player.income += option.incomeGain;
  player.sendQueue.push({
    key: option.id,
    label: option.label,
    cost: option.cost,
    incomeGain: option.incomeGain,
    wavePurchased: game.wave,
  });

  status(
    game.duelMode
      ? `${option.label} queued by P${game.activePlayer + 1}. Income +${option.incomeGain}.`
      : `${option.label} queued for next wave. Income +${option.incomeGain}.`
  );
  syncActiveToLegacyIfDuel();
  saveRun(false);
}

function clearSendQueue() {
  if (isSendLocked()) {
    status("Cannot clear sends during an active wave.");
    return;
  }

  const player = getActivePlayerState();
  if (player.sendQueue.length === 0) {
    status("No sends queued.");
    return;
  }

  let refund = 0;
  let incomeBack = 0;
  for (const entry of player.sendQueue) {
    refund += entry.cost || 0;
    incomeBack += entry.incomeGain || 0;
  }

  player.gold += refund;
  player.income = Math.max(0, player.income - incomeBack);
  player.sendQueue = [];
  status(
    game.duelMode
      ? `P${game.activePlayer + 1} queue cleared. Refunded ${refund}g and removed ${incomeBack} income.`
      : `Send queue cleared. Refunded ${refund}g and removed ${incomeBack} income.`
  );
  syncActiveToLegacyIfDuel();
  saveRun(false);
}

function consumeSendQueueForWave(state, wave, laneTarget = 0) {
  if (!state.sendQueue || state.sendQueue.length === 0) {
    return { units: [], summary: "" };
  }

  const units = [];
  const counts = {};

  for (const entry of state.sendQueue) {
    const option = SEND_OPTIONS[entry.key];
    if (!option) {
      continue;
    }
    counts[option.label] = (counts[option.label] || 0) + 1;
    const pack = makeSendUnits(option.id, wave);
    for (const unit of pack) {
      units.push({ ...unit, lane: laneTarget, targetPlayer: laneTarget });
    }
  }

  state.sendQueue = [];
  const summary = Object.entries(counts)
    .map(([label, count]) => `${label} x${count}`)
    .join(", ");

  return { units, summary };
}

function updateSendUi() {
  const locked = isSendLocked();
  const player = getActivePlayerState();

  for (const [key, button] of Object.entries(sendButtons)) {
    if (!button) {
      continue;
    }
    const option = SEND_OPTIONS[key];
    const cannotAfford = player.gold < option.cost;
    button.disabled = locked || cannotAfford;
  }

  if (clearSendsBtn) {
    clearSendsBtn.disabled = locked || player.sendQueue.length === 0;
  }

  if (!sendQueueEl) {
    return;
  }

  if (player.sendQueue.length === 0) {
    sendQueueEl.textContent = "No sends queued.";
    return;
  }

  const grouped = {};
  for (const entry of player.sendQueue) {
    const key = entry.key;
    if (!grouped[key]) {
      grouped[key] = { label: entry.label, count: 0, income: 0 };
    }
    grouped[key].count += 1;
    grouped[key].income += entry.incomeGain || 0;
  }

  const parts = [];
  for (const key of Object.keys(grouped)) {
    const g = grouped[key];
    parts.push(`<span class="send-chip">${g.label} x${g.count} (+${g.income})</span>`);
  }
  sendQueueEl.innerHTML = parts.join("");
}

function getDamageMultiplier(damageType, armorType) {
  const byType = DAMAGE_TABLE[damageType];
  if (!byType) {
    return 1;
  }
  return byType[armorType] ?? 1;
}

function dealDamageToEnemy(enemy, rawDamage, damageType, sourceTower, options = {}) {
  if (!enemies.includes(enemy)) {
    return { damageDealt: 0, killed: false, immune: false };
  }

  if (damageType === "magic" && enemy.magicImmune) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "Spell Immune", color: "#ffd7a8" }));
    playSfx("immune");
    return { damageDealt: 0, killed: false, immune: true };
  }

  if (enemy.flying && sourceTower && !sourceTower.canHitAir) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "No AA", color: "#f4b6b6" }));
    return { damageDealt: 0, killed: false, immune: true };
  }

  const mult = getDamageMultiplier(damageType, enemy.armorType);
  const scaled = rawDamage * mult * (enemy.isBoss ? 0.95 : 1);
  let finalDamage = Math.round(scaled);

  if (!options.allowZero) {
    finalDamage = Math.max(1, finalDamage);
  }

  if (finalDamage <= 0) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: "Resist", color: "#d4d4d4" }));
    return { damageDealt: 0, killed: false, immune: false };
  }

  enemy.hp -= finalDamage;
  effects.push(new Effect(enemy.x, enemy.y, "hit"));
  if (mult > 1.15) {
    effects.push(new Effect(enemy.x, enemy.y, "text", { text: `${finalDamage}!`, color: "#ffe59d" }));
  }

  if (enemy.hp <= 0) {
    onEnemyKilled(enemy, sourceTower);
    return { damageDealt: finalDamage, killed: true, immune: false };
  }

  return { damageDealt: finalDamage, killed: false, immune: false };
}

function onEnemyKilled(enemy) {
  const idx = enemies.indexOf(enemy);
  if (idx >= 0) {
    enemies.splice(idx, 1);
  }

  const defender = getEnemyDefenderState(enemy);
  defender.gold += enemy.reward;
  defender.score += enemy.reward * (enemy.isBoss ? 10 : enemy.flying ? 4 : 3);

  effects.push(new Effect(enemy.x, enemy.y, "kill"));
  playSfx("kill");

  if (enemy.splitter && enemy.splitDepth > 0) {
    spawnSplitChildren(enemy);
  }

  if (enemy.isBoss) {
    defender.gold += 80;
    defender.score += 700;
    status(`Boss defeated on wave ${game.wave}.`);
  }
  syncActiveToLegacyIfDuel();
}

function spawnSplitChildren(parent) {
  for (let i = 0; i < 2; i += 1) {
    const child = new Enemy({
      name: "Shardling",
      armorType: "light",
      hp: Math.max(14, parent.maxHp * 0.45),
      speed: parent.speed * 1.22,
      reward: Math.max(1, Math.round(parent.reward * 0.44)),
      leakDamage: 1,
      radius: Math.max(8, parent.radius - 3),
      color: "#d8906f",
      rim: "#f6ceb7",
      splitter: parent.splitDepth > 1,
      splitDepth: Math.max(0, parent.splitDepth - 1),
      spawn: {
        x: parent.x + (i === 0 ? -4 : 4),
        y: parent.y,
        pathIndex: parent.pathIndex,
        segmentProgress: parent.segmentProgress,
        mazeTargetX: parent.mazeTargetX,
        mazeTargetY: parent.mazeTargetY,
      },
      routeMode: parent.routeMode,
      progress: parent.progress,
      lane: parent.lane,
      targetPlayer: parent.targetPlayer,
    });
    enemies.push(child);
  }
}

function worldFromCell(cx, cy) {
  return {
    x: cx * TILE + TILE / 2,
    y: cy * TILE + TILE / 2,
  };
}

function getCellAt(x, y) {
  return {
    cx: Math.floor(x / TILE),
    cy: Math.floor(y / TILE),
  };
}

function inBounds(cx, cy) {
  return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampCamera() {
  const halfW = canvas.width / (2 * camera.zoom);
  const halfH = canvas.height / (2 * camera.zoom);

  if (halfW >= WIDTH / 2) {
    camera.x = WIDTH / 2;
  } else {
    camera.x = clamp(camera.x, halfW, WIDTH - halfW);
  }

  if (halfH >= HEIGHT / 2) {
    camera.y = HEIGHT / 2;
  } else {
    camera.y = clamp(camera.y, halfH, HEIGHT - halfH);
  }
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - canvas.width / 2) / camera.zoom + camera.x,
    y: (screenY - canvas.height / 2) / camera.zoom + camera.y,
  };
}

function applyCameraTransform() {
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

function getScreenPos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getTowerAtCell(cx, cy) {
  return towers.find((tower) => Math.floor(tower.x / TILE) === cx && Math.floor(tower.y / TILE) === cy) || null;
}

function getTowerAtPoint(x, y) {
  for (let i = towers.length - 1; i >= 0; i -= 1) {
    const tower = towers[i];
    if (Math.hypot(tower.x - x, tower.y - y) <= 18) {
      return tower;
    }
  }
  return null;
}

function getEnemyAtPoint(x, y) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    if (Math.hypot(enemy.x - x, enemy.y - y) <= enemy.radius + 1) {
      return enemy;
    }
  }
  return null;
}

function getEnemyProgress(enemy) {
  return enemy.progress ?? enemy.pathIndex + enemy.segmentProgress;
}

function isMazeReservedCell(cx, cy) {
  return (cx === MAZE_START.cx && cy === MAZE_START.cy) || (cx === MAZE_EXIT.cx && cy === MAZE_EXIT.cy);
}

function getBlockedMazeCellSet(extraBlockedCell = null) {
  const blocked = new Set();
  for (const tower of towers) {
    blocked.add(`${Math.floor(tower.x / TILE)},${Math.floor(tower.y / TILE)}`);
  }
  if (extraBlockedCell) {
    blocked.add(`${extraBlockedCell.cx},${extraBlockedCell.cy}`);
  }
  blocked.delete(`${MAZE_START.cx},${MAZE_START.cy}`);
  blocked.delete(`${MAZE_EXIT.cx},${MAZE_EXIT.cy}`);
  return blocked;
}

function computeMazeDistanceMap(extraBlockedCell = null) {
  const blocked = getBlockedMazeCellSet(extraBlockedCell);
  const dist = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => -1));
  const queue = [];

  if (blocked.has(`${MAZE_START.cx},${MAZE_START.cy}`) || blocked.has(`${MAZE_EXIT.cx},${MAZE_EXIT.cy}`)) {
    return { reachable: false, dist };
  }

  dist[MAZE_EXIT.cy][MAZE_EXIT.cx] = 0;
  queue.push([MAZE_EXIT.cx, MAZE_EXIT.cy]);

  let qIndex = 0;
  while (qIndex < queue.length) {
    const [cx, cy] = queue[qIndex];
    qIndex += 1;
    const base = dist[cy][cx];

    for (const [dx, dy] of DIR4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) {
        continue;
      }
      if (dist[ny][nx] !== -1) {
        continue;
      }
      if (blocked.has(`${nx},${ny}`)) {
        continue;
      }
      dist[ny][nx] = base + 1;
      queue.push([nx, ny]);
    }
  }

  return { reachable: dist[MAZE_START.cy][MAZE_START.cx] >= 0, dist };
}

function rebuildMazeDistances() {
  if (game.mode !== "maze") {
    mazeDistances = null;
    return true;
  }
  const result = computeMazeDistanceMap();
  mazeDistances = result.dist;
  return result.reachable;
}

function getBuildBlockReason(cx, cy) {
  if (!inBounds(cx, cy)) {
    return "out";
  }
  if (getTowerAtCell(cx, cy)) {
    return "occupied";
  }

  if (game.mode === "classic") {
    if (PATH_SET.has(`${cx},${cy}`)) {
      return "road";
    }
    return null;
  }

  if (game.mode === "duel") {
    const owner = getLaneOwnerForCell(cx, cy);
    if (owner !== game.activePlayer) {
      return "enemy_lane";
    }
    if (DUEL_PATH_SET.has(`${cx},${cy}`)) {
      return "road";
    }
    return null;
  }

  if (isMazeReservedCell(cx, cy)) {
    return "reserved";
  }

  const test = computeMazeDistanceMap({ cx, cy });
  if (!test.reachable) {
    return "blocked_maze";
  }
  return null;
}

function canBuildOnCell(cx, cy) {
  return getBuildBlockReason(cx, cy) === null;
}

function setSelectedType(type) {
  game.selectedType = type;
  for (const button of towerButtons) {
    button.classList.toggle("active", button.dataset.type === type);
  }
}

function describeEnemy(enemy) {
  const tags = [];
  tags.push(ARMOR_LABELS[enemy.armorType] || enemy.armorType);
  if (enemy.flying) {
    tags.push("Air");
  }
  if (enemy.magicImmune) {
    tags.push("Spell Immune");
  }
  if (enemy.splitter) {
    tags.push("Splitter");
  }
  if (enemy.isBoss) {
    tags.push("Boss");
  }
  if (game.duelMode) {
    tags.push(`Target P${getEnemyLane(enemy) + 1}`);
  }
  return `${enemy.name} | HP ${Math.max(0, Math.round(enemy.hp))}/${enemy.maxHp} | ${tags.join(" • ")}`;
}

function describeTower(tower) {
  const tags = [];
  tags.push(DAMAGE_LABELS[tower.damageType] || tower.damageType);
  tags.push(tower.canHitAir ? "Air+Ground" : "Ground Only");
  if (tower.splashRadius > 0) {
    tags.push(`Splash ${Math.round(tower.splashRadius)}`);
  }
  if (tower.burnDps > 0) {
    tags.push(`Burn ${tower.burnDps.toFixed(0)}/s`);
  }
  if (tower.slowFactor) {
    const slowPct = Math.round((1 - tower.slowFactor) * 100);
    tags.push(`Slow ${slowPct}%`);
  }
  if (game.duelMode) {
    tags.push(`P${tower.owner + 1}`);
  }
  const branchName = tower.branchData?.name ? ` | ${tower.branchData.name}` : "";
  return `${tower.data.name} L${tower.level}${branchName} | Dmg ${tower.effectiveDamage} | Rng ${Math.round(tower.effectiveRange)} | ${tags.join(" • ")}`;
}

function tryBuildTower(cx, cy) {
  const blockReason = getBuildBlockReason(cx, cy);
  if (blockReason) {
    if (blockReason === "road") {
      status("You cannot build on the road.");
    } else if (blockReason === "enemy_lane") {
      status("In Duel mode, build only in your own lane.");
    } else if (blockReason === "reserved") {
      status("Spawn and exit tiles must stay clear in Maze mode.");
    } else if (blockReason === "blocked_maze") {
      status("That placement would block all creep paths.");
    }
    return;
  }

  const type = game.selectedType;
  const cost = TOWER_DATA[type].cost;
  const owner = game.duelMode ? game.activePlayer : 0;
  const player = game.duelMode ? getPlayerState(owner) : game;

  if (player.gold < cost) {
    status(`Not enough gold for ${TOWER_DATA[type].name}.`);
    return;
  }

  const pos = worldFromCell(cx, cy);
  towers.push(new Tower(type, pos.x, pos.y, owner));
  if (game.mode === "maze") {
    rebuildMazeDistances();
    for (const enemy of enemies) {
      if (enemy.routeMode === "maze-ground") {
        enemy.mazeTargetX = null;
        enemy.mazeTargetY = null;
      }
    }
  }
  player.gold -= cost;
  syncActiveToLegacyIfDuel();
  status(`${TOWER_DATA[type].name} constructed.`);
  playSfx("build");
  saveRun(false);
}

function tryUpgradeSelectedTower() {
  const tower = game.selectedTower;
  if (!tower) {
    status("Select a tower to upgrade.");
    return;
  }
  if (!tower.canUpgrade()) {
    status("Tower is at max level.");
    return;
  }

  if (game.duelMode && tower.owner !== game.activePlayer) {
    status(`Switch to P${tower.owner + 1} to upgrade this tower.`);
    return;
  }

  const ownerState = game.duelMode ? getPlayerState(tower.owner) : game;
  const cost = tower.upgradeCost;
  if (ownerState.gold < cost) {
    status(`Need ${cost} gold to upgrade.`);
    return;
  }

  ownerState.gold -= cost;
  tower.upgrade();
  syncActiveToLegacyIfDuel();
  status(`${tower.data.name} upgraded to level ${tower.level}.`);
  playSfx("upgrade");
}

function chooseBranch(branchKey) {
  const tower = game.selectedTower;
  if (!tower) {
    status("Select a tower first.");
    return;
  }
  if (!tower.canChooseBranch()) {
    status("Branching unlocks at level 3.");
    return;
  }

  if (game.duelMode && tower.owner !== game.activePlayer) {
    status(`Switch to P${tower.owner + 1} to choose this tower's branch.`);
    return;
  }

  const ownerState = game.duelMode ? getPlayerState(tower.owner) : game;
  const cost = tower.branchCost;
  if (ownerState.gold < cost) {
    status(`Need ${cost} gold to choose a branch.`);
    return;
  }

  if (!tower.chooseBranch(branchKey)) {
    status("Branch selection failed.");
    return;
  }

  ownerState.gold -= cost;
  syncActiveToLegacyIfDuel();
  status(`${tower.data.name} specialized into ${tower.branchData.name}.`);
  playSfx("upgrade");
}

function castSelectedAbility() {
  const tower = game.selectedTower;
  if (!tower) {
    status("Select a tower to cast its ability.");
    return;
  }
  if (!tower.ability) {
    status("This tower has no active ability. Choose a branch first.");
    return;
  }
  if (game.duelMode && tower.owner !== game.activePlayer) {
    status(`Switch to P${tower.owner + 1} to cast this tower ability.`);
    return;
  }
  if (tower.abilityCooldown > 0) {
    status(`${tower.ability.name} is on cooldown (${tower.abilityCooldown.toFixed(1)}s).`);
    return;
  }

  const ok = tower.castAbility();
  if (ok) {
    status(`${tower.ability.name} cast.`);
  }
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function makeNormalUnit(wave) {
  const tier = wave + 2;
  const roll = Math.random();

  if (roll < 0.18) {
    return {
      name: "Raider",
      armorType: "light",
      hp: 44 + tier * 11,
      speed: 85 + tier * 1.9,
      reward: 8 + wave,
      leakDamage: 1,
      color: "#ca7d72",
      rim: "#f6c9b7",
    };
  }

  if (roll < 0.62) {
    return {
      name: "Footman",
      armorType: "medium",
      hp: 64 + tier * 14,
      speed: 69 + tier * 1.7,
      reward: 10 + wave,
      leakDamage: 1,
      color: "#b8615d",
      rim: "#e3be9f",
    };
  }

  return {
    name: "Juggernaut",
    armorType: "heavy",
    hp: 94 + tier * 17,
    speed: 56 + tier * 1.4,
    reward: 13 + wave,
    leakDamage: 2,
    color: "#975c57",
    rim: "#e4c49b",
    magicImmune: wave >= 8 && Math.random() < 0.25,
  };
}

function makeAirUnit(wave) {
  return {
    name: "Wyvern",
    armorType: "light",
    hp: 60 + wave * 18,
    speed: 92 + wave * 2.8,
    reward: 12 + wave,
    leakDamage: 1,
    flying: true,
    color: "#7ba6d0",
    rim: "#d8ecff",
  };
}

function makeSplitterUnit(wave) {
  return {
    name: "Broodling",
    armorType: "medium",
    hp: 85 + wave * 16,
    speed: 74 + wave * 1.5,
    reward: 13 + wave,
    leakDamage: 1,
    splitter: true,
    splitDepth: wave >= 14 ? 2 : 1,
    color: "#cf8a67",
    rim: "#f8d8b6",
  };
}

function makeBossUnit(wave, idx) {
  const immune = idx % 2 === 0;
  return {
    name: wave >= 20 ? "Ancient Doom Lord" : "War Chief",
    armorType: "fortified",
    hp: 800 + wave * 190,
    speed: 46 + wave * 0.8,
    reward: 120 + wave * 18,
    leakDamage: 3,
    radius: 22,
    isBoss: true,
    magicImmune: immune,
    slowImmune: wave >= 20,
    color: "#7f4e48",
    rim: "#ffd9a3",
  };
}

function buildWavePlan(wave) {
  const queue = [];

  if (wave % 10 === 0) {
    const count = 1 + Math.floor(wave / 20);
    for (let i = 0; i < count; i += 1) {
      queue.push(makeBossUnit(wave, i));
    }
    return { tag: "Boss Wave", interval: 1.45, queue };
  }

  if (wave % 5 === 0) {
    const count = 12 + wave;
    for (let i = 0; i < count; i += 1) {
      const unit = makeAirUnit(wave);
      unit.hp = Math.round(unit.hp * randomRange(0.9, 1.16));
      unit.speed = Math.round(unit.speed * randomRange(0.94, 1.1));
      queue.push(unit);
    }
    return { tag: "Air Wave", interval: Math.max(0.2, 0.72 - wave * 0.012), queue };
  }

  if (wave % 7 === 0) {
    const count = 10 + wave;
    for (let i = 0; i < count; i += 1) {
      const unit = makeSplitterUnit(wave);
      unit.hp = Math.round(unit.hp * randomRange(0.94, 1.14));
      queue.push(unit);
    }
    return { tag: "Splitter Wave", interval: Math.max(0.24, 0.82 - wave * 0.01), queue };
  }

  const count = 8 + wave * 2;
  for (let i = 0; i < count; i += 1) {
    const unit = makeNormalUnit(wave);
    unit.hp = Math.round(unit.hp * randomRange(0.92, 1.14));
    unit.speed = Math.round(unit.speed * randomRange(0.95, 1.08));
    queue.push(unit);
  }

  if (wave >= 9 && wave % 3 === 0) {
    queue.push({
      name: "Spellbreaker",
      armorType: "heavy",
      hp: 140 + wave * 20,
      speed: 68 + wave * 1.4,
      reward: 20 + wave,
      leakDamage: 2,
      magicImmune: true,
      color: "#7e7b8f",
      rim: "#d9d5ff",
    });
  }

  return { tag: "Assault Wave", interval: Math.max(0.24, 0.82 - wave * 0.014), queue };
}

function buildDuelWavePlan(wave) {
  const base = buildWavePlan(wave);
  const queue = [];
  for (const lane of DUEL_LANE_IDS) {
    for (const unit of base.queue) {
      queue.push({ ...unit, lane, targetPlayer: lane });
    }
  }
  return { tag: `${base.tag} Duel`, interval: base.interval, queue };
}

function spawnEnemyFromQueue() {
  if (game.spawnQueue.length === 0) {
    return;
  }
  const template = game.spawnQueue.shift();
  enemies.push(new Enemy(template));
}

function startWave() {
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

function toggleAutoWave() {
  game.autoWaveEnabled = !game.autoWaveEnabled;
  game.autoWaveTimer = 0;
  status(game.autoWaveEnabled ? "Auto-next wave enabled." : "Auto-next wave disabled.");
  saveRun(false);
}

function setGameMode(mode) {
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

function setActivePlayer(id) {
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

function updateBuffsAndAuras(dt) {
  for (const tower of towers) {
    tower.auraDamageMul = 1;
    tower.auraRateMul = 1;
    tower.auraGrantAir = false;
  }
  for (const enemy of enemies) {
    enemy.auraSlowFactor = 1;
  }

  for (let i = buffZones.length - 1; i >= 0; i -= 1) {
    const zone = buffZones[i];
    zone.timer -= dt;
    if (zone.timer <= 0) {
      buffZones.splice(i, 1);
      continue;
    }

    for (const tower of towers) {
      if (game.duelMode && zone.owner !== undefined && tower.owner !== zone.owner) {
        continue;
      }
      const d = Math.hypot(tower.x - zone.x, tower.y - zone.y);
      if (d <= zone.radius) {
        tower.applyTempBuff(zone.damageMul, zone.rateMul, zone.timer);
      }
    }
  }

  for (const source of towers) {
    const aura = source.branchData?.aura;
    if (!aura) {
      continue;
    }

    for (const tower of towers) {
      if (tower === source) {
        continue;
      }
      if (game.duelMode && tower.owner !== source.owner) {
        continue;
      }
      const d = Math.hypot(tower.x - source.x, tower.y - source.y);
      if (d > aura.radius) {
        continue;
      }
      tower.auraDamageMul *= aura.damageMul;
      tower.auraRateMul *= aura.rateMul;
      if (aura.grantAir) {
        tower.auraGrantAir = true;
      }
    }
  }

  for (const source of towers) {
    const auraSlow = source.branchData?.auraSlow;
    if (!auraSlow) {
      continue;
    }
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - source.x, enemy.y - source.y);
      if (d <= auraSlow.radius) {
        enemy.auraSlowFactor = Math.min(enemy.auraSlowFactor, auraSlow.factor);
      }
    }
  }
}

function updateSelectionPanel() {
  const tower = game.selectedTower;
  if (!tower || !towers.includes(tower)) {
    game.selectedTower = null;
    selectionNoneEl.classList.remove("hidden");
    selectionDetailsEl.classList.add("hidden");
    branchControlsEl.classList.add("hidden");
    return;
  }

  selectionNoneEl.classList.add("hidden");
  selectionDetailsEl.classList.remove("hidden");

  selTypeEl.textContent = tower.data.name;
  selLevelEl.textContent = String(tower.level);
  selDamageEl.textContent = String(tower.effectiveDamage);
  selDamageTypeEl.textContent = DAMAGE_LABELS[tower.damageType] || tower.damageType;
  selRangeEl.textContent = String(Math.round(tower.effectiveRange));
  selRateEl.textContent = `${(1 / tower.effectiveFireRate).toFixed(2)} /s`;
  selBranchEl.textContent = tower.branchData?.name || "None";
  selAuraEl.textContent = tower.branchData?.aura?.name || tower.branchData?.auraSlow?.name || "None";
  const ownerState = game.duelMode ? getPlayerState(tower.owner) : game;
  const controllable = !game.duelMode || tower.owner === game.activePlayer;

  if (!tower.canUpgrade()) {
    upgradeTowerBtn.textContent = "Max Level";
    upgradeTowerBtn.disabled = true;
  } else {
    upgradeTowerBtn.textContent = `Upgrade (U) - ${tower.upgradeCost}g`;
    upgradeTowerBtn.disabled = !controllable || ownerState.gold < tower.upgradeCost;
  }

  if (tower.ability) {
    if (tower.abilityCooldown > 0) {
      castAbilityBtn.textContent = `${tower.ability.name} (${tower.abilityCooldown.toFixed(1)}s)`;
      castAbilityBtn.disabled = true;
    } else {
      castAbilityBtn.textContent = `${tower.ability.name} (F)`;
      castAbilityBtn.disabled = !controllable;
    }
  } else {
    castAbilityBtn.textContent = "Cast Ability (F)";
    castAbilityBtn.disabled = true;
  }

  if (tower.canChooseBranch()) {
    branchControlsEl.classList.remove("hidden");
    const a = tower.data.branches.a;
    const b = tower.data.branches.b;
    branchAButton.textContent = `${a.name} - ${tower.branchCost}g`;
    branchBButton.textContent = `${b.name} - ${tower.branchCost}g`;
    branchAButton.disabled = !controllable || ownerState.gold < tower.branchCost;
    branchBButton.disabled = !controllable || ownerState.gold < tower.branchCost;
  } else {
    branchControlsEl.classList.add("hidden");
  }
}

function renderHighScores() {
  highScoresEl.innerHTML = "";

  if (highScores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No runs recorded yet.";
    highScoresEl.appendChild(li);
    return;
  }

  for (let i = 0; i < Math.min(5, highScores.length); i += 1) {
    const entry = highScores[i];
    const li = document.createElement("li");
    li.textContent = `Wave ${entry.wave} | Score ${entry.score}`;
    highScoresEl.appendChild(li);
  }
}

function recordHighScore() {
  if (game.scoreRecorded || game.wave <= 0) {
    return;
  }

  highScores.push({
    wave: game.wave,
    score: game.score,
    date: new Date().toISOString(),
  });

  highScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.wave - a.wave;
  });

  highScores = highScores.slice(0, 12);
  saveHighScores();
  renderHighScores();
  game.scoreRecorded = true;
  game.bestWave = highScores[0]?.wave || 0;
}

function getRunSnapshot() {
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
      paused: game.paused,
      speedIndex: game.speedIndex,
      autoWaveEnabled: game.autoWaveEnabled,
      autoWaveTimer: game.autoWaveTimer,
      gameOver: game.gameOver,
      message: game.message,
      scoreRecorded: game.scoreRecorded,
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

function saveRun(showMessage = true) {
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

function loadRun(showMessage = true) {
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
    game.mode = parsed.game.mode === "maze" ? "maze" : parsed.game.mode === "duel" ? "duel" : "classic";
    game.duelMode = game.mode === "duel" || !!parsed.game.duelMode;
    if (game.duelMode && game.mode !== "duel") {
      game.mode = "duel";
    }
    game.activePlayer = parsed.game.activePlayer === 1 ? 1 : 0;
    game.paused = !!parsed.game.paused;
    game.speedIndex = Math.max(0, Math.min(SPEED_LEVELS.length - 1, parsed.game.speedIndex || 0));
    game.autoWaveEnabled = parsed.game.autoWaveEnabled !== undefined ? !!parsed.game.autoWaveEnabled : true;
    game.autoWaveTimer = Math.max(0, parsed.game.autoWaveTimer || 0);
    game.gameOver = !!parsed.game.gameOver;
    game.message = parsed.game.message || "Run loaded.";
    game.scoreRecorded = !!parsed.game.scoreRecorded;
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
    status(showMessage ? "Run loaded." : game.message);
    return true;
  } catch {
    if (showMessage) {
      status("Load failed.");
    }
    return false;
  }
}

function resetRun(options = {}) {
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
  game.selectedTower = null;
  game.hoverCell = null;
  game.hoverEnemy = null;
  game.gameOver = false;
  game.scoreRecorded = false;
  game.paused = false;
  game.speedIndex = 0;
  game.autoWaveEnabled = autoWaveValue;
  game.autoWaveTimer = 0;
  game.message = "Build towers and send wave 1.";
  game.shake = 0;
  game.autoSaveTimer = 0;
  syncLegacyEconomyFromActive();
  camera.x = WIDTH / 2;
  camera.y = HEIGHT / 2;
  camera.zoom = FIT_ZOOM;
  clampCamera();

  rebuildMazeDistances();
  setSelectedType(game.selectedType);
  status(game.message);
}

function togglePause() {
  if (game.gameOver) {
    return;
  }
  game.paused = !game.paused;
  status(game.paused ? "Game paused." : "Game resumed.");
}

function cycleSpeed() {
  game.speedIndex = (game.speedIndex + 1) % SPEED_LEVELS.length;
  status(`Game speed set to ${SPEED_LEVELS[game.speedIndex]}x.`);
}

function getMazePreviewPoints() {
  if (!mazeDistances) {
    return [];
  }

  const points = [];
  let cx = MAZE_START.cx;
  let cy = MAZE_START.cy;
  const maxSteps = COLS * ROWS;
  let steps = 0;

  points.push(worldFromCell(cx, cy));
  while (!(cx === MAZE_EXIT.cx && cy === MAZE_EXIT.cy) && steps < maxSteps) {
    steps += 1;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [dx, dy] of DIR4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) {
        continue;
      }
      const d = mazeDistances[ny]?.[nx] ?? -1;
      if (d < 0) {
        continue;
      }
      if (d < bestDist) {
        bestDist = d;
        best = { cx: nx, cy: ny };
      }
    }
    if (!best) {
      break;
    }
    cx = best.cx;
    cy = best.cy;
    points.push(worldFromCell(cx, cy));
  }

  return points;
}

function drawBoard() {
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

function drawPolygon(cx, cy, radius, sides, rotation = 0) {
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

function getTowerAimAngle(tower) {
  const target = tower.acquireTarget();
  if (!target) {
    return -Math.PI / 2;
  }
  return Math.atan2(target.y - tower.y, target.x - tower.x);
}

function drawTowerBasePad(tower) {
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

function drawArrowTowerModel(tower) {
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

function drawFrostTowerModel(tower) {
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

function drawCannonTowerModel(tower) {
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

function drawArcaneTowerModel(tower) {
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

function drawVenomTowerModel(tower) {
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

function drawMortarTowerModel(tower) {
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

function drawObeliskTowerModel(tower) {
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

function drawTowerRankAndBranch(tower) {
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

function drawTower(tower) {
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

function drawEnemy(enemy) {
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

  const barW = enemy.isBoss ? 42 : 28;
  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = "rgba(15, 18, 12, 0.88)";
  ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 12, barW, 4);

  ctx.fillStyle = enemy.isBoss ? "#f9c76d" : enemy.flying ? "#9dd8ff" : "#98d872";
  ctx.fillRect(enemy.x - barW / 2 + 0.7, enemy.y - enemy.radius - 11.3, (barW - 1.4) * hpRatio, 2.6);

  if (game.hoverEnemy === enemy) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff7ce";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

function drawProjectile(projectile) {
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

function drawAreaEffect(effect) {
  const t = effect.life / effect.duration;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
  ctx.fillStyle = effect.color.replace("0.34", `${0.34 * (1 - t)}`);
  ctx.fill();
  ctx.strokeStyle = "rgba(190, 228, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawEffect(effect) {
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

function drawOverlay() {
  const viewW = canvas.width;
  const viewH = canvas.height;
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

function update(dt) {
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
      if (game.duelMode) {
        for (const state of game.players) {
          state.gold += bounty;
          state.score += 120 + game.wave * 30;
          if (game.wave % 4 === 0) {
            state.lives = Math.min(30, state.lives + 1);
          }
        }
      } else {
        game.gold += bounty;
        game.score += 120 + game.wave * 30;
        if (game.wave % 4 === 0) {
          game.lives = Math.min(30, game.lives + 1);
        }
      }
      const autoText = game.autoWaveEnabled ? " Auto next in 2.8s." : "";
      status(`Wave ${game.wave} (${game.waveTag}) cleared. Bonus +${bounty}g.${autoText}`);
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
      defender.income = Math.max(0, defender.income - enemy.leakDamage);
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

function render() {
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

function syncUi() {
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
  bestEl.textContent = `W${bestWave}`;

  speedEl.textContent = `${SPEED_LEVELS[game.speedIndex]}x`;
  incomeEl.textContent = String(Math.floor(game.income));
  incomeTickEl.textContent = `${Math.max(0, game.incomeInterval - game.incomeTimer).toFixed(1)}s`;
  pauseGameBtn.textContent = game.paused ? "Resume (P)" : "Pause (P)";
  speedGameBtn.textContent = `Speed ${SPEED_LEVELS[game.speedIndex]}x (T)`;
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

  updateSelectionPanel();
  updateSendUi();
}

function initAudio() {
  if (audio.ctx) {
    return;
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    audio.ctx = new AudioCtx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.045;
    audio.master.connect(audio.ctx.destination);

    startMusicLoop();
  } catch {
    // audio unavailable
  }
}

function ensureAudioActive() {
  if (!audio.ctx) {
    initAudio();
  }
  if (audio.ctx && audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }
}

function playTone(freq, duration, type, gain) {
  if (!audio.ctx || !audio.master) {
    return;
  }

  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.ctx.currentTime);
  amp.gain.setValueAtTime(gain, audio.ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + duration);

  osc.connect(amp);
  amp.connect(audio.master);

  osc.start(audio.ctx.currentTime);
  osc.stop(audio.ctx.currentTime + duration);
}

function playSfx(kind) {
  ensureAudioActive();
  if (!audio.ctx) {
    return;
  }

  const now = performance.now();
  const last = audio.lastEvent.get(kind) || 0;
  const throttle = { shoot: 60, kill: 70, leak: 180, build: 110, wave: 260, clear: 260, upgrade: 140, ability: 120, immune: 90 }[kind] || 60;
  if (now - last < throttle) {
    return;
  }
  audio.lastEvent.set(kind, now);

  if (kind === "shoot") {
    playTone(520 + Math.random() * 60, 0.06, "triangle", 0.05);
  } else if (kind === "kill") {
    playTone(260, 0.09, "square", 0.06);
  } else if (kind === "leak") {
    playTone(120, 0.2, "sawtooth", 0.08);
  } else if (kind === "build") {
    playTone(320, 0.08, "triangle", 0.055);
  } else if (kind === "wave") {
    playTone(180, 0.15, "triangle", 0.065);
    playTone(250, 0.18, "triangle", 0.045);
  } else if (kind === "clear") {
    playTone(420, 0.16, "triangle", 0.06);
    playTone(560, 0.2, "triangle", 0.05);
  } else if (kind === "upgrade") {
    playTone(390, 0.09, "triangle", 0.06);
  } else if (kind === "ability") {
    playTone(610, 0.12, "sawtooth", 0.07);
  } else if (kind === "immune") {
    playTone(170, 0.08, "square", 0.05);
  }
}

function startMusicLoop() {
  if (!audio.ctx || audio.musicTimer) {
    return;
  }

  const notes = [196, 220, 246, 196, 174, 196, 220, 262];
  audio.musicStep = 0;

  audio.musicTimer = setInterval(() => {
    if (!audio.ctx || game.gameOver) {
      return;
    }
    if (game.paused) {
      return;
    }
    const note = notes[audio.musicStep % notes.length];
    playTone(note, 0.24, "triangle", 0.018);
    audio.musicStep += 1;
  }, 480);
}

function handleBoardClick(event) {
  ensureAudioActive();

  if (game.gameOver) {
    return;
  }
  if (event.altKey) {
    return;
  }
  if (panState.moved) {
    panState.moved = false;
    return;
  }

  const screen = getScreenPos(event);
  const pos = screenToWorld(screen.x, screen.y);

  const clickedTower = getTowerAtPoint(pos.x, pos.y);
  if (clickedTower) {
    if (game.duelMode && clickedTower.owner !== game.activePlayer) {
      status(`That tower belongs to P${clickedTower.owner + 1}. Switch active player to control it.`);
      game.selectedTower = null;
      return;
    }
    game.selectedTower = clickedTower;
    status(`${clickedTower.data.name} selected.`);
    return;
  }

  game.selectedTower = null;

  const { cx, cy } = getCellAt(pos.x, pos.y);
  if (!inBounds(cx, cy)) {
    return;
  }

  tryBuildTower(cx, cy);
}

function handleCanvasMove(event) {
  const screen = getScreenPos(event);
  if (panState.active) {
    const dx = screen.x - panState.lastScreenX;
    const dy = screen.y - panState.lastScreenY;
    panState.lastScreenX = screen.x;
    panState.lastScreenY = screen.y;

    if (Math.abs(dx) + Math.abs(dy) > 1.5) {
      panState.moved = true;
    }

    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    clampCamera();
    game.hoverEnemy = null;
    game.hoverCell = null;
    setTooltip("Panning map.");
    return;
  }

  const pos = screenToWorld(screen.x, screen.y);
  const { cx, cy } = getCellAt(pos.x, pos.y);
  game.hoverCell = inBounds(cx, cy) ? { cx, cy } : null;

  const enemy = getEnemyAtPoint(pos.x, pos.y);
  game.hoverEnemy = enemy;
  if (enemy) {
    setTooltip(describeEnemy(enemy));
    return;
  }

  const tower = getTowerAtPoint(pos.x, pos.y);
  if (tower) {
    setTooltip(describeTower(tower));
    return;
  }

  setTooltip(defaultTooltip());
}

function updateCameraFromKeys(dt) {
  let dx = 0;
  let dy = 0;
  if (keyState.left) {
    dx -= 1;
  }
  if (keyState.right) {
    dx += 1;
  }
  if (keyState.up) {
    dy -= 1;
  }
  if (keyState.down) {
    dy += 1;
  }
  if (dx === 0 && dy === 0) {
    return;
  }

  const len = Math.hypot(dx, dy) || 1;
  camera.x += (dx / len) * CAMERA_KEY_PAN_SPEED * dt;
  camera.y += (dy / len) * CAMERA_KEY_PAN_SPEED * dt;
  clampCamera();
}

function handleCanvasMouseDown(event) {
  if (!(event.button === 1 || event.button === 2 || (event.button === 0 && event.altKey))) {
    return;
  }
  event.preventDefault();
  const screen = getScreenPos(event);
  panState.active = true;
  panState.moved = false;
  panState.lastScreenX = screen.x;
  panState.lastScreenY = screen.y;
  canvas.style.cursor = "grabbing";
}

function handleCanvasMouseUp() {
  if (!panState.active) {
    return;
  }
  panState.active = false;
  canvas.style.cursor = "default";
}

function handleCanvasWheel(event) {
  event.preventDefault();
  if (!event.ctrlKey && !event.metaKey) {
    camera.x += event.deltaX / camera.zoom;
    camera.y += event.deltaY / camera.zoom;
    clampCamera();
    return;
  }

  const screen = getScreenPos(event);
  const worldBefore = screenToWorld(screen.x, screen.y);
  const zoomFactor = Math.exp(-event.deltaY * 0.0015);
  camera.zoom = clamp(camera.zoom * zoomFactor, camera.minZoom, camera.maxZoom);
  const worldAfter = screenToWorld(screen.x, screen.y);
  camera.x += worldBefore.x - worldAfter.x;
  camera.y += worldBefore.y - worldAfter.y;
  clampCamera();
}

let previousTime = performance.now();
function tick(now) {
  const dtRaw = Math.min(0.033, (now - previousTime) / 1000);
  previousTime = now;

  const dt = dtRaw * SPEED_LEVELS[game.speedIndex];

  update(dt);
  render();
  syncUi();

  requestAnimationFrame(tick);
}

function bindEvents() {
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

  startWaveBtn.addEventListener("click", () => {
    ensureAudioActive();
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
    queueSend("runner");
  });
  sendArmorBtn.addEventListener("click", () => {
    ensureAudioActive();
    queueSend("armor");
  });
  sendAirBtn.addEventListener("click", () => {
    ensureAudioActive();
    queueSend("air");
  });
  sendBreakerBtn.addEventListener("click", () => {
    ensureAudioActive();
    queueSend("breaker");
  });
  sendSplitterBtn.addEventListener("click", () => {
    ensureAudioActive();
    queueSend("splitter");
  });
  sendMiniBossBtn.addEventListener("click", () => {
    ensureAudioActive();
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
    resetRun();
    saveRun(false);
    status("New run started.");
  });

  for (const button of towerButtons) {
    button.addEventListener("click", () => {
      ensureAudioActive();
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
      setSelectedType("arrow");
    }
    if (key === "2") {
      setSelectedType("frost");
    }
    if (key === "3") {
      setSelectedType("cannon");
    }
    if (key === "4") {
      setSelectedType("arcane");
    }
    if (key === "5") {
      setSelectedType("venom");
    }
    if (key === "0") {
      setSelectedType("mortar");
    }
    if (key === "-") {
      setSelectedType("obelisk");
    }
    if (key === "u") {
      event.preventDefault();
      tryUpgradeSelectedTower();
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
      startWave();
    }
  });

  window.addEventListener("pointerdown", () => {
    ensureAudioActive();
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

function boot() {
  bindEvents();
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
}

boot();

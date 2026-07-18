export const TILE = 32;
export const MAP_W = 44;
export const MAP_H = 32;
export const VIEW_W = 960;
export const VIEW_H = 640;
export const MINIMAP_W = 180;
export const MINIMAP_H = Math.round((MAP_H / MAP_W) * MINIMAP_W);

export const HARVEST_GOLD_TIME = 4000;
export const HARVEST_LUMBER_TIME = 3000;
export const GOLD_PER_TRIP = 100;
export const LUMBER_PER_TRIP = 100;
export const LUMBER_PER_CHOP = 20;
export const GOLD_PER_MINE_TICK = 25;

export const AGGRO_RADIUS = 4.5;
export const ATTACK_MOVE_LEASH = 12;
export const SEPARATION_RADIUS = 0.55;

export const FOW_UPDATE_MS = 150;
export const AI_TICK_MS = 800;
export const MESSAGE_TTL_MS = 4200;

export const FACTIONS = {
  player: { name: 'Human Alliance', color: '#4d7bd6', accent: '#bcd6ff', dark: '#213a63' },
  enemy: { name: 'Orc Horde', color: '#c1432e', accent: '#ffb199', dark: '#5c1f14' },
};

export const OTHER_SIDE = { player: 'enemy', enemy: 'player' };

// Unit stat tables. Human/orc pairs are stat-mirrored under different names.
export const UNIT_DATA = {
  peasant: { side: 'player', label: 'Peasant', hp: 30, armor: 0, atkMin: 1, atkMax: 2, atkRange: 1, atkCooldown: 1200, speed: 2.3, sight: 4, cost: { gold: 50 }, buildTime: 6000, food: 1, isWorker: true, radius: 0.32 },
  footman: { side: 'player', label: 'Footman', hp: 60, armor: 2, atkMin: 6, atkMax: 9, atkRange: 1, atkCooldown: 1100, speed: 2.0, sight: 5, cost: { gold: 70 }, buildTime: 8000, food: 1, radius: 0.36 },
  archer: { side: 'player', label: 'Archer', hp: 40, armor: 0, atkMin: 5, atkMax: 8, atkRange: 4, atkCooldown: 1300, speed: 2.0, sight: 5, cost: { gold: 60, lumber: 20 }, buildTime: 9000, food: 1, radius: 0.34, ranged: true },
  knight: { side: 'player', label: 'Knight', hp: 110, armor: 4, atkMin: 12, atkMax: 18, atkRange: 1, atkCooldown: 1200, speed: 2.8, sight: 5, cost: { gold: 130, lumber: 30 }, buildTime: 14000, food: 2, radius: 0.4, requiresTech: 'blacksmith' },

  peon: { side: 'enemy', label: 'Peon', hp: 30, armor: 0, atkMin: 1, atkMax: 2, atkRange: 1, atkCooldown: 1200, speed: 2.3, sight: 4, cost: { gold: 50 }, buildTime: 6000, food: 1, isWorker: true, radius: 0.32 },
  grunt: { side: 'enemy', label: 'Grunt', hp: 65, armor: 2, atkMin: 7, atkMax: 10, atkRange: 1, atkCooldown: 1100, speed: 2.0, sight: 5, cost: { gold: 70 }, buildTime: 8000, food: 1, radius: 0.36 },
  spearman: { side: 'enemy', label: 'Spearman', hp: 40, armor: 0, atkMin: 5, atkMax: 8, atkRange: 4, atkCooldown: 1300, speed: 2.0, sight: 5, cost: { gold: 60, lumber: 20 }, buildTime: 9000, food: 1, radius: 0.34, ranged: true },
  raider: { side: 'enemy', label: 'Raider', hp: 115, armor: 4, atkMin: 12, atkMax: 18, atkRange: 1, atkCooldown: 1200, speed: 2.9, sight: 5, cost: { gold: 130, lumber: 30 }, buildTime: 14000, food: 2, radius: 0.4, requiresTech: 'blacksmith' },
};

// Building stat tables, keyed the same way. `size` is a square footprint in tiles.
export const BUILDING_DATA = {
  townhall: { side: 'player', label: 'Town Hall', hp: 600, armor: 4, size: 3, cost: { gold: 0, lumber: 0 }, buildTime: 60000, sight: 6, food: 7, produces: ['peasant'], isMain: true },
  farm: { side: 'player', label: 'Farm', hp: 80, armor: 0, size: 2, cost: { gold: 50, lumber: 25 }, buildTime: 8000, sight: 3, food: 6 },
  barracks: { side: 'player', label: 'Barracks', hp: 250, armor: 3, size: 3, cost: { gold: 120, lumber: 40 }, buildTime: 20000, sight: 4, produces: ['footman', 'archer', 'knight'] },
  blacksmith: { side: 'player', label: 'Blacksmith', hp: 180, armor: 2, size: 2, cost: { gold: 100, lumber: 60 }, buildTime: 18000, sight: 3, unlocksTech: 'blacksmith' },
  tower: { side: 'player', label: 'Guard Tower', hp: 100, armor: 3, size: 1, cost: { gold: 70, lumber: 50 }, buildTime: 12000, sight: 6, atkMin: 8, atkMax: 12, atkRange: 5, atkCooldown: 1000, isDefense: true },

  greathall: { side: 'enemy', label: 'Great Hall', hp: 600, armor: 4, size: 3, cost: { gold: 0, lumber: 0 }, buildTime: 60000, sight: 6, food: 7, produces: ['peon'], isMain: true },
  pigfarm: { side: 'enemy', label: 'Pig Farm', hp: 80, armor: 0, size: 2, cost: { gold: 50, lumber: 25 }, buildTime: 8000, sight: 3, food: 6 },
  warmill: { side: 'enemy', label: 'War Mill', hp: 250, armor: 3, size: 3, cost: { gold: 120, lumber: 40 }, buildTime: 20000, sight: 4, produces: ['grunt', 'spearman', 'raider'] },
  tradehall: { side: 'enemy', label: 'Trade Hall', hp: 180, armor: 2, size: 2, cost: { gold: 100, lumber: 60 }, buildTime: 18000, sight: 3, unlocksTech: 'blacksmith' },
  watchtower: { side: 'enemy', label: 'Watch Tower', hp: 100, armor: 3, size: 1, cost: { gold: 70, lumber: 50 }, buildTime: 12000, sight: 6, atkMin: 8, atkMax: 12, atkRange: 5, atkCooldown: 1000, isDefense: true },
};

export const MAIN_HALL = { player: 'townhall', enemy: 'greathall' };
export const BUILDABLE = {
  player: ['farm', 'barracks', 'blacksmith', 'tower'],
  enemy: ['pigfarm', 'warmill', 'tradehall', 'watchtower'],
};

export function unitKeysForSide(side) {
  return side === 'player' ? ['peasant', 'footman', 'archer', 'knight'] : ['peon', 'grunt', 'spearman', 'raider'];
}

export function isUnit(key) {
  return Object.prototype.hasOwnProperty.call(UNIT_DATA, key);
}

export function statsFor(key) {
  return UNIT_DATA[key] || BUILDING_DATA[key];
}

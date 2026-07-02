import { Enemy } from "./enemies.js";
import { DUEL_LANE_IDS } from "./paths.js";
import { enemies, game } from "./state.js";

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function makeNormalUnit(wave) {
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

export function makeAirUnit(wave) {
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

export function makeSplitterUnit(wave) {
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

export function makeBossUnit(wave, idx) {
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

// Deterministic summary of what buildWavePlan(wave) will produce (only per-unit
// hp/speed jitter is random), so the player can prepare before starting the wave.
export function getWavePreview(wave) {
  if (wave % 10 === 0) {
    return { tag: "Boss Wave", count: 1 + Math.floor(wave / 20), hint: "Huge boss. Bring heavy single-target damage." };
  }
  if (wave % 5 === 0) {
    return { tag: "Air Wave", count: 12 + wave, hint: "Flying. Only air-capable towers can hit them." };
  }
  if (wave % 7 === 0) {
    return { tag: "Splitter Wave", count: 10 + wave, hint: "Enemies split into children when killed." };
  }
  const spellbreaker = wave >= 9 && wave % 3 === 0;
  return {
    tag: "Assault Wave",
    count: 8 + wave * 2 + (spellbreaker ? 1 : 0),
    hint: spellbreaker ? "Includes a magic-immune Spellbreaker." : "Mixed ground assault.",
  };
}

export function buildWavePlan(wave) {
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

export function buildDuelWavePlan(wave) {
  const base = buildWavePlan(wave);
  const queue = [];
  for (const lane of DUEL_LANE_IDS) {
    for (const unit of base.queue) {
      queue.push({ ...unit, lane, targetPlayer: lane });
    }
  }
  return { tag: `${base.tag} Duel`, interval: base.interval, queue };
}

export function spawnEnemyFromQueue() {
  if (game.spawnQueue.length === 0) {
    return;
  }
  const template = game.spawnQueue.shift();
  enemies.push(new Enemy(template));
}


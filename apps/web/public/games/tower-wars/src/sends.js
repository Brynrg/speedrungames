import { clearSendsBtn, sendButtons, sendQueueEl } from "./dom.js";
import { saveRun } from "./save.js";
import { game, getActivePlayerState, syncActiveToLegacyIfDuel } from "./state.js";
import { status } from "./status.js";

export const SEND_OPTIONS = {
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
export function isSendLocked() {
  return game.waveActive || game.gameOver;
}

export function getIncomePayout(state = game) {
  return Math.max(0, Math.floor(state.income));
}

export function buildRunnerSendUnits(wave) {
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

export function buildArmorSendUnits(wave) {
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

export function buildAirSendUnits(wave) {
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

export function buildBreakerSendUnits(wave) {
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

export function buildSplitterSendUnits(wave) {
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

export function buildMiniBossSendUnits(wave) {
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

export function makeSendUnits(key, wave) {
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

export function queueSend(key) {
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

export function clearSendQueue() {
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

export function consumeSendQueueForWave(state, wave, laneTarget = 0) {
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

export function updateSendUi() {
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

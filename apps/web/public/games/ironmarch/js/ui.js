import { UNIT_DATA, BUILDING_DATA, BUILDABLE } from './constants.js';
import { getById, stopUnit } from './entities.js';
import { queueProduction, purchaseUpgrade, hasBlacksmith } from './economy.js';
import { startPlacement } from './input.js';
import { getRecords } from './save.js';

const UNIT_ICON = { peasant: '🧑‍🌾', footman: '🗡️', archer: '🏹', knight: '🐴', peon: '🧑‍🌾', grunt: '🗡️', spearman: '🏹', raider: '🐺' };
const BUILD_ICON = { farm: '🌾', barracks: '⚔️', blacksmith: '🛡️', tower: '🗼', pigfarm: '🌾', warmill: '⚔️', tradehall: '🛡️', watchtower: '🗼' };

function costLabel(cost) {
  const parts = [];
  if (cost.gold) parts.push(`${cost.gold}g`);
  if (cost.lumber) parts.push(`${cost.lumber}L`);
  return parts.join(' ') || 'free';
}

export function initUI(state, map, { onRestart }) {
  const els = {
    gold: document.getElementById('hud-gold'),
    lumber: document.getElementById('hud-lumber'),
    food: document.getElementById('hud-food'),
    clock: document.getElementById('hud-clock'),
    selection: document.getElementById('selectionPanel'),
    messages: document.getElementById('messages'),
    overlay: document.getElementById('gameOverOverlay'),
    overlayTitle: document.getElementById('gameOverTitle'),
    restartBtn: document.getElementById('restartBtn'),
    restartBtn2: document.getElementById('restartBtn2'),
  };

  const restart = () => onRestart();
  els.restartBtn.addEventListener('click', restart);
  els.restartBtn2.addEventListener('click', restart);

  function selectedEntities() {
    return state.selection.map((id) => getById(state, id)).filter((e) => e && !e.isDead);
  }

  function renderBuildButtons(container) {
    const wrap = document.createElement('div');
    wrap.className = 'btn-row';
    for (const key of BUILDABLE.player) {
      const stats = BUILDING_DATA[key];
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = `${BUILD_ICON[key]}<br>${stats.label}<br><small>${costLabel(stats.cost)}</small>`;
      btn.addEventListener('click', () => startPlacement(state, key));
      wrap.appendChild(btn);
    }
    container.appendChild(wrap);
  }

  // Everything that determines WHICH dom nodes should exist and how they're
  // enabled/disabled — deliberately excludes fast-changing numbers (hp,
  // production progress %, buildProgress %). Those are updated in place via
  // `dyn` refs every frame instead of triggering a rebuild, because a full
  // innerHTML='' + recreate on every animation frame (~60/sec) can straddle
  // a real mousedown/mouseup click and silently swallow it (verified live).
  function computeStructureKey(ents) {
    return ents.map((e) => {
      if (e.kind !== 'building') return `${e.id}:u:${e.type}`;
      const stats = BUILDING_DATA[e.type];
      const techFlags = (stats.produces || []).map((k) => {
        const s = UNIT_DATA[k];
        return s.requiresTech && !state.tech.player.has(s.requiresTech) ? '1' : '0';
      }).join('');
      const upgFlags = stats.unlocksTech ? `${state.upgrades.player.weapon >= 2 ? 1 : 0}${state.upgrades.player.armor >= 2 ? 1 : 0}` : '';
      return `${e.id}:b:${e.type}:${e.constructing ? 1 : 0}:${techFlags}:${upgFlags}`;
    }).join('|');
  }

  let lastStructureKey = Symbol('init'); // never matches on first call
  let dyn = {};

  function buildSingleUnit(container, e) {
    const stats = UNIT_DATA[e.type];
    const title = document.createElement('h3');
    container.appendChild(title);
    if (e.isWorker) renderBuildButtons(container);
    const stopBtn = document.createElement('button');
    stopBtn.className = 'action-btn';
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', () => stopUnit(state, e));
    container.appendChild(stopBtn);
    dyn = { kind: 'single-unit', title, icon: UNIT_ICON[e.type], label: stats.label, maxHp: e.maxHp };
  }

  function buildSingleBuildingConstructing(container, e) {
    const title = document.createElement('h3');
    container.appendChild(title);
    const p = document.createElement('div');
    container.appendChild(p);
    dyn = { kind: 'single-building-constructing', title, progress: p, label: BUILDING_DATA[e.type].label, maxHp: e.maxHp };
  }

  function buildSingleBuildingActive(container, e) {
    const title = document.createElement('h3');
    container.appendChild(title);

    const produces = BUILDING_DATA[e.type].produces;
    let queueEl = null;
    if (produces) {
      const wrap = document.createElement('div');
      wrap.className = 'btn-row';
      for (const key of produces) {
        const stats = UNIT_DATA[key];
        const locked = stats.requiresTech && !state.tech.player.has(stats.requiresTech);
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.disabled = locked;
        btn.innerHTML = `${UNIT_ICON[key]}<br>${stats.label}<br><small>${locked ? 'Needs Blacksmith' : costLabel(stats.cost)}</small>`;
        btn.addEventListener('click', () => queueProduction(state, 'player', e, key));
        wrap.appendChild(btn);
      }
      container.appendChild(wrap);
      queueEl = document.createElement('div');
      queueEl.className = 'queue-row';
      container.appendChild(queueEl);
    }

    if (BUILDING_DATA[e.type].unlocksTech) {
      const wrap = document.createElement('div');
      wrap.className = 'btn-row';
      for (const kind of ['weapon', 'armor']) {
        const lvl = state.upgrades.player[kind];
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.disabled = lvl >= 2;
        btn.innerHTML = `${kind === 'weapon' ? '⚔️' : '🛡️'}<br>${kind === 'weapon' ? 'Weapon' : 'Armor'} +1<br><small>Lvl ${lvl}/2 · 150g 50L</small>`;
        btn.addEventListener('click', () => purchaseUpgrade(state, 'player', kind));
        wrap.appendChild(btn);
      }
      container.appendChild(wrap);
    }

    dyn = { kind: 'single-building-active', title, queueEl, label: BUILDING_DATA[e.type].label, maxHp: e.maxHp };
  }

  function buildMulti(container, ents) {
    const title = document.createElement('h3');
    title.textContent = `${ents.length} selected`;
    container.appendChild(title);
    const list = document.createElement('p');
    container.appendChild(list);

    const workers = ents.filter((e) => e.kind === 'unit' && e.isWorker);
    if (workers.length === ents.length) renderBuildButtons(container);

    const units = ents.filter((e) => e.kind === 'unit');
    if (units.length) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'action-btn';
      stopBtn.textContent = 'Stop';
      stopBtn.addEventListener('click', () => units.forEach((u) => stopUnit(state, u)));
      container.appendChild(stopBtn);
    }
    dyn = { kind: 'multi', list };
  }

  function updateDynamic(ents) {
    if (dyn.kind === 'single-unit') {
      const e = ents[0];
      dyn.title.textContent = `${dyn.icon} ${dyn.label} (${Math.round(e.hp)}/${dyn.maxHp} HP)`;
    } else if (dyn.kind === 'single-building-constructing') {
      const e = ents[0];
      dyn.title.textContent = `${dyn.label} (${Math.round(e.hp)}/${dyn.maxHp} HP)`;
      dyn.progress.textContent = `Building... ${Math.round(e.buildProgress * 100)}%`;
    } else if (dyn.kind === 'single-building-active') {
      const e = ents[0];
      dyn.title.textContent = `${dyn.label} (${Math.round(e.hp)}/${dyn.maxHp} HP)`;
      if (dyn.queueEl) {
        dyn.queueEl.textContent = e.productionQueue.length
          ? 'Queue: ' + e.productionQueue.map((it) => `${UNIT_DATA[it.unitType].label} ${Math.round(it.progress * 100)}%`).join(', ')
          : '';
      }
    } else if (dyn.kind === 'multi') {
      const counts = new Map();
      for (const e of ents) {
        const label = e.kind === 'unit' ? UNIT_DATA[e.type].label : BUILDING_DATA[e.type].label;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      dyn.list.textContent = Array.from(counts.entries()).map(([k, v]) => `${v}× ${k}`).join(', ');
    }
  }

  function renderSelection() {
    const container = els.selection;
    const ents = selectedEntities();
    const key = ents.length ? computeStructureKey(ents) : '';

    if (key !== lastStructureKey) {
      lastStructureKey = key;
      container.innerHTML = '';
      dyn = {};
      if (!ents.length) {
        container.innerHTML = '<p class="hint">Select units or buildings. Right-click to move, harvest, build, or attack.</p>';
      } else if (ents.length === 1 && ents[0].kind === 'building' && ents[0].constructing) {
        buildSingleBuildingConstructing(container, ents[0]);
      } else if (ents.length === 1 && ents[0].kind === 'building') {
        buildSingleBuildingActive(container, ents[0]);
      } else if (ents.length === 1) {
        buildSingleUnit(container, ents[0]);
      } else {
        buildMulti(container, ents);
      }
    }

    if (ents.length) updateDynamic(ents);
  }

  function renderMessages() {
    els.messages.innerHTML = state.messages.map((m) => `<div class="toast">${m.text}</div>`).join('');
  }

  function renderOverlay() {
    if (state.mode === 'playing') {
      els.overlay.classList.add('hidden');
      return;
    }
    els.overlay.classList.remove('hidden');
    els.overlayTitle.textContent = state.mode === 'victory' ? 'Victory!' : 'Defeat';
    els.overlayTitle.className = state.mode === 'victory' ? 'victory' : 'defeat';
    // Career record (save-systems): persisted across sessions.
    const rec = getRecords();
    const fastest = rec.fastestWinMs !== null ? ` · fastest win ${formatClock(rec.fastestWinMs)}` : '';
    let recEl = document.getElementById('gameOverRecord');
    if (!recEl) {
      recEl = document.createElement('p');
      recEl.id = 'gameOverRecord';
      els.overlayTitle.insertAdjacentElement('afterend', recEl);
    }
    recEl.textContent = `Record: ${rec.wins}W – ${rec.losses}L${fastest}`;
  }

  function formatClock(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }

  let prevGold = Math.floor(state.resources.player.gold);
  let prevLumber = Math.floor(state.resources.player.lumber);

  function pulse(el) {
    el.classList.remove('stat-pulse');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('stat-pulse');
  }

  return function syncHUD() {
    const gold = Math.floor(state.resources.player.gold);
    const lumber = Math.floor(state.resources.player.lumber);
    if (gold > prevGold) pulse(els.gold.parentElement);
    if (lumber > prevLumber) pulse(els.lumber.parentElement);
    prevGold = gold;
    prevLumber = lumber;
    els.gold.textContent = gold;
    els.lumber.textContent = lumber;
    els.food.textContent = `${state.food.player.used}/${state.food.player.max}`;
    els.clock.textContent = formatClock(state.time);
    renderSelection();
    renderMessages();
    renderOverlay();
  };
}

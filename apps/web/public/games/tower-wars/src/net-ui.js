import { game, towers } from "./state.js";
import { net, isOnlineDuel, isHostClient, createHostOffer, acceptHostAnswer, joinWithOffer, disconnectNet, tickHostBroadcast, onNetStateChange, registerHostCommandHandler } from "./net.js";
function getEl(id) {
return typeof document !== "undefined" ? document.getElementById(id) : null;
}

function findNearestP2Tower(x, y) {
if (typeof x !== "number" || typeof y !== "number") return null;
let best = null;
let bestDist = Infinity;
for (const t of towers) {
if (t.owner !== 1) continue;
const dx = t.x - x;
const dy = t.y - y;
const dist = dx * dx + dy * dy;
if (dist < bestDist) {
bestDist = dist;
best = t;
}
}
return best;
}
export function initNetUi(actions = {}) {
  const netOverlay = getEl("netOverlay");
  const onlineDuelBtn = getEl("onlineDuelBtn");
  const menuOnlineDuel = getEl("menuOnlineDuel");
  const netCloseBtn = getEl("netCloseBtn");
  const netHostBtn = getEl("netHostBtn");
  const netOfferOut = getEl("netOfferOut");
  const netCopyOffer = getEl("netCopyOffer");
  const netAnswerIn = getEl("netAnswerIn");
  const netAcceptAnswerBtn = getEl("netAcceptAnswerBtn");
  const netOfferIn = getEl("netOfferIn");
  const netJoinBtn = getEl("netJoinBtn");
  const netAnswerOut = getEl("netAnswerOut");
  const netCopyAnswer = getEl("netCopyAnswer");
  const netDisconnectBtn = getEl("netDisconnectBtn");
  const netStatusText = getEl("netStatusText");
  const netPingText = getEl("netPingText");

  function openNetOverlay() {
    const menuOverlay = getEl("menuOverlay");
    if (menuOverlay && !menuOverlay.classList.contains("hidden")) {
      actions.closeMenu?.({ resume: false });
    }
    if (!netOverlay) return;
    netOverlay.classList.remove("hidden");
    netOverlay.setAttribute("aria-hidden", "false");
  }

  function closeNetOverlay() {
    if (!netOverlay) return;
    netOverlay.classList.add("hidden");
    netOverlay.setAttribute("aria-hidden", "true");
  }

  function wireCopyButton(btn, textarea) {
    btn?.addEventListener("click", async () => {
      if (!textarea) return;
      const value = textarea.value || "";
      if (!value) return;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          textarea.focus?.();
          textarea.select?.();
        }
      } catch {
        textarea.focus?.();
        textarea.select?.();
      }
    });
  }

  onlineDuelBtn?.addEventListener("click", openNetOverlay);
  menuOnlineDuel?.addEventListener("click", openNetOverlay);
  netCloseBtn?.addEventListener("click", closeNetOverlay);

  netHostBtn?.addEventListener("click", async () => {
    try {
      const code = await createHostOffer();
      if (netOfferOut) netOfferOut.value = code || "";
    } catch (err) {
      if (netStatusText) netStatusText.textContent = err?.message || "Failed to create host offer.";
    }
  });

  netAcceptAnswerBtn?.addEventListener("click", async () => {
    const code = netAnswerIn?.value?.trim() || "";
    if (!code) return;
    try {
      await acceptHostAnswer(code);
    } catch (err) {
      if (netStatusText) netStatusText.textContent = err?.message || "Failed to accept answer.";
    }
  });

  netJoinBtn?.addEventListener("click", async () => {
    const code = netOfferIn?.value?.trim() || "";
    if (!code) return;
    try {
      const answer = await joinWithOffer(code);
      if (netAnswerOut) netAnswerOut.value = answer || "";
    } catch (err) {
      if (netStatusText) netStatusText.textContent = err?.message || "Failed to join with offer.";
    }
  });

  wireCopyButton(netCopyOffer, netOfferOut);
  wireCopyButton(netCopyAnswer, netAnswerOut);

  netDisconnectBtn?.addEventListener("click", () => {
    disconnectNet("Disconnected by user.");
  });

  onNetStateChange((state = net) => {
    if (netStatusText) {
      if (state.lastError) {
        netStatusText.textContent = state.lastError;
      } else if (state.connected) {
        netStatusText.textContent = state.role === "host" ? "Connected (Host - P1)" : "Connected (Guest - P2)";
      } else {
        netStatusText.textContent = state.status || "Offline";
      }
    }
    if (netPingText) {
      netPingText.textContent = state.connected && state.pingMs != null ? `${Math.round(state.pingMs)} ms` : "--";
    }
    if (netDisconnectBtn) {
      const visible = Boolean(state.connected || (state.role && state.role !== "offline"));
      netDisconnectBtn.classList.toggle("hidden", !visible);
    }
    if (state.connected) {
      if (!game.duelMode) {
        actions.setGameMode?.("duel");
      }
      game.activePlayer = state.localPlayer;
      closeNetOverlay();
      actions.syncUi?.();
      if (isHostClient()) {
        tickHostBroadcast(0, true);
      }
    }
  });

  registerHostCommandHandler((action, payload = {}) => {
    if (!isOnlineDuel() || !isHostClient()) return;

    const prevPlayer = game.activePlayer ?? 0;
    const prevSelectedType = game.selectedType;
    const prevSelectedTower = game.selectedTower;

    game.activePlayer = 1;
    try {
      const tx = payload.x ?? payload.cx;
      const ty = payload.y ?? payload.cy;
      switch (action) {
        case "build":
          if (payload.type) game.selectedType = payload.type;
          actions.placeTower?.(payload.cx ?? payload.x, payload.cy ?? payload.y);
          break;
        case "upgrade":
          game.selectedTower = findNearestP2Tower(tx, ty);
          if (game.selectedTower) actions.tryUpgradeSelected?.();
          break;
        case "branch":
          game.selectedTower = findNearestP2Tower(tx, ty);
          if (game.selectedTower && payload.branch != null) actions.chooseBranch?.(payload.branch);
          break;
        case "sell":
          game.selectedTower = findNearestP2Tower(tx, ty);
          if (game.selectedTower) actions.sellSelectedTower?.();
          break;
        case "ability":
          game.selectedTower = findNearestP2Tower(tx, ty);
          if (game.selectedTower) actions.castSelectedAbility?.();
          break;
        case "priority":
          game.selectedTower = findNearestP2Tower(tx, ty);
          if (game.selectedTower) actions.cycleSelectedPriority?.();
          break;
        case "send":
          actions.queueSend?.(payload.type ?? payload.enemyType ?? payload);
          break;
        case "clearSends":
          actions.clearSendQueue?.();
          break;
        case "startWave":
          actions.startWave?.();
          break;
        case "speed":
          actions.cycleSpeed?.();
          break;
        case "pause":
          actions.togglePause?.();
          break;
      }
    } finally {
      game.activePlayer = prevPlayer;
      game.selectedType = prevSelectedType;
      game.selectedTower = prevSelectedTower;
    }

    actions.updateSelectionPanel?.();
    actions.syncUi?.();
    tickHostBroadcast(0, true);
  });
}

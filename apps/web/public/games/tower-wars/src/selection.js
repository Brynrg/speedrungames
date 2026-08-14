import { DAMAGE_LABELS } from "./damage.js";
import { branchAButton, branchBButton, branchControlsEl, castAbilityBtn, selAuraEl, selBranchEl, selDamageEl, selDamageTypeEl, selLevelEl, selRangeEl, selRateEl, selSubEl, selTitleEl, selTypeEl, selectionDetailsEl, selectionNoneEl, upgradeTowerBtn, sellTowerBtn, selKillsEl, targetPriorityBtn } from "./dom.js";
import { game, getPlayerState, towers } from "./state.js";

export function updateSelectionPanel() {
  const tower = game.selectedTower;
  if (!tower || !towers.includes(tower)) {
    game.selectedTower = null;
    selectionNoneEl.classList.remove("hidden");
    selectionDetailsEl.classList.add("hidden");
    branchControlsEl.classList.add("hidden");
    if (selTitleEl) {
      selTitleEl.textContent = "Tower";
    }
    if (selSubEl) {
      selSubEl.textContent = "Role and element";
    }
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
  if (selKillsEl) {
    selKillsEl.textContent = String(tower.kills);
  }
  if (selTitleEl) {
    selTitleEl.textContent = tower.data.name;
  }
  if (selSubEl) {
    const roles = tower.data.roleTags ? tower.data.roleTags.join("/") : "Tower";
    selSubEl.textContent = `${tower.data.element || "Neutral"} ${roles} | ${tower.canHitAir ? "Air" : "Ground"}`;
  }
  const ownerState = game.duelMode ? getPlayerState(tower.owner) : game;
  const controllable = !game.duelMode || tower.owner === game.activePlayer;

  if (sellTowerBtn) {
    sellTowerBtn.textContent = `Sell (S) +${tower.sellValue}g`;
    sellTowerBtn.disabled = !controllable;
  }

  if (!tower.canUpgrade()) {
    upgradeTowerBtn.textContent = "Max Level";
    upgradeTowerBtn.disabled = true;
  } else {
    upgradeTowerBtn.textContent = `Upgrade (U) - ${tower.upgradeCost}g`;
    upgradeTowerBtn.disabled = !controllable || ownerState.gold < tower.upgradeCost;
  }

  if (targetPriorityBtn) {
    const labels = { first: "First", last: "Last", strong: "Strong", weak: "Weak" };
    targetPriorityBtn.textContent = `Target: ${labels[tower.priority] || "First"} (G)`;
    targetPriorityBtn.disabled = !controllable;
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


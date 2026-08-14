import { playSfx } from "./audio.js";
import { towerButtons } from "./dom.js";
import { Effect } from "./projectiles.js";
import { inBounds, worldFromCell } from "./grid.js";
import { computeMazeDistanceMap, isMazeReservedCell, rebuildMazeDistances } from "./maze.js";
import { DUEL_PATH_SET, PATH_SET } from "./paths.js";
import { getTowerAtCell } from "./picking.js";
import { saveRun } from "./save.js";
import { effects, enemies, game, getLaneOwnerForCell, getPlayerState, syncActiveToLegacyIfDuel, towers } from "./state.js";
import { updateSelectionPanel } from "./selection.js";
import { status } from "./status.js";
import { TOWER_DATA, Tower } from "./towers.js";

export function getBuildBlockReason(cx, cy) {
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

export function canBuildOnCell(cx, cy) {
  return getBuildBlockReason(cx, cy) === null;
}

export function setSelectedType(type) {
  game.selectedType = type;
  for (const button of towerButtons) {
    button.classList.toggle("active", button.dataset.type === type);
  }
}

export function tryBuildTower(cx, cy) {
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

export function tryUpgradeSelectedTower() {
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
  tower.invested += cost;
  syncActiveToLegacyIfDuel();
  status(`${tower.data.name} upgraded to level ${tower.level}.`);
  playSfx("upgrade");
}

export function chooseBranch(branchKey) {
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
  tower.invested += cost;
  syncActiveToLegacyIfDuel();
  status(`${tower.data.name} specialized into ${tower.branchData.name}.`);
  playSfx("upgrade");
}


export function cycleSelectedPriority() {
  const tower = game.selectedTower;
  if (!tower || !towers.includes(tower)) {
    status("Select a tower to change its targeting.");
    return;
  }
  if (game.duelMode && tower.owner !== game.activePlayer) {
    status(`Switch to P${tower.owner + 1} to command this tower.`);
    return;
  }
  const labels = { first: "First (stops leaks)", last: "Last (guards the entrance)", strong: "Strongest (burns tanks)", weak: "Weakest (secures kills)" };
  const mode = tower.cyclePriority();
  status(`Targeting: ${labels[mode]}`);
  updateSelectionPanel();
}

export function sellSelectedTower() {
  const tower = game.selectedTower;
  if (!tower || !towers.includes(tower)) {
    status("Select a tower to sell.");
    return;
  }
  if (game.duelMode && tower.owner !== game.activePlayer) {
    status(`Switch to P${tower.owner + 1} to sell this tower.`);
    return;
  }

  const ownerState = game.duelMode ? getPlayerState(tower.owner) : game;
  const refund = tower.sellValue;
  towers.splice(towers.indexOf(tower), 1);
  ownerState.gold += refund;
  game.selectedTower = null;

  if (game.mode === "maze") {
    rebuildMazeDistances();
    for (const enemy of enemies) {
      if (enemy.routeMode === "maze-ground") {
        enemy.mazeTargetX = null;
        enemy.mazeTargetY = null;
      }
    }
  }

  effects.push(new Effect(tower.x, tower.y, "text", { text: `+${refund}g`, color: "#f8e59f" }));
  syncActiveToLegacyIfDuel();
  status(`${tower.data.name} sold for ${refund} gold.`);
  playSfx("build");
  saveRun(false);
}

export function castSelectedAbility() {
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


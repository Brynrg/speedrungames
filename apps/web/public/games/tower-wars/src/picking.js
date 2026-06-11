import { TILE } from "./constants.js";
import { enemies, towers } from "./state.js";

export function getTowerAtCell(cx, cy) {
  return towers.find((tower) => Math.floor(tower.x / TILE) === cx && Math.floor(tower.y / TILE) === cy) || null;
}

export function getTowerAtPoint(x, y) {
  for (let i = towers.length - 1; i >= 0; i -= 1) {
    const tower = towers[i];
    if (Math.hypot(tower.x - x, tower.y - y) <= 18) {
      return tower;
    }
  }
  return null;
}

export function getEnemyAtPoint(x, y) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    if (Math.hypot(enemy.x - x, enemy.y - y) <= enemy.radius + 1) {
      return enemy;
    }
  }
  return null;
}

export function getEnemyProgress(enemy) {
  return enemy.progress ?? enemy.pathIndex + enemy.segmentProgress;
}


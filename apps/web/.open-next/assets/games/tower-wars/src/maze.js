import { COLS, ROWS, TILE } from "./constants.js";
import { inBounds, worldFromCell } from "./grid.js";
import { DIR4, MAZE_EXIT, MAZE_START } from "./paths.js";
import { game, towers } from "./state.js";

export let mazeDistances = null;
export function isMazeReservedCell(cx, cy) {
  return (cx === MAZE_START.cx && cy === MAZE_START.cy) || (cx === MAZE_EXIT.cx && cy === MAZE_EXIT.cy);
}

export function getBlockedMazeCellSet(extraBlockedCell = null) {
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

export function computeMazeDistanceMap(extraBlockedCell = null) {
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

export function rebuildMazeDistances() {
  if (game.mode !== "maze") {
    mazeDistances = null;
    return true;
  }
  const result = computeMazeDistanceMap();
  mazeDistances = result.dist;
  return result.reachable;
}
export function getMazePreviewPoints() {
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

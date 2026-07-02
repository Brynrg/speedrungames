import { COLS, ROWS, TILE } from "./constants.js";

export const PATH_NODES = (() => {
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

export function buildPathCells(nodes) {
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

export const PATH_CELLS = buildPathCells(PATH_NODES);

export const WAYPOINTS = PATH_NODES.map(([cx, cy]) => ({
  x: cx * TILE + TILE / 2,
  y: cy * TILE + TILE / 2,
}));

export const PATH_SET = new Set(PATH_CELLS.map(([x, y]) => `${x},${y}`));
export const MAZE_START = { cx: PATH_NODES[0][0], cy: PATH_NODES[0][1] };
export const MAZE_EXIT = { cx: PATH_NODES[PATH_NODES.length - 1][0], cy: PATH_NODES[PATH_NODES.length - 1][1] };
export const DUEL_LANE_IDS = [0, 1];

export function buildDuelPathNodes(laneId) {
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

export const DUEL_PATH_NODES = DUEL_LANE_IDS.map((laneId) => buildDuelPathNodes(laneId));
export const DUEL_PATH_CELLS = DUEL_PATH_NODES.map((nodes) => buildPathCells(nodes));
export const DUEL_PATH_SET = new Set(DUEL_PATH_CELLS.flat().map(([x, y]) => `${x},${y}`));
export const DUEL_WAYPOINTS = DUEL_PATH_NODES.map((nodes) => nodes.map(([cx, cy]) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 })));
export const DUEL_SPAWNS = DUEL_PATH_NODES.map((nodes) => ({ cx: nodes[0][0], cy: nodes[0][1] }));
export const DUEL_EXITS = DUEL_PATH_NODES.map((nodes) => ({ cx: nodes[nodes.length - 1][0], cy: nodes[nodes.length - 1][1] }));
export const DIR4 = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

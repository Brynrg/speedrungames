import { COLS, ROWS, TILE } from "./constants.js";

export function worldFromCell(cx, cy) {
  return {
    x: cx * TILE + TILE / 2,
    y: cy * TILE + TILE / 2,
  };
}

export function getCellAt(x, y) {
  return {
    cx: Math.floor(x / TILE),
    cy: Math.floor(y / TILE),
  };
}

export function inBounds(cx, cy) {
  return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


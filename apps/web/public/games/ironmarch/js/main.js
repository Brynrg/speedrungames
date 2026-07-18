import { VIEW_W, VIEW_H, MINIMAP_W, MINIMAP_H } from './constants.js';
import { createGame, updateGame, resetGame } from './game.js';
import { render as renderScene, renderMinimap } from './render.js';
import { setupInput } from './input.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('gameCanvas');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const minimapCanvas = document.getElementById('minimapCanvas');
minimapCanvas.width = MINIMAP_W;
minimapCanvas.height = MINIMAP_H;
const miniCtx = minimapCanvas.getContext('2d');

const session = createGame();

setupInput(session.state, session.map, canvas, minimapCanvas);
const syncHUD = initUI(session.state, session.map, {
  onRestart: () => resetGame(session),
});

let lastTs = null;
function frame(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(100, ts - lastTs);
  lastTs = ts;

  updateGame(session.state, session.map, session.fow, dt);
  renderScene(ctx, session.state, session.map, session.fow);
  renderMinimap(miniCtx, session.state, session.map, session.fow);
  syncHUD();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Grid settings
const COLS = 10;
const ROWS = 15;
const TILE_SIZE = 40;

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#444";

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, ROWS * TILE_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(COLS * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }
}

// Game loop
function gameLoop() {
  drawGrid();
  requestAnimationFrame(gameLoop);
}

gameLoop();

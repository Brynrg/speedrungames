import { HIGH_SCORE_KEY } from "./constants.js";
import { highScoresEl } from "./dom.js";
import { game } from "./state.js";

export let highScores = loadHighScores();
export function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry) => entry && typeof entry.wave === "number" && typeof entry.score === "number").slice(0, 12);
  } catch {
    return [];
  }
}

export function saveHighScores() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
  } catch {
    // ignore localStorage failures
  }
}

export function renderHighScores() {
  highScoresEl.innerHTML = "";

  if (highScores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No runs recorded yet.";
    highScoresEl.appendChild(li);
    return;
  }

  for (let i = 0; i < Math.min(5, highScores.length); i += 1) {
    const entry = highScores[i];
    const li = document.createElement("li");
    li.textContent = `Wave ${entry.wave} | Score ${entry.score}`;
    highScoresEl.appendChild(li);
  }
}

export function recordHighScore() {
  if (game.scoreRecorded || game.wave <= 0) {
    return;
  }

  highScores.push({
    wave: game.wave,
    score: game.score,
    date: new Date().toISOString(),
  });

  highScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.wave - a.wave;
  });

  highScores = highScores.slice(0, 12);
  saveHighScores();
  renderHighScores();
  game.scoreRecorded = true;
  game.bestWave = highScores[0]?.wave || 0;
}

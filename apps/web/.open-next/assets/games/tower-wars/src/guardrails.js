import { HIGH_SCORE_KEY, RUN_SAVE_KEY, SPEED_LEVELS } from "./constants.js";
import { autoWaveBtn, branchAButton, branchBButton, canvas, castAbilityBtn, clearSendsBtn, ctx, loadRunBtn, modeClassicBtn, modeDuelBtn, modeMazeBtn, newRunBtn, pauseGameBtn, saveRunBtn, sendAirBtn, sendArmorBtn, sendBreakerBtn, sendMiniBossBtn, sendRunnerBtn, sendSplitterBtn, speedGameBtn, startWaveBtn, tooltipBoxEl, upgradeTowerBtn, waveStatusEl } from "./dom.js";

export const REQUIRED_DOM_REFS = [
  ["game", canvas],
  ["waveStatus", waveStatusEl],
  ["tooltipBox", tooltipBoxEl],
  ["startWave", startWaveBtn],
  ["pauseGame", pauseGameBtn],
  ["speedGame", speedGameBtn],
  ["autoWave", autoWaveBtn],
  ["modeClassic", modeClassicBtn],
  ["modeMaze", modeMazeBtn],
  ["modeDuel", modeDuelBtn],
  ["saveRun", saveRunBtn],
  ["loadRun", loadRunBtn],
  ["newRun", newRunBtn],
  ["upgradeTower", upgradeTowerBtn],
  ["castAbility", castAbilityBtn],
  ["branchA", branchAButton],
  ["branchB", branchBButton],
  ["sendRunner", sendRunnerBtn],
  ["sendArmor", sendArmorBtn],
  ["sendAir", sendAirBtn],
  ["sendBreaker", sendBreakerBtn],
  ["sendSplitter", sendSplitterBtn],
  ["sendMiniBoss", sendMiniBossBtn],
  ["clearSends", clearSendsBtn],
];

export function runStartupGuardrails() {
  const missing = REQUIRED_DOM_REFS.filter(([, ref]) => !ref).map(([id]) => id);
  if (!ctx) {
    missing.push("2d-canvas-context");
  }
  if (missing.length > 0) {
    const msg = `[Guardrail] Missing required DOM hooks: ${missing.join(", ")}`;
    console.error(msg);
    throw new Error(msg);
  }
  if (!Array.isArray(SPEED_LEVELS) || SPEED_LEVELS[0] !== 1 || SPEED_LEVELS[SPEED_LEVELS.length - 1] < 5) {
    const msg = `[Guardrail] SPEED_LEVELS must start at 1 and include 5x. Got: ${JSON.stringify(SPEED_LEVELS)}`;
    console.error(msg);
    throw new Error(msg);
  }
  if (!RUN_SAVE_KEY.endsWith("_v2") || !HIGH_SCORE_KEY.endsWith("_v2")) {
    console.warn(`[Guardrail] Save keys changed: run=${RUN_SAVE_KEY}, highscores=${HIGH_SCORE_KEY}`);
  }
}

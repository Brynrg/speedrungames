export const CONTROL_TOOLTIPS = {
  nextWaveBtn: "Start the next wave when you are ready.",
  speedBtn: "Cycle game speed: 1x, 2x, 3x, 4x, 5x.",
  menuBtn: "Pause and open menu options.",
  startWave: "Start the next wave when you are ready.",
  pauseGame: "Pause or resume the game simulation.",
  speedGame: "Cycle game speed: 1x, 2x, 3x, 4x, 5x.",
  autoWave: "Auto-start the next wave after a clear.",
  modeClassic: "Classic mode: fixed creep path.",
  modeMaze: "Maze mode: build towers to shape the path.",
  modeDuel: "Duel mode: two lanes, sends target the opponent.",
  duelP1Btn: "Switch active controls to Player 1.",
  duelP2Btn: "Switch active controls to Player 2.",
  upgradeTower: "Upgrade selected tower stats.",
  castAbility: "Cast selected tower branch ability.",
  branchA: "Choose branch A specialization.",
  branchB: "Choose branch B specialization.",
  sendRunner: "Queue fast light creeps for next wave.",
  sendArmor: "Queue durable heavy creeps for next wave.",
  sendAir: "Queue flying creeps for next wave.",
  sendBreaker: "Queue a magic-immune heavy creep.",
  sendSplitter: "Queue splitter creeps for next wave.",
  sendMiniBoss: "Queue one mini-boss for next wave.",
  clearSends: "Clear queued sends and refund cost/income.",
  saveRun: "Save current run to local storage.",
  loadRun: "Load the last saved run.",
  newRun: "Start a fresh run.",
  menuResume: "Close menu and resume the game.",
  menuRestart: "Start a fresh run immediately.",
  menuHome: "Return to the Speedrun Games home page.",
};

export const TILE = 48;
export const COLS = 34;
export const ROWS = 20;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const CAMERA_KEY_PAN_SPEED = 560;

export const RUN_SAVE_KEY = "green_circle_td_run_v2";
export const HIGH_SCORE_KEY = "green_circle_td_highscores_v2";
export const SPEED_LEVELS = [1, 2, 3, 4, 5];
export const HOME_URL = window.SPEEDRUN_HOME_URL || "/";
export const COMMAND_TABS = ["build", "wave", "selection", "send"];

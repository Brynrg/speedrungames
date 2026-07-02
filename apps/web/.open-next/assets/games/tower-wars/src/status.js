import { waveStatusEl } from "./dom.js";
import { game, statusBanners } from "./state.js";

export function status(text) {
  if (!text) {
    return;
  }
  game.message = text;
  waveStatusEl.textContent = text;
  statusBanners.unshift({ text, life: 3.2 });
  if (statusBanners.length > 4) {
    statusBanners.length = 4;
  }
}


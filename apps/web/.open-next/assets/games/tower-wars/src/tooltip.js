import { COMMAND_TABS, CONTROL_TOOLTIPS } from "./constants.js";
import { commandPanels, commandTabButtons, tooltipBoxEl } from "./dom.js";
import { game } from "./state.js";

export function defaultTooltip() {
  return "Hover buttons, towers, and enemies for detail. Wheel zooms, Shift+Wheel pans horizontally.";
}

export function setTooltip(text) {
  tooltipBoxEl.textContent = text || defaultTooltip();
}

export function setCommandTab(tab, force = false) {
  const next = COMMAND_TABS.includes(tab) ? tab : "build";
  if (!force && game.commandTab === next) {
    return;
  }
  game.commandTab = next;
  for (const button of commandTabButtons) {
    button.classList.toggle("active", button.dataset.commandTab === next);
  }
  for (const panel of commandPanels) {
    const panelTab = panel.dataset.commandPanel;
    panel.classList.toggle("hidden", panelTab !== next);
  }
}

export function getButtonTooltip(button) {
  if (button.dataset.tip) {
    return button.dataset.tip;
  }
  if (button.id && CONTROL_TOOLTIPS[button.id]) {
    return CONTROL_TOOLTIPS[button.id];
  }
  if (button.title) {
    return button.title;
  }
  return button.textContent.replace(/\s+/g, " ").trim();
}


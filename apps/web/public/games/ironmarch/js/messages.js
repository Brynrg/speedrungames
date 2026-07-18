import { MESSAGE_TTL_MS } from './constants.js';

export function pushMessage(state, text, side = 'player') {
  if (side !== 'player') return;
  state.messages.push({ text, age: 0 });
  if (state.messages.length > 5) state.messages.shift();
}

export function updateMessages(state, dt) {
  for (const m of state.messages) m.age += dt;
  state.messages = state.messages.filter((m) => m.age < MESSAGE_TTL_MS);
}

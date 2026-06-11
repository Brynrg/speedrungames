import { audio, game } from "./state.js";

export function initAudio() {
  if (audio.ctx) {
    return;
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    audio.ctx = new AudioCtx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.045;
    audio.master.connect(audio.ctx.destination);

    startMusicLoop();
  } catch {
    // audio unavailable
  }
}

export function ensureAudioActive() {
  if (!audio.ctx) {
    initAudio();
  }
  if (audio.ctx && audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }
}

export function playTone(freq, duration, type, gain) {
  if (!audio.ctx || !audio.master) {
    return;
  }

  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.ctx.currentTime);
  amp.gain.setValueAtTime(gain, audio.ctx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + duration);

  osc.connect(amp);
  amp.connect(audio.master);

  osc.start(audio.ctx.currentTime);
  osc.stop(audio.ctx.currentTime + duration);
}

export function playSfx(kind) {
  ensureAudioActive();
  if (!audio.ctx) {
    return;
  }

  const now = performance.now();
  const last = audio.lastEvent.get(kind) || 0;
  const throttle = { shoot: 60, kill: 70, leak: 180, build: 110, wave: 260, clear: 260, upgrade: 140, ability: 120, immune: 90 }[kind] || 60;
  if (now - last < throttle) {
    return;
  }
  audio.lastEvent.set(kind, now);

  if (kind === "shoot") {
    playTone(520 + Math.random() * 60, 0.06, "triangle", 0.05);
  } else if (kind === "kill") {
    playTone(260, 0.09, "square", 0.06);
  } else if (kind === "leak") {
    playTone(120, 0.2, "sawtooth", 0.08);
  } else if (kind === "build") {
    playTone(320, 0.08, "triangle", 0.055);
  } else if (kind === "wave") {
    playTone(180, 0.15, "triangle", 0.065);
    playTone(250, 0.18, "triangle", 0.045);
  } else if (kind === "clear") {
    playTone(420, 0.16, "triangle", 0.06);
    playTone(560, 0.2, "triangle", 0.05);
  } else if (kind === "upgrade") {
    playTone(390, 0.09, "triangle", 0.06);
  } else if (kind === "ability") {
    playTone(610, 0.12, "sawtooth", 0.07);
  } else if (kind === "immune") {
    playTone(170, 0.08, "square", 0.05);
  }
}

export function startMusicLoop() {
  if (!audio.ctx || audio.musicTimer) {
    return;
  }

  const notes = [196, 220, 246, 196, 174, 196, 220, 262];
  audio.musicStep = 0;

  audio.musicTimer = setInterval(() => {
    if (!audio.ctx || game.gameOver) {
      return;
    }
    if (game.paused) {
      return;
    }
    const note = notes[audio.musicStep % notes.length];
    playTone(note, 0.24, "triangle", 0.018);
    audio.musicStep += 1;
  }, 480);
}

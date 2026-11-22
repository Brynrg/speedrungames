import { game, towers, enemies, projectiles, effects, areaEffects, statusBanners } from "./state.js";
import { TOWER_DATA } from "./towers.js";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const CODE_PREFIX = "TW1:";
const ICE_GATHER_TIMEOUT_MS = 2500;
const SNAPSHOT_INTERVAL_MS = 65;
const HEARTBEAT_INTERVAL_MS = 2000;

export const net = {
  role: "offline",
  status: "idle",
  connected: false,
  localPlayer: 0,
  pingMs: null,
  lastError: "",
};

const stateListeners = new Set();
let hostCommandHandler = null;
let peerConnection = null;
let dataChannel = null;
let heartbeatTimer = null;
let broadcastAccumMs = 0;

function notifyNetState() {
  const snapshot = { ...net };
  for (const cb of stateListeners) {
    try {
      cb(snapshot);
    } catch {
      // Ignore listener errors so networking stays resilient.
    }
  }
}

export function isOnlineDuel() {
  return net.role === "host" || net.role === "guest";
}

export function isHostClient() {
  return net.role === "host";
}

export function isGuestClient() {
  return net.role === "guest";
}

export function onNetStateChange(cb) {
  if (typeof cb !== "function") return () => {};
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export function registerHostCommandHandler(cb) {
  hostCommandHandler = typeof cb === "function" ? cb : null;
}

function getRtcPeerConnectionCtor() {
  if (typeof RTCPeerConnection === "function") return RTCPeerConnection;
  if (typeof globalThis !== "undefined" && typeof globalThis.RTCPeerConnection === "function") {
    return globalThis.RTCPeerConnection;
  }
  return null;
}

function encodeSignalCode(desc) {
  const json = JSON.stringify({ type: desc.type, sdp: desc.sdp });
  let b64;
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(bin);
  } else if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(json, "utf8").toString("base64");
  } else {
    throw new Error("Base64 encoding is not supported in this environment.");
  }
  return CODE_PREFIX + b64;
}

function decodeSignalCode(code) {
  if (typeof code !== "string" || !code.trim().startsWith(CODE_PREFIX)) {
    throw new Error("Invalid connection code format (expected TW1: prefix).");
  }
  const b64 = code.trim().slice(CODE_PREFIX.length);
  let json;
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    json = new TextDecoder().decode(bytes);
  } else if (typeof Buffer !== "undefined") {
    json = Buffer.from(b64, "base64").toString("utf8");
  } else {
    throw new Error("Base64 decoding is not supported in this environment.");
  }
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed.type !== "string" || typeof parsed.sdp !== "string") {
    throw new Error("Invalid SDP payload in connection code.");
  }
  return parsed;
}

function waitForIceGathering(pc, timeoutMs = ICE_GATHER_TIMEOUT_MS) {
  if (!pc || pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (typeof pc.removeEventListener === "function") {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
      }
      resolve();
    };

    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        finish();
      }
    };

    if (typeof pc.addEventListener === "function") {
      pc.addEventListener("icegatheringstatechange", onStateChange);
    }
    timer = setTimeout(finish, timeoutMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  });
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!dataChannel || dataChannel.readyState !== "open") return;
    try {
      dataChannel.send(JSON.stringify({ type: "ping", t: Date.now() }));
    } catch {
      // Ignore send errors; channel close/error handlers will clean up.
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (heartbeatTimer && typeof heartbeatTimer.unref === "function") {
    heartbeatTimer.unref();
  }
}

function sendJson(msg) {
  if (!dataChannel || dataChannel.readyState !== "open") return false;
  try {
    dataChannel.send(JSON.stringify(msg));
    return true;
  } catch (err) {
    net.lastError = err?.message || "Failed to send message over DataChannel.";
    notifyNetState();
    return false;
  }
}

function applyHostSnapshot(s) {
  if (!s || typeof s !== "object") return;

  if (s.game && typeof s.game === "object") {
    const g = s.game;
    if (g.mode !== undefined) game.mode = g.mode;
    if (g.duelMode !== undefined) game.duelMode = g.duelMode;
    if (g.wave !== undefined) game.wave = g.wave;
    if (g.waveActive !== undefined) game.waveActive = g.waveActive;
    if (g.paused !== undefined) game.paused = g.paused;
    if (g.gameOver !== undefined) game.gameOver = g.gameOver;
    if (g.speedIndex !== undefined) game.speedIndex = g.speedIndex;
    if (g.autoWaveEnabled !== undefined) game.autoWaveEnabled = g.autoWaveEnabled;
    if (g.waveTag !== undefined) game.waveTag = g.waveTag;
    if (g.runMs !== undefined) game.runMs = g.runMs;
    if (g.message !== undefined) game.message = g.message;

    if (Array.isArray(g.players)) {
      if (!Array.isArray(game.players)) game.players = [];
      for (let i = 0; i < g.players.length; i++) {
        if (game.players[i] && typeof game.players[i] === "object") {
          Object.assign(game.players[i], g.players[i]);
        } else {
          game.players[i] = { ...g.players[i] };
        }
      }
      game.players.length = g.players.length;
    }
  }

  if (Array.isArray(s.towers)) {
    towers.length = 0;
    for (const t of s.towers) {
      const data = TOWER_DATA[t.type] || null;
      towers.push({
        ...t,
        data,
        acquireTarget() {
          return null;
        },
      });
    }
  }

  if (Array.isArray(s.enemies)) {
    enemies.length = 0;
    for (const e of s.enemies) {
      enemies.push({
        ...e,
        data: e.data || null,
      });
    }
  }

  if (Array.isArray(s.projectiles)) {
    projectiles.length = 0;
    for (const p of s.projectiles) {
      projectiles.push({ ...p });
    }
  }

  if (Array.isArray(s.areaEffects)) {
    areaEffects.length = 0;
    for (const a of s.areaEffects) {
      areaEffects.push({ ...a });
    }
  }

  if (Array.isArray(s.effects)) {
    effects.length = 0;
    for (const fx of s.effects) {
      effects.push({ ...fx });
    }
  }
}

function handleChannelMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "ping") {
    sendJson({ type: "pong", t: msg.t });
    return;
  }

  if (msg.type === "pong") {
    if (typeof msg.t === "number") {
      net.pingMs = Math.max(0, Math.round(Date.now() - msg.t));
      notifyNetState();
    }
    return;
  }

  if (msg.type === "cmd") {
    if (isHostClient() && hostCommandHandler) {
      try {
        hostCommandHandler(msg.action, msg.payload);
      } catch (err) {
        net.lastError = err?.message || "Host command handler error.";
        notifyNetState();
      }
    }
    return;
  }

  if (msg.type === "snap") {
    if (isGuestClient()) {
      applyHostSnapshot(msg.s);
    }
  }
}

function attachDataChannel(channel) {
  dataChannel = channel;
  if (!dataChannel) return;

  dataChannel.onopen = () => {
    net.connected = true;
    net.status = "connected";
    net.lastError = "";
    broadcastAccumMs = 0;
    startHeartbeat();
    notifyNetState();
    if (isHostClient()) {
      tickHostBroadcast(0, true);
    }
  };

  dataChannel.onclose = () => {
    disconnectNet("Connection closed");
  };

  dataChannel.onerror = (ev) => {
    net.lastError = ev?.error?.message || ev?.message || "DataChannel error";
    notifyNetState();
  };

  dataChannel.onmessage = (ev) => {
    handleChannelMessage(ev.data);
  };

  if (dataChannel.readyState === "open") {
    dataChannel.onopen();
  }
}

function attachPeerConnectionHandlers(pc) {
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "failed" || state === "closed") {
      disconnectNet(`Peer connection ${state}`);
    } else if (state === "disconnected" && net.connected) {
      net.status = "disconnected";
      net.connected = false;
      notifyNetState();
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    if (state === "failed") {
      disconnectNet("ICE connection failed");
    }
  };
}

export function disconnectNet(reason = "") {
  stopHeartbeat();
  broadcastAccumMs = 0;

  if (dataChannel) {
    try {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onerror = null;
      dataChannel.onmessage = null;
      dataChannel.close();
    } catch {
      // Ignore close errors.
    }
    dataChannel = null;
  }

  if (peerConnection) {
    try {
      peerConnection.ondatachannel = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.oniceconnectionstatechange = null;
      peerConnection.close();
    } catch {
      // Ignore close errors.
    }
    peerConnection = null;
  }

  net.role = "offline";
  net.status = "idle";
  net.connected = false;
  net.localPlayer = 0;
  net.pingMs = null;
  net.lastError = reason ? String(reason) : "";
  notifyNetState();
}

export async function createHostOffer() {
  disconnectNet();
  const PeerCtor = getRtcPeerConnectionCtor();
  if (!PeerCtor) {
    const err = new Error("WebRTC RTCPeerConnection is unavailable in this environment.");
    net.lastError = err.message;
    notifyNetState();
    throw err;
  }

  net.role = "host";
  net.localPlayer = 0;
  net.status = "creating-offer";
  net.connected = false;
  net.pingMs = null;
  net.lastError = "";
  notifyNetState();

  const pc = new PeerCtor(RTC_CONFIG);
  peerConnection = pc;
  attachPeerConnectionHandlers(pc);

  const channel = pc.createDataChannel("tower-wars-duel", { ordered: true });
  attachDataChannel(channel);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc, ICE_GATHER_TIMEOUT_MS);

  net.status = "waiting-answer";
  notifyNetState();

  return encodeSignalCode(pc.localDescription || offer);
}

export async function acceptHostAnswer(code) {
  if (!peerConnection || !isHostClient()) {
    throw new Error("No active host session waiting for an answer.");
  }
  const desc = decodeSignalCode(code);
  await peerConnection.setRemoteDescription(desc);
  net.status = "connecting";
  notifyNetState();
}

export async function joinWithOffer(code) {
  disconnectNet();
  const PeerCtor = getRtcPeerConnectionCtor();
  if (!PeerCtor) {
    const err = new Error("WebRTC RTCPeerConnection is unavailable in this environment.");
    net.lastError = err.message;
    notifyNetState();
    throw err;
  }

  const offerDesc = decodeSignalCode(code);

  net.role = "guest";
  net.localPlayer = 1;
  net.status = "joining";
  net.connected = false;
  net.pingMs = null;
  net.lastError = "";
  notifyNetState();

  const pc = new PeerCtor(RTC_CONFIG);
  peerConnection = pc;
  attachPeerConnectionHandlers(pc);

  pc.ondatachannel = (ev) => {
    attachDataChannel(ev.channel);
  };

  await pc.setRemoteDescription(offerDesc);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc, ICE_GATHER_TIMEOUT_MS);

  net.status = "waiting-host";
  notifyNetState();

  return encodeSignalCode(pc.localDescription || answer);
}

export function sendGuestAction(action, payload = null) {
  if (!dataChannel || dataChannel.readyState !== "open") return false;
  return sendJson({ type: "cmd", action, payload });
}

function serializeSnapshot() {
  return {
    game: {
      mode: game.mode,
      duelMode: game.duelMode,
      wave: game.wave,
      waveActive: game.waveActive,
      paused: game.paused,
      gameOver: game.gameOver,
      speedIndex: game.speedIndex,
      autoWaveEnabled: game.autoWaveEnabled,
      waveTag: game.waveTag,
      runMs: game.runMs,
      message: game.message,
      players: Array.isArray(game.players)
        ? game.players.map((p) => ({ ...p }))
        : [],
    },
    towers: towers.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      gx: t.gx,
      gy: t.gy,
      type: t.type,
      level: t.level,
      branch: t.branch,
      owner: t.owner,
      priority: t.priority,
      range: t.range,
      damage: t.damage,
      fireRate: t.fireRate,
      abilityCooldown: t.abilityCooldown,
      cooldown: t.cooldown,
      totalSpent: t.totalSpent,
      angle: t.angle,
      kills: t.kills,
      damageDealt: t.damageDealt,
    })),
    enemies: enemies.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      owner: e.owner,
      targetPlayer: e.targetPlayer,
      lane: e.lane,
      isBoss: Boolean(e.isBoss),
      flying: Boolean(e.flying),
      magicImmune: Boolean(e.magicImmune),
      mechanical: Boolean(e.mechanical),
      slowImmune: Boolean(e.slowImmune),
      splitter: Boolean(e.splitter),
      splitDepth: e.splitDepth || 0,
      slowTimer: e.slowTimer || 0,
      burnTimer: e.burnTimer || 0,
      freezeTimer: e.freezeTimer || 0,
      armorType: e.armorType,
      name: e.name,
      radius: e.radius,
      speed: e.speed,
      reward: e.reward,
      leakDamage: e.leakDamage,
      color: e.color,
      rim: e.rim,
    })),
    projectiles: projectiles.map((p) => ({
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      tx: p.tx,
      ty: p.ty,
      type: p.type,
      color: p.color,
      radius: p.radius,
      angle: p.angle,
      owner: p.owner,
    })),
    areaEffects: areaEffects.map((a) => ({
      x: a.x,
      y: a.y,
      radius: a.radius,
      type: a.type,
      color: a.color,
      timer: a.timer,
      duration: a.duration,
      maxTimer: a.maxTimer,
      owner: a.owner,
    })),
    effects: effects.slice(-30).map((fx) => ({
      x: fx.x,
      y: fx.y,
      vx: fx.vx,
      vy: fx.vy,
      type: fx.type,
      color: fx.color,
      radius: fx.radius,
      alpha: fx.alpha,
      life: fx.life,
      maxLife: fx.maxLife,
      timer: fx.timer,
      duration: fx.duration,
      text: fx.text,
    })),
  };
}

export function tickHostBroadcast(dt = 0, force = false) {
  if (!isHostClient() || !dataChannel || dataChannel.readyState !== "open") {
    return false;
  }
  const deltaMs = Number.isFinite(dt) ? dt * 1000 : 0;
  broadcastAccumMs += Math.max(0, deltaMs);
  if (!force && broadcastAccumMs < SNAPSHOT_INTERVAL_MS) {
    return false;
  }
  broadcastAccumMs = 0;
  return sendJson({ type: "snap", s: serializeSnapshot() });
}

# Multiplayer architecture for speedrungames.net games

**Default position: games are single-player.** When a game needs multiplayer, it picks **one** of the five patterns below and declares the choice in its `game.manifest.json` as `multiplayer` + `multiplayerProvider`.

**Hard constraint: every approved pattern is free at hobby scale.** No always-on paid servers. No usage-billed APIs without a clear free-tier ceiling. No proprietary SDKs that require paid plans. If a game's needs exceed the documented free tiers, halt and discuss with the operator before adding cost.

---

## Decision tree

Pick the FIRST pattern that fits. Each later pattern is more capable but adds operational surface area.

1. **No network at all?** → Pattern A — Local couch co-op
2. **2 players, mostly friends inviting each other?** → Pattern B — WebRTC P2P
3. **3+ players or strangers needed, real-time?** → Pattern C — PartyKit (Cloudflare-hosted free tier)
4. **3+ players, want self-managed Cloudflare for higher free ceilings?** → Pattern D — Cloudflare Workers + Durable Objects
5. **Turn-based / async / leaderboard-shaped?** → Pattern E — Netlify Blobs (already in this portal)
6. **Server-authoritative real-time sim (anti-cheat, shared world state the clients can't be trusted to compute)?** → Pattern F — Fly.io scale-to-zero Node server

Don't skip ahead. If a game can fit Pattern A, use A. The portal's overall multiplayer cost surface area is the sum of every game's choice — keep it small.

---

## Pattern A — Local couch co-op

**Use when:** two-controller / split-keyboard play on one device, no network needed.

- Game handles all input client-side. Multiple gamepads via the standard Gamepad API (already enabled by the portal iframe's `allow="gamepad"` and `sandbox="... allow-gamepad"`).
- No backend, no signaling, no rooms.

**Manifest:**
```json
{
  "multiplayer": "local",
  "multiplayerProvider": null
}
```

**Cost:** $0 forever. No external dependency.

---

## Pattern B — WebRTC peer-to-peer

**Use when:** two players, you want zero per-session cost, and you're OK with ~10-20% of players behind strict NAT being unable to connect.

- Browsers connect directly via WebRTC data channels.
- A tiny **signaling endpoint** brokers the initial SDP/ICE exchange. Implement it as a Netlify Function (free tier: 125k requests/month at time of writing).
- STUN: use Google's free public servers (`stun.l.google.com:19302`). **No TURN.** TURN servers cost money, and free TURN providers throttle aggressively. Without TURN, ~10-20% of users behind symmetric NATs cannot establish a P2P connection; show them a "couldn't connect, try again or invite another friend" message.

**Manifest:**
```json
{
  "multiplayer": "p2p",
  "multiplayerProvider": "webrtc"
}
```

**Game responsibilities:**
- Generate a 4-6 char human-readable room code on host.
- Send room code to peer out-of-band (URL share, "send this to your friend").
- On connect, exchange SDP/ICE via the signaling endpoint.
- After connection, signaling endpoint is no longer involved. All game traffic goes directly peer-to-peer.

**Signaling endpoint (skeleton):**
- Lives in this portal at `apps/web/src/app/api/mp-signaling/route.ts` (to be added when the first P2P game ships).
- Uses **Netlify Blobs** as a short-lived key-value store (room code → SDP, 5-minute TTL).
- POST `/api/mp-signaling/offer { roomCode, sdp }` → stores host's offer.
- GET `/api/mp-signaling/offer?roomCode=...` → peer reads, posts back answer.
- POST `/api/mp-signaling/answer { roomCode, sdp }` → stores peer's answer.
- GET `/api/mp-signaling/answer?roomCode=...` → host reads, connection completes.

The portal does NOT proxy the actual game packets — they go peer-to-peer over WebRTC after handshake.

**Cost:** $0 within the Netlify Functions + Blobs free tiers. Effectively free until you hit ~125k signaling requests/month (each room uses ~4 requests, so ~30k rooms/month before the cap matters).

---

## Pattern C — PartyKit (Cloudflare-hosted real-time server) — **recommended for most real-time multiplayer**

**Use when:** 3+ players, real-time, public matchmaking, or P2P NAT failure rate is unacceptable.

- [PartyKit](https://www.partykit.io/) is a library on top of Cloudflare Durable Objects. Each game room = one "party" = one Durable Object.
- Free tier (at time of writing): unmetered for hobby use. Re-check before relying on it.
- Game code includes a small server module that runs in the party and handles message fan-out.

**Manifest:**
```json
{
  "multiplayer": "realtime-server",
  "multiplayerProvider": "partykit"
}
```

**Game source repo additions** (on top of the standard contract):
- `party/index.ts` — the PartyKit server. ~50-150 lines for most games.
- `partykit.json` — config with project name.
- `npm install partykit partysocket` — client + server libs.
- `npm run deploy:party` — deploys to PartyKit (one-time per game).

**Client integration:**
```ts
import PartySocket from "partysocket";
const ws = new PartySocket({
  host: "<your-partykit-project>.<your-user>.partykit.dev",
  room: roomCode,
});
ws.addEventListener("message", (e) => { /* game state update */ });
ws.send(JSON.stringify({ type: "move", ... }));
```

**Provenance trail:** the portal manifest records `multiplayerProvider: "partykit"` and the PartyKit project URL appears in the source manifest's `multiplayerEndpoint` field (optional but recommended).

**Cost:** $0 within PartyKit free tier. If the free tier ever changes, this doc gets updated.

---

## Pattern D — Cloudflare Workers + Durable Objects (self-managed)

**Use when:** Pattern C's free tier ceiling is a concern OR you want full control of the multiplayer server.

- Same architecture as PartyKit (DO per room) but written directly against Cloudflare's APIs.
- Free tier (Cloudflare Workers): 100k requests/day. Durable Objects: more complex billing; free tier exists but has tighter caps than Workers.
- More setup than PartyKit. Recommended only when Pattern C is insufficient.

**Manifest:**
```json
{
  "multiplayer": "realtime-server",
  "multiplayerProvider": "cloudflare-do"
}
```

**Cost:** $0 within Cloudflare free tier. Beyond the tier: pay-as-you-go.

---

## Pattern E — Netlify Blobs (async / turn-based)

**Use when:** the multiplayer interaction is asynchronous. Examples: daily challenges, turn-based games, ghost runs (race against another player's recorded run), shared persistent worlds polled at low frequency.

- Already proven by the portal's existing `/api/runs` endpoint (leaderboard backed by Netlify Blobs).
- Same approach for game-state-by-key: route at `apps/web/src/app/api/mp-async/[slug]/route.ts` (add per-game when needed).
- Games POST state snapshots, others GET them.

**Manifest:**
```json
{
  "multiplayer": "async",
  "multiplayerProvider": "netlify-blobs"
}
```

**Cost:** $0 within Netlify Functions + Blobs free tier.

---

## Pattern F — Fly.io scale-to-zero authoritative server

**Use when:** the game needs a server-authoritative simulation — the server runs the one true game state and clients only send inputs (tower builds, commands) and render snapshots. This is the right shape when client-computed state can't be trusted (cheating) or when a continuous shared sim must outlive any one client.

- Plain Node.js + `ws` in its own repo, deployed as a Fly.io app with `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0` — the machine **sleeps when no one is connected** and cold-starts (~1s) on the first WebSocket connection. This satisfies the no-always-on-servers constraint: idle cost is ~$0; active cost at hobby scale is pennies/month on a shared-cpu-1x/256MB VM.
- Lobby by room code (no auth, per §"NOT allowed"), all game rules validated server-side, compact snapshot broadcasting (tuples not objects, 10–15Hz, permessage-deflate).
- **The big tradeoff:** if the server reuses the game's mechanics, the sim logic gets duplicated between the game repo and the server repo. Document this loudly in BOTH repos' `AGENTS.md` — every balance change must land twice.

**Deployed example:** `green-circle-td` v1.8.0 — server repo [`Brynrg/gctd-server`](https://github.com/Brynrg/gctd-server), Fly app `gctd-server` (region `sjc` — `sea` is deprecated), endpoint `wss://gctd-server.fly.dev`. 2–4 player co-op, WC3-style lobby, per-player build zones, shared lives. See that repo's `AGENTS.md` for the protocol and operational details. (The `tank-you-again` Fly app is the same pattern for the tank game.)

**Manifest:**
```json
{
  "multiplayer": "realtime-server",
  "multiplayerProvider": "fly-io",
  "multiplayerEndpoint": "wss://<app>.fly.dev"
}
```

**Cost:** ~$0 idle (scale-to-zero); cents/month active at hobby scale. Fly bills usage — keep VMs at shared-cpu-1x/256MB and verify `auto_stop_machines` is set before approving.

---

## What multiplayer is NOT allowed to do

- **No always-on dedicated game servers.** Every approved pattern is client-side, peer-to-peer, serverless, or scale-to-zero (Pattern F: the machine must stop when idle — `min_machines_running = 0`).
- **No proprietary multiplayer SDKs requiring paid plans** (PlayFab, GameLift, Photon paid tiers, etc.).
- **No usage-billed APIs without a documented free ceiling.**
- **No auth.** Multiplayer uses room codes / pairing handshakes only. No user accounts, no OAuth, no email collection — see AGENTS.md §9.
- **No host migration off Netlify.** The portal stays on Netlify; the multiplayer transport may live on Cloudflare (Patterns C/D) but the game's static files always ship through this portal.
- **No raw IP addresses logged or stored.** Signaling endpoints process and forget; no PII in Blobs.

---

## How to add multiplayer to a new game

In the game source repo:

1. Choose a pattern (run the decision tree).
2. Set `multiplayer` + `multiplayerProvider` in `game.manifest.json`.
3. For Pattern B: write a thin signaling client. The portal's `/api/mp-signaling` is shared; no per-game setup needed.
4. For Pattern C/D: scaffold the server module (`party/index.ts` or `worker/index.ts`), deploy it via the provider's CLI, record the resulting endpoint URL.
5. For Pattern E: add or extend the portal's blob-backed route under `apps/web/src/app/api/mp-async/<slug>/route.ts`. This is a portal-side change — flag it in the PR.
6. Smoke test: at least two browser windows / devices joining the same room.
7. Ingest via `scripts/ingest-game-build.mjs` as usual. The validator checks that `multiplayerProvider` is set when `multiplayer` is anything other than `none` or `local`.

---

## How to add multiplayer to an EXISTING game

Treat it as a normal `/gamedeploy` iteration:

1. Add `multiplayer` + `multiplayerProvider` to the game source repo's `game.manifest.json`.
2. Implement the chosen pattern in the source.
3. Bump the source repo's `version`.
4. Re-run `scripts/ingest-game-build.mjs` against the rebuilt `dist/`.
5. The new portal manifest will carry the multiplayer fields. The registry regenerates. Validator confirms.

No portal-side changes unless you're picking Pattern E.

---

## Open questions to revisit

- **TURN servers.** If P2P NAT failure rates become a problem and we have a budget, the cheapest reasonable TURN options are Twilio's STUN/TURN (pay-per-MB) or self-hosted coturn on a $5/mo VPS. Not free, so out of scope today.
- **Voice/video.** WebRTC supports both, but they'd push us over the free-tier ceilings on TURN traffic. Not approved.
- **Persistent worlds across days/weeks.** Pattern E handles this for low-frequency state; for high-frequency, we'd need Pattern D with paid Durable Object storage. Revisit when a game needs it.

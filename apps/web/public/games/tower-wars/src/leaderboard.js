import { status } from "./status.js";

// Fire-and-forget submit to the portal leaderboard (POST /api/runs). A run is
// sim-time from the first wave start to clearing wave 20 in a solo mode.
// Standalone hosting (no portal API) fails silently.
export function submitRun(ms) {
  fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: "tower-wars", ms: Math.round(ms) }),
  })
    .then((res) => {
      if (res.ok) {
        status("Run time submitted to the leaderboard.");
      }
    })
    .catch(() => {});
}

// Leaderboard backend.
//
//  GET  /api/runs?game=<slug>&limit=<n>  → list runs (filtered by slug if given)
//  POST /api/runs                        → submit a run
//
// Storage: Cloudflare KV, one entry per run, key = `<reverseTs>-<id>` so
// KV's lexicographic key listing returns newest-first. This avoids any
// read-modify-write race on concurrent writes.
//
// The KV binding (RUNS_KV) is declared in wrangler.jsonc. Bind a separate
// namespace per environment to isolate preview/test data from production.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { games } from "@/lib/games";

declare global {
  interface CloudflareEnv {
    RUNS_KV?: KVNamespace;
  }
}

export const dynamic = "force-dynamic";

const STORE_NAME = "runs";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_MS = 86_400_000; // 24h sanity cap
const MAX_RUNNER_LEN = 32;
const MAX_SPLITS = 100;

// When filtering by game, scan up to this many recent blobs to find matches.
const FILTER_SCAN_CAP = 500;

interface RunSplit {
  label: string;
  ms: number;
}

interface Run {
  id: string;
  slug: string;
  ms: number;
  runner?: string;
  splits?: RunSplit[];
  achievedAt: number;
}

const VALID_SLUGS = new Set(games.map((g) => g.slug));

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// The KV namespace bound as RUNS_KV (wrangler.jsonc). Throws if unavailable so
// the GET/POST handlers fall back gracefully (GET → [], POST → 503).
function leaderboardStore(): KVNamespace {
  const { env } = getCloudflareContext();
  const kv = env.RUNS_KV;
  if (!kv) throw new Error(`KV binding "${STORE_NAME}" (RUNS_KV) not configured`);
  return kv;
}

// 13-digit zero-padded reverse timestamp → lexicographic key sort yields
// newest-first. 9999999999999 - now will stay positive until ~year 2286.
function runKey(run: Run): string {
  const reverse = (9999999999999 - run.achievedAt).toString().padStart(13, "0");
  return `${reverse}-${run.id}`;
}

async function listRuns(limit: number, slugFilter?: string): Promise<Run[]> {
  const store = leaderboardStore();
  const scanCap = slugFilter ? FILTER_SCAN_CAP : limit;
  // KV lists keys in lexicographic order; the reverse-ts key scheme makes that
  // newest-first. scanCap (≤ 500) is within KV's 1000-key per-list limit.
  const result = await store.list({ limit: scanCap });
  const keys = result.keys.map((k) => k.name).sort().slice(0, scanCap);
  const runs = await Promise.all(
    keys.map(async (key) => {
      try {
        return await store.get<Run>(key, "json");
      } catch {
        return null;
      }
    }),
  );
  let out = runs.filter((r): r is Run => r != null);
  if (slugFilter) out = out.filter((r) => r.slug === slugFilter);
  return out.slice(0, limit);
}

async function saveRun(run: Run): Promise<void> {
  const store = leaderboardStore();
  await store.put(runKey(run), JSON.stringify(run));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("game") || undefined;
  const limit = clamp(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  try {
    const runs = await listRuns(limit, slug);
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

function sanitizeSplits(input: unknown): RunSplit[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: RunSplit[] = [];
  for (const s of input.slice(0, MAX_SPLITS)) {
    if (!s || typeof s !== "object") continue;
    const label = String((s as { label?: unknown }).label ?? "").slice(0, 64);
    const ms = Number((s as { ms?: unknown }).ms);
    if (!Number.isFinite(ms) || ms < 0) continue;
    out.push({ label, ms: Math.round(ms) });
  }
  return out.length ? out : undefined;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const slug = typeof b.slug === "string" ? b.slug : "";
  const ms = Number(b.ms);
  const runner =
    typeof b.runner === "string" && b.runner.trim()
      ? b.runner.trim().slice(0, MAX_RUNNER_LEN)
      : undefined;
  const splits = sanitizeSplits(b.splits);

  if (!VALID_SLUGS.has(slug)) {
    return NextResponse.json(
      { error: `unknown slug "${slug}"` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_MS) {
    return NextResponse.json(
      { error: `invalid ms (got ${b.ms})` },
      { status: 400 },
    );
  }

  const run: Run = {
    id: crypto.randomUUID(),
    slug,
    ms: Math.round(ms),
    achievedAt: Date.now(),
    ...(runner ? { runner } : {}),
    ...(splits ? { splits } : {}),
  };

  try {
    await saveRun(run);
    return NextResponse.json(run);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `storage unavailable: ${msg}` },
      { status: 503 },
    );
  }
}

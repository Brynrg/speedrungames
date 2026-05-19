// Leaderboard backend.
//
//  GET  /api/runs?game=<slug>&limit=<n>  → list runs (filtered by slug if given)
//  POST /api/runs                        → submit a run
//
// Storage: Netlify Blobs, one blob per run, key = `<reverseTs>-<id>` so
// lexicographic listing returns newest-first. This avoids any read-modify-
// write race on concurrent writes.
//
// Deploy previews use a deploy-scoped store so PR testing can't pollute
// production data.

import { NextResponse } from "next/server";
import { getStore, getDeployStore } from "@netlify/blobs";
import { games } from "@/lib/games";

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

// Isolate deploy-preview / branch-deploy storage from production so test
// submits on a PR can't pollute the live leaderboard.
function leaderboardStore() {
  const ctx = process.env.CONTEXT;
  const isPreview = ctx === "deploy-preview" || ctx === "branch-deploy";
  return isPreview ? getDeployStore(STORE_NAME) : getStore(STORE_NAME);
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
  const result = (await store.list({ paginate: false })) as {
    blobs: { key: string }[];
  };
  const keys = (result.blobs ?? []).map((b) => b.key).sort().slice(0, scanCap);
  const runs = await Promise.all(
    keys.map(async (key) => {
      try {
        return (await store.get(key, { type: "json" })) as Run | null;
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
  await store.setJSON(runKey(run), run);
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

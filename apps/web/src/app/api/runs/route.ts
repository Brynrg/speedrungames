// Leaderboard backend.
//
//  GET  /api/runs?game=<slug>&limit=<n>  → list runs (filtered by slug if given)
//  POST /api/runs                        → submit a run
//
// Storage: Netlify Blobs (key=recent, value=array of runs, capped at MAX_RECENT).
// In local `next dev`, blob storage is unavailable and the route gracefully
// returns empty / 503. Use `netlify dev` to test against real blob storage.

import { NextResponse } from "next/server";
import { getStore, getDeployStore } from "@netlify/blobs";
import { games } from "@/lib/games";

// Isolate deploy-preview / branch-deploy storage from production so test
// submits on a PR can't pollute the live leaderboard.
function leaderboardStore() {
  const ctx = process.env.CONTEXT;
  const isPreview = ctx === "deploy-preview" || ctx === "branch-deploy";
  return isPreview ? getDeployStore(STORE_NAME) : getStore(STORE_NAME);
}

export const dynamic = "force-dynamic";

const STORE_NAME = "leaderboard";
const RUNS_KEY = "recent";
const MAX_RECENT = 200;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_MS = 86_400_000; // 24h sanity cap
const MAX_RUNNER_LEN = 32;
const MAX_SPLITS = 100;

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

async function readRuns(): Promise<Run[]> {
  const store = leaderboardStore();
  const data = (await store.get(RUNS_KEY, { type: "json" })) as Run[] | null;
  return Array.isArray(data) ? data : [];
}

/**
 * Atomically prepend `run` to the recent[] blob, capped at MAX_RECENT.
 * Uses compare-and-swap on the blob's etag with retries to handle
 * concurrent writes from racing function invocations.
 */
async function prependRun(run: Run, attempts = 6): Promise<void> {
  const store = leaderboardStore();
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const meta = (await store.getWithMetadata(RUNS_KEY, { type: "json" })) as
      | { data: unknown; etag: string }
      | null;
    const existing = (meta && Array.isArray(meta.data) ? (meta.data as Run[]) : []) ?? [];
    const next = [run, ...existing].slice(0, MAX_RECENT);
    try {
      const opts = meta?.etag
        ? { onlyIfMatch: meta.etag }
        : { onlyIfNew: true };
      const result = (await store.setJSON(RUNS_KEY, next, opts)) as
        | { modified: boolean }
        | undefined;
      if (!result || result.modified) return;
      // CAS conflict — another writer beat us. Retry.
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 25 * (i + 1)));
  }
  if (lastErr) throw lastErr;
  throw new Error(`leaderboard: CAS retry exhausted after ${attempts} attempts`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("game");
  const limit = clamp(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  try {
    let runs = await readRuns();
    if (slug) runs = runs.filter((r) => r.slug === slug);
    return NextResponse.json(runs.slice(0, limit));
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
    await prependRun(run);
    return NextResponse.json(run);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `storage unavailable: ${msg}` },
      { status: 503 },
    );
  }
}

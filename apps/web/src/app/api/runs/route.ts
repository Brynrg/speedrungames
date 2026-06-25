// Leaderboard backend.
//
//  GET  /api/runs?game=<slug>&limit=<n>  → list runs (filtered by slug if given), newest first
//  POST /api/runs                        → submit a run
//
// Storage: Cloudflare D1 (free tier). One row per run. D1 lists newest-N in a single
// query (no per-item read amplification), is strongly consistent (a new run shows up
// immediately), and the free tier allows 5M row-reads/day — the homepage fetches the
// board on every load, which would blow KV's 100k-reads / 1k-list-ops free caps at
// ~1k views/day. Schema: db/schema.sql. Binding: DB (wrangler.jsonc d1_databases).

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { games } from "@/lib/games";

declare global {
  interface CloudflareEnv {
    DB?: D1Database;
  }
}

export const dynamic = "force-dynamic";

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

// Shape of a `runs` row as stored in D1.
interface RunRow {
  id: string;
  slug: string;
  ms: number;
  runner: string | null;
  splits: string | null;
  achieved_at: number;
}

const VALID_SLUGS = new Set(games.map((g) => g.slug));

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// The D1 binding (wrangler.jsonc). Read inside handlers, not at module scope —
// getCloudflareContext() needs a request context. Throws if unbound so the
// handlers fall back gracefully (GET → [], POST → 503).
function db(): D1Database {
  const d1 = getCloudflareContext().env.DB;
  if (!d1) throw new Error("D1 binding DB not configured");
  return d1;
}

function rowToRun(r: RunRow): Run {
  let splits: RunSplit[] | undefined;
  if (r.splits) {
    try {
      const parsed = JSON.parse(r.splits);
      if (Array.isArray(parsed) && parsed.length) splits = parsed;
    } catch {
      /* ignore malformed splits */
    }
  }
  return {
    id: r.id,
    slug: r.slug,
    ms: r.ms,
    achievedAt: r.achieved_at,
    ...(r.runner ? { runner: r.runner } : {}),
    ...(splits ? { splits } : {}),
  };
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
    const sql = slug
      ? "SELECT id, slug, ms, runner, splits, achieved_at FROM runs WHERE slug = ?1 ORDER BY achieved_at DESC LIMIT ?2"
      : "SELECT id, slug, ms, runner, splits, achieved_at FROM runs ORDER BY achieved_at DESC LIMIT ?1";
    const stmt = slug
      ? db().prepare(sql).bind(slug, limit)
      : db().prepare(sql).bind(limit);
    const { results } = await stmt.all<RunRow>();
    return NextResponse.json((results ?? []).map(rowToRun));
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
    return NextResponse.json({ error: `unknown slug "${slug}"` }, { status: 400 });
  }
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_MS) {
    return NextResponse.json({ error: `invalid ms (got ${b.ms})` }, { status: 400 });
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
    await db()
      .prepare(
        "INSERT INTO runs (id, slug, ms, runner, splits, achieved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      )
      .bind(run.id, run.slug, run.ms, run.runner ?? null, run.splits ? JSON.stringify(run.splits) : null, run.achievedAt)
      .run();
    return NextResponse.json(run);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `storage unavailable: ${msg}` }, { status: 503 });
  }
}

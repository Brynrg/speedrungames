"use client";

import { useEffect, useState } from "react";
import { games } from "@/lib/games";

interface Run {
  id: string;
  slug: string;
  ms: number;
  runner?: string;
  achievedAt: number;
}

const slugToTitle = new Map(games.map((g) => [g.slug, g.title]));
const slugToHref = new Map(games.map((g) => [g.slug, g.href]));

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  const ms3 = String(millis).padStart(3, "0");
  return `${m}:${s}.${ms3}`;
}

function ago(then: number): string {
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function RecentRuns() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/runs?limit=10", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => setRuns([]));
    return () => ctrl.abort();
  }, []);

  if (!runs || runs.length === 0) return null;

  return (
    <section className="recent-runs" aria-label="Recent runs">
      <h2>Recent Runs</h2>
      <ul>
        {runs.map((r) => {
          const title = slugToTitle.get(r.slug) ?? r.slug;
          const href = slugToHref.get(r.slug) ?? `/games/${r.slug}/`;
          return (
            <li key={r.id} className="recent-run">
              <a href={href} className="recent-run-game">
                {title}
              </a>
              <span className="recent-run-time">{formatMs(r.ms)}</span>
              {r.runner ? (
                <span className="recent-run-runner">{r.runner}</span>
              ) : null}
              <span className="recent-run-ago">{ago(r.achievedAt)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { visibleGames, type Game } from "@/lib/games";
import RecentRuns from "@/components/RecentRuns";

export interface Run {
  id: string;
  slug: string;
  ms: number;
  runner?: string;
  achievedAt: number;
}

/** mm:ss.mmm with tabular figures in mind. */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  const ms3 = String(millis).padStart(3, "0");
  return `${m}:${s}.${ms3}`;
}

export function ago(then: number): string {
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function GameTile({
  game,
  best,
  featured,
}: {
  game: Game;
  best: number | undefined;
  featured: boolean;
}) {
  return (
    <a
      href={game.href}
      className={`game-tile${featured ? " is-featured" : ""}`}
    >
      <span className="game-emoji" aria-hidden="true">
        {game.emoji}
      </span>
      <h3 className="game-title">{game.title}</h3>
      <p className="game-desc">{game.description}</p>
      <span className="game-meta">
        <span className="live-badge">
          <span className="live-dot" aria-hidden="true" />
          Playable
        </span>
        {best !== undefined ? (
          <span className="best-time">
            <span className="best-label">Best</span>
            <span className="best-value mono">{formatMs(best)}</span>
          </span>
        ) : null}
        <span className="game-go">
          Play
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </a>
  );
}

/**
 * Owns the single /api/runs fetch for the home page. Derives a best-time per
 * game (min ms across that game's runs) for the grid, and feeds the newest
 * runs to the records list. All numbers come from real run data; a game with
 * no runs simply shows no best time.
 */
export default function GamesShowcase() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/runs?limit=100", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) =>
        setRuns(Array.isArray(data) ? (data as Run[]) : []),
      )
      .catch(() => setRuns([]));
    return () => ctrl.abort();
  }, []);

  const bestBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const run of runs ?? []) {
      if (typeof run.ms !== "number" || run.ms <= 0) continue;
      const cur = map.get(run.slug);
      if (cur === undefined || run.ms < cur) map.set(run.slug, run.ms);
    }
    return map;
  }, [runs]);

  const recent = useMemo(() => {
    return [...(runs ?? [])]
      .sort((a, b) => b.achievedAt - a.achievedAt)
      .slice(0, 10);
  }, [runs]);

  const loading = runs === null;

  return (
    <>
      <div className="games-grid" id="games">
        {visibleGames.map((game, i) => (
          <GameTile
            key={game.slug}
            game={game}
            best={bestBySlug.get(game.slug)}
            featured={i === 0}
          />
        ))}
      </div>
      <RecentRuns runs={recent} loading={loading} />
    </>
  );
}

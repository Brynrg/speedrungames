import { games } from "@/lib/games";
import { formatMs, ago, type Run } from "@/components/GamesShowcase";

const slugToTitle = new Map(games.map((g) => [g.slug, g.title]));
const slugToHref = new Map(games.map((g) => [g.slug, g.href]));

interface RecentRunsProps {
  runs: Run[];
  loading: boolean;
}

const SKELETON_ROWS = 5;

/**
 * Live records feed. Presentational: receives runs from GamesShowcase, which
 * owns the single /api/runs fetch so the page hits the leaderboard once.
 */
export default function RecentRuns({ runs, loading }: RecentRunsProps) {
  return (
    <section className="records" id="records" aria-label="Recent runs">
      <div className="records-head">
        <h2>Recent runs</h2>
        <span className="records-sub">Newest first, time in mm:ss.ms</span>
      </div>

      {loading ? (
        <ul className="records-list" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <li key={i} className="record-skeleton">
              <span className="skel skel-rank" />
              <span>
                <span className="skel skel-line-1" />
                <span className="skel skel-line-2" />
              </span>
              <span className="skel skel-time" />
            </li>
          ))}
        </ul>
      ) : runs.length === 0 ? (
        <div className="records-empty">
          <p className="empty-title">No runs posted yet</p>
          <p className="empty-body">
            Finish a game and submit your time. It shows up here with your name
            and how long ago you set it, ranked against everyone else.
          </p>
          <a className="empty-link" href="#games">
            Pick a game to run
          </a>
        </div>
      ) : (
        <ol className="records-list">
          {runs.map((r, i) => {
            const title = slugToTitle.get(r.slug) ?? r.slug;
            const href = slugToHref.get(r.slug) ?? `/games/${r.slug}/`;
            const podium = i < 3;
            return (
              <li
                key={r.id}
                className={`record-row${podium ? " is-podium" : ""}`}
              >
                <span className="record-rank mono">{i + 1}</span>
                <span className="record-main">
                  <a href={href} className="record-game">
                    {title}
                  </a>
                  <span className="record-sub">
                    {r.runner ? (
                      <span className="record-runner">{r.runner}</span>
                    ) : null}
                    <span className="record-when">{ago(r.achievedAt)}</span>
                  </span>
                </span>
                <span className="record-time mono">{formatMs(r.ms)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

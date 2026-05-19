import { visibleGames } from "@/lib/games";
import RecentRuns from "@/components/RecentRuns";

export default function HomePage() {
  return (
    <div className="home">
      <h1>⚡ Speed Run Games</h1>
      <p className="tagline">Play fast. Beat your record.</p>
      <div className="games-grid">
        {visibleGames.map((game) => (
          <a key={game.slug} href={game.href} className="game-card">
            <span className="emoji">{game.emoji}</span>
            <h2>{game.title}</h2>
            <p>{game.description}</p>
            <span className="play-badge">Play →</span>
          </a>
        ))}
      </div>
      <RecentRuns />
    </div>
  );
}

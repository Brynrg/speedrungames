import { visibleGames } from "@/lib/games";
import GamesShowcase from "@/components/GamesShowcase";

export default function HomePage() {
  const count = visibleGames.length;
  return (
    <div className="home">
      <div className="home-head">
        <div>
          <h1>Browser games, run against the clock</h1>
          <p className="tagline">
            Pick a game, post your time, climb the board. Tower defense, tank
            arenas, and a voice-controlled Pokemon dash.
          </p>
        </div>
        <span className="run-count">
          <span className="dot" aria-hidden="true" />
          <span className="num">{count}</span>
          {count === 1 ? "game live" : "games live"}
        </span>
      </div>
      <GamesShowcase />
    </div>
  );
}

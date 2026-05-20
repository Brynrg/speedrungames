import registryData from "./games.registry.json";

export interface Game {
  /** URL-safe slug. */
  slug: string;
  title: string;
  description: string;
  /** URL the home grid / nav links to. */
  href: string;
  emoji: string;
  /** Hide from the home grid + nav. Use during incubation. */
  hidden?: boolean;
}

interface RegistryEntry {
  slug: string;
  title: string;
  description: string;
  playUrl: string;
  redirectTo?: string;
  emoji?: string;
  hidden?: boolean;
}

export const games: Game[] = (registryData as RegistryEntry[]).map((game) => ({
  slug: game.slug,
  title: game.title,
  description: game.description,
  href: game.redirectTo ?? game.playUrl,
  emoji: game.emoji ?? "🎮",
  hidden: game.hidden,
}));

export const visibleGames = games.filter((g) => !g.hidden);

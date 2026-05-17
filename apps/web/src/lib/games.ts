export interface Game {
  slug: string;
  title: string;
  description: string;
  href: string;
  emoji: string;
}

export const games: Game[] = [
  {
    slug: "tower-wars",
    title: "Tower Wars",
    description:
      "Maze tower defense with income/sends, hero towers, and large-map pan/zoom control.",
    href: "/games/tower-wars",
    emoji: "🛡️",
  },
  {
    slug: "tower-wars-2",
    title: "Tower Wars II",
    description:
      "Branching tower upgrades, balanced enemy waves, and a fresh take on maze TD.",
    href: "/games/tower-wars-2",
    emoji: "🏰",
  },
  {
    slug: "pokemonspeedrungen1",
    title: "Pokémon Speedrun Gen 1",
    description:
      "Voice-first (tap fallback) Gen 1 Pokémon speedrun. Name all 151 as fast as you can.",
    href: "/pokemonspeedrungen1",
    emoji: "🎙️",
  },
];

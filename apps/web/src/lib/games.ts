export interface Game {
  slug: string;
  title: string;
  description: string;
  href: string;
  emoji: string;
}

export const games: Game[] = [
  {
    slug: "pokemonspeedrungen1",
    title: "Pokémon Speedrun Gen 1",
    description:
      "Voice-first (tap fallback) Gen 1 Pokémon speedrun. Name all 151 as fast as you can.",
    href: "/pokemonspeedrungen1",
    emoji: "🎙️",
  },
];

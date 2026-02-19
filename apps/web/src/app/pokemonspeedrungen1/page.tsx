import type { Metadata } from "next";
import PokemonSpeedrunGen1 from "@speedrungames/pokemonspeedrungen1";

export const metadata: Metadata = {
  title: "Pokémon Speedrun Gen 1 | Speed Run Games",
  description: "Voice-first Gen 1 Pokémon speedrun. Name all 151!",
};

export default function PokemonSpeedrunPage() {
  return <PokemonSpeedrunGen1 />;
}

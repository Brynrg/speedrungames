"use client";

/**
 * PokemonSpeedrunGen1
 * Package boundary component for @speedrungames/pokemonspeedrungen1.
 * Wraps the game's page component with Suspense for client-side lazy loading.
 * Assets served from: /games/pokemonspeedrungen1/assets/gen1/
 */

import React from "react";

// Lazy import avoids SSR issues with browser APIs (SpeechRecognition, canvas, etc.)
const GamePage = React.lazy(() =>
  import("./app/page").then((mod) => ({ default: mod.default }))
);

export default function PokemonSpeedrunGen1() {
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0f",
            color: "#e8e8f0",
            fontFamily: "system-ui, sans-serif",
            fontSize: "1.2rem",
          }}
        >
          Loading Pokémon Speedrun…
        </div>
      }
    >
      <GamePage />
    </React.Suspense>
  );
}

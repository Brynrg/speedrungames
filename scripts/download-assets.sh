#!/usr/bin/env bash
# Download Gen 1 Pokémon sprites (official artwork from PokeAPI sprites repo)
# Run from the monorepo root: bash scripts/download-assets.sh

DEST="apps/web/public/games/pokemonspeedrungen1/assets/gen1"
mkdir -p "$DEST"

BASE="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"

echo "Downloading 151 Gen 1 Pokémon images..."
for i in $(seq 1 151); do
  PADDED=$(printf "%03d" $i)
  OUT="$DEST/${PADDED}.png"
  if [ ! -f "$OUT" ]; then
    curl -sf "${BASE}/${i}.png" -o "$OUT" && echo "  ✓ ${PADDED}.png" || echo "  ✗ ${PADDED}.png failed"
  else
    echo "  - ${PADDED}.png already exists"
  fi
done

echo "Done. Assets in $DEST"

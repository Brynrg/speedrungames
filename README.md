# SpeedRunGames

A monorepo platform for speedrun games. Live at [speedrungames.net](https://speedrungames.net).

## Structure

```
speedrungames/
├── apps/web/                        # Next.js 15 site
├── games/pokemonspeedrungen1/       # Pokémon Gen 1 voice speedrun
├── pnpm-workspace.yaml
└── netlify.toml
```

## Dev

```bash
pnpm install
pnpm dev   # → http://localhost:3000
```

## Routes

| URL | Game |
|-----|------|
| `/` | Home — game listing |
| `/pokemonspeedrungen1` | Pokémon Speedrun Gen 1 |

## Assets

Pokémon sprites go in:
`apps/web/public/games/pokemonspeedrungen1/assets/gen1/001.png` … `151.png`

# SpeedRunGames

A monorepo platform for speedrun games. Live at [speedrungames.net](https://speedrungames.net).

## Structure

```
speedrungames/
├── apps/
│   └── web/                     # Next.js 15 site (speedrungames.net)
├── games/
│   └── pokemonspeedrungen1/     # Pokémon Gen 1 voice speedrun (git subtree)
├── pnpm-workspace.yaml
└── netlify.toml
```

## Dev

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
```

## Deploy

Hosted on Netlify, DNS via Cloudflare. Config in `netlify.toml`.

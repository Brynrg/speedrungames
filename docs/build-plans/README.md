# Build plans

Execution-ready plans for a local AI agent to build / fix specific games and
deploy them to speedrungames.net **without breaking the live site**.

Before starting any plan, read the portal contract: [`../../AGENTS.md`](../../AGENTS.md)
and [`../browser-game-template-contract.md`](../browser-game-template-contract.md).
Every plan below ends by going through the **canonical deploy path** (push →
reusable `deploy-game.yml` → auto-merging portal PR gated on CI + Netlify
preview). Never hand-copy into `apps/web/public/games/`.

| Plan | Game | Status today | Goal |
|---|---|---|---|
| [green-circle-td-web-port.md](./green-circle-td-web-port.md) | Green Circle TD | Live slot is a 696-byte empty-grid stub; real game is a Python desktop game in `tower-defense/` | Port to a real web build on the tower-wars engine |
| [line-tower-wars-build.md](./line-tower-wars-build.md) | Line Tower Wars | Live slot is a 696-byte empty-grid stub | Build a real LTW reusing tower-wars' duel/send mechanics |
| [pokemonspeedrungen1-fix.md](./pokemonspeedrungen1-fix.md) | Pokémon Speedrun Gen 1 | Code-complete but every sprite 404s | Fix asset paths + source the 151 sprites |

## Interim catalog protection

While the two stubs (`green-circle-td`, `line-tower-wars`) are being built they
are set `"hidden": true` in their portal manifests so the public homepage does
not advertise empty games. **The final step of each build plan flips
`hidden` back to `false`** once the real game ships and validates.

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
| [green-circle-td-web-port.md](./green-circle-td-web-port.md) | Green Circle TD | ✅ **DONE** — live at v1.8.0 (full port + WC3 parity + online multiplayer via [`Brynrg/gctd-server`](https://github.com/Brynrg/gctd-server) on Fly.io). Source: [`Brynrg/green-circle-td`](https://github.com/Brynrg/green-circle-td) — read its `AGENTS.md` before touching it (duplicated sim!) | Maintain; balance changes must land in game AND server repos |
| [line-tower-wars-build.md](./line-tower-wars-build.md) | Line Tower Wars | Live slot is a 696-byte empty-grid stub | Build a real LTW reusing tower-wars' duel/send mechanics |
| [pokemonspeedrungen1-fix.md](./pokemonspeedrungen1-fix.md) | Pokémon Speedrun Gen 1 | Code-complete but every sprite 404s | Fix asset paths + source the 151 sprites |

## Interim catalog protection

While a stub is being built it is set `"hidden": true` in its portal manifest
so the public homepage does not advertise empty games (`green-circle-td` has
since shipped and is live; `line-tower-wars` remains a hidden stub). **The final step of each build plan flips
`hidden` back to `false`** once the real game ships and validates.

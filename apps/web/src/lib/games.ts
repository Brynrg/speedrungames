import gamesData from "./games.data.json";

export interface Game {
  /** URL-safe slug. For proxied games, must match the Netlify subdomain. */
  slug: string;
  title: string;
  description: string;
  /** URL the home grid / nav links to. For proxied games, use `/games/<slug>/`. */
  href: string;
  emoji: string;
  /**
   * If set, this game lives in its own repo and is served by Netlify proxy
   * rewrite. The build script generates `/games/<slug>/*` → `<proxyTo>/:splat`
   * in `apps/web/public/_redirects`. Adding a game = adding one entry here.
   * Omit for games whose source lives in this monorepo (legacy pattern).
   */
  proxyTo?: string;
  /** Hide from the home grid + nav. Use during incubation. */
  hidden?: boolean;
}

export const games: Game[] = gamesData as Game[];

export const visibleGames = games.filter((g) => !g.hidden);

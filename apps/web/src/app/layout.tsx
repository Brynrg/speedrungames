import type { Metadata } from "next";
import Link from "next/link";
import { Russo_One, Chakra_Petch } from "next/font/google";
import { visibleGames } from "@/lib/games";
import "./globals.css";

const display = Russo_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Speed Run Games",
  description: "Browser games you run against the clock. Post your time, climb the board.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <header>
          <div className="header-inner">
            <Link href="/" className="site-logo">
              <svg
                className="logo-mark"
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="14" r="8" />
                <path d="M12 14 15.5 10.5" />
                <path d="M9 3h6" />
                <path d="M12 3v3" />
              </svg>
              <span className="logo-name">Speed Run Games</span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <Link href="/#games">Games</Link>
              <Link href="/#records">Records</Link>
              <details className="games-menu">
                <summary aria-label="Browse all games">
                  All games
                  <span className="chev" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="games-menu-panel">
                  {visibleGames.map((game) => (
                    <a key={game.slug} href={game.href}>
                      <span className="menu-emoji" aria-hidden="true">
                        {game.emoji}
                      </span>
                      {game.title}
                    </a>
                  ))}
                </div>
              </details>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

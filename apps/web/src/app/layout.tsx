import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speed Run Games",
  description: "Play fast. Beat your record.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header>
          <div className="header-inner">
            <Link href="/" className="site-logo">
              ⚡ Speed Run Games
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <Link href="/">Home</Link>
              <Link href="/games/tower-wars">Tower Wars</Link>
              <Link href="/pokemonspeedrungen1">Pokémon Gen 1</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
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
          <a href="/" className="site-logo">
            ⚡ Speed Run Games
          </a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

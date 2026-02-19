import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokédex Speedrun",
  description: "Voice-first Gen 1 Pokemon speedrun",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

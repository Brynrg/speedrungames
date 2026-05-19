import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tower Wars II | Speed Run Games",
  description: "Play Tower Wars II in an isolated static iframe runtime.",
};

export default function TowerWars2Page() {
  return (
    <main style={{ width: "100%", height: "calc(100vh - 60px)" }}>
      <iframe
        src="/games/tower-wars-2/index.html"
        title="Tower Wars II"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-gamepad"
        allow="gamepad; fullscreen"
        style={{ width: "100%", height: "100%", border: "0" }}
        loading="lazy"
      />
    </main>
  );
}

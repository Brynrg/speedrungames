import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tower Wars | Speed Run Games",
  description: "Play Tower Wars in an isolated static iframe runtime.",
};

export default function TowerWarsPage() {
  return (
    <main style={{ width: "100%", height: "calc(100vh - 60px)" }}>
      <iframe
        src="/games/tower-wars/index.html"
        title="Tower Wars"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-gamepad"
        allow="gamepad; fullscreen"
        style={{ width: "100%", height: "100%", border: "0" }}
        loading="lazy"
      />
    </main>
  );
}

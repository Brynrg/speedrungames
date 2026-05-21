import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tank You Again | Speed Run Games",
  description: "Play Tank You Again in an isolated static iframe runtime.",
};

export default function TankYouAgainPage() {
  return (
    <main style={{ width: "100%", height: "calc(100vh - 60px)" }}>
      <iframe
        src="/games/tank-you-again/index.html"
        title="Tank You Again"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-gamepad"
        allow="gamepad; fullscreen"
        style={{ width: "100%", height: "100%", border: "0" }}
        loading="lazy"
      />
    </main>
  );
}

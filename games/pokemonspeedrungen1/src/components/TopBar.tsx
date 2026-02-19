import styles from "@/components/ui.module.css";
import type { SpeechStatus } from "@/lib/speech/SpeechProvider";

export type InputMode = "voice" | "tap";

type TopBarProps = {
  timerLabel: string;
  progressLabel: string;
  mode: InputMode;
  canUseVoice: boolean;
  micStatus: SpeechStatus;
  micDetail?: string;
  difficulty: 1 | 2;
  onToggleMode: () => void;
};

function micLabel(status: SpeechStatus, detail?: string): string {
  switch (status) {
    case "listening":
      return "listening";
    case "starting":
      return "starting";
    case "denied":
      return "denied";
    case "error":
      return detail ? `error (${detail})` : "error";
    case "unsupported":
      return "unsupported";
    default:
      return "idle";
  }
}

export function TopBar({
  timerLabel,
  progressLabel,
  mode,
  canUseVoice,
  micStatus,
  micDetail,
  difficulty,
  onToggleMode,
}: TopBarProps) {
  return (
    <section className={styles.topBar}>
      <article className={styles.metric}>
        <span>Timer (elapsed + penalties)</span>
        <strong>{timerLabel}</strong>
      </article>

      <article className={styles.metric}>
        <span>Progress</span>
        <strong>{progressLabel}</strong>
      </article>

      <article className={`${styles.metric} ${styles.modeCard}`}>
        <div>
          <span>Mode</span>
          <strong>{mode.toUpperCase()}</strong>
          <div>
            Mic: {" "}
            <span className={micStatus === "listening" ? styles.statusOk : micStatus === "denied" ? styles.statusBad : ""}>
              {micLabel(micStatus, micDetail)}
            </span>
          </div>
          <div>Difficulty: L{difficulty}</div>
        </div>

        <button type="button" className={styles.modeButton} onClick={onToggleMode} disabled={!canUseVoice && mode === "tap"}>
          {mode === "voice" ? "Use TAP" : "Use VOICE"}
        </button>
      </article>
    </section>
  );
}

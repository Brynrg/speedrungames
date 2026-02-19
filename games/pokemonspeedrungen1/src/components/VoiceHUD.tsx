import styles from "./ui.module.css";

type VoiceHUDProps = {
  transcript: string;
  lastAcceptedName: string;
};

export function VoiceHUD({ transcript, lastAcceptedName }: VoiceHUDProps) {
  return (
    <section className={styles.voiceHud}>
      <p className={styles.hudLine}>Live transcript: {transcript || "..."}</p>
      {lastAcceptedName ? <div className={styles.toast}>Accepted: {lastAcceptedName}</div> : null}
    </section>
  );
}

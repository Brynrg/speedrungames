import styles from "@/components/ui.module.css";

type EndScreenProps = {
  finalTimeLabel: string;
  penaltyCount: number;
  penaltySecondsLabel: string;
  unlockedThisRun: boolean;
  onRestart: () => void;
  onBackToStart: () => void;
};

export function EndScreen({
  finalTimeLabel,
  penaltyCount,
  penaltySecondsLabel,
  unlockedThisRun,
  onRestart,
  onBackToStart,
}: EndScreenProps) {
  return (
    <section className={styles.shell}>
      <header>
        <h1 className={styles.title}>Run Complete</h1>
        <p className={styles.subtitle}>Full 151 complete.</p>
      </header>

      <div className={styles.endBlock}>
        <p className={styles.resultLine}>Final time: {finalTimeLabel}</p>
        <p className={styles.resultLine}>Wrong tap penalties: {penaltyCount}</p>
        <p className={styles.resultLine}>Penalty seconds: {penaltySecondsLabel}</p>
        {unlockedThisRun ? <p className={styles.resultLine}>Silhouette Mode unlocked.</p> : null}
      </div>

      <div className={styles.actionRow}>
        <button type="button" className={styles.actionButton} onClick={onRestart}>
          Restart
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onBackToStart}>
          Back to Start
        </button>
      </div>
    </section>
  );
}

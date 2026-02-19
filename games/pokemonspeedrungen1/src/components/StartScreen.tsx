import styles from "./ui.module.css";

export type Difficulty = 1 | 2;

type StartScreenProps = {
  difficulty: Difficulty;
  level2Unlocked: boolean;
  preferVoice: boolean;
  speechSupported: boolean;
  isStarting: boolean;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onPreferVoiceChange: (value: boolean) => void;
  onStart: () => void;
};

export function StartScreen({
  difficulty,
  level2Unlocked,
  preferVoice,
  speechSupported,
  isStarting,
  onDifficultyChange,
  onPreferVoiceChange,
  onStart,
}: StartScreenProps) {
  return (
    <section className={styles.shell}>
      <header>
        <h1 className={styles.title}>Pokédex Speedrun</h1>
        <p className={styles.subtitle}>Name all 151 Gen 1 Pokémon as fast as possible.</p>
      </header>

      <div className={styles.startGrid}>
        <div className={styles.optionRow}>
          <strong>Difficulty</strong>
          <div className={styles.levelList}>
            <button
              type="button"
              className={`${styles.levelButton} ${difficulty === 1 ? styles.levelSelected : ""}`}
              onClick={() => onDifficultyChange(1)}
            >
              <strong>Level 1</strong>
              <p className={styles.muted}>Full color image</p>
            </button>

            <button
              type="button"
              className={`${styles.levelButton} ${difficulty === 2 ? styles.levelSelected : ""} ${
                !level2Unlocked ? styles.levelLocked : ""
              }`}
              onClick={() => onDifficultyChange(2)}
              disabled={!level2Unlocked}
            >
              <strong>Level 2</strong>
              {!level2Unlocked ? (
                <p className={styles.muted}>
                  <span className={styles.lockLine}>
                    <span aria-hidden="true">🔒</span>
                    <span>Complete Level 1 to unlock</span>
                  </span>
                </p>
              ) : (
                <p className={styles.muted}>Silhouette-only image</p>
              )}
            </button>
          </div>
        </div>

        <div className={styles.optionRow}>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={preferVoice}
              onChange={(event) => onPreferVoiceChange(event.target.checked)}
            />
            <span>Prefer Voice (default)</span>
          </label>
          {!speechSupported ? (
            <p className={styles.muted}>Voice unavailable in this browser. Tap mode will be used.</p>
          ) : null}
        </div>

        <div className={styles.optionRow}>
          <button type="button" className={styles.actionButton} onClick={onStart} disabled={isStarting}>
            {isStarting ? "Starting..." : "Start"}
          </button>
        </div>
      </div>
    </section>
  );
}

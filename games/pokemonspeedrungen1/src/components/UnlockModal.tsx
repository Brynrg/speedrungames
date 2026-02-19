import styles from "@/components/ui.module.css";

type UnlockModalProps = {
  open: boolean;
  onDismiss: () => void;
};

export function UnlockModal({ open, onDismiss }: UnlockModalProps) {
  if (!open) {
    return null;
  }

  return (
    <section className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Silhouette mode unlocked">
      <div className={styles.modalCard}>
        <h2 className={styles.title}>Silhouette Mode Unlocked!</h2>
        <p className={styles.subtitle}>Level 2 is now available from the start screen.</p>
        <div className={styles.actionRow}>
          <button type="button" className={styles.actionButton} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

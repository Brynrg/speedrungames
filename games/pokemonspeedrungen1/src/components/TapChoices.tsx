import styles from "@/components/ui.module.css";

export type TapOption = {
  id: number;
  name: string;
};

type TapChoicesProps = {
  options: TapOption[];
  shake: boolean;
  onChoose: (id: number) => void;
};

export function TapChoices({ options, shake, onChoose }: TapChoicesProps) {
  return (
    <section className={`${styles.tapPanel} ${shake ? styles.shake : ""}`}>
      <div className={styles.choices}>
        {options.map((option) => (
          <button key={option.id} type="button" className={styles.choiceButton} onClick={() => onChoose(option.id)}>
            {option.name}
          </button>
        ))}
      </div>
    </section>
  );
}

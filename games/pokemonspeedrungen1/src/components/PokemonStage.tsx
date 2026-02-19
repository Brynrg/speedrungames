import { useEffect, useState } from "react";
import styles from "./ui.module.css";

type PokemonStageProps = {
  imageSrc: string | null;
  ready: boolean;
  alt: string;
};

export function PokemonStage({ imageSrc, ready, alt }: PokemonStageProps) {
  const [broken, setBroken] = useState<boolean>(false);

  useEffect(() => {
    setBroken(false);
  }, [imageSrc]);

  return (
    <section className={styles.stage}>
      {!ready || !imageSrc ? (
        <div className={styles.stageLoading}>Loading Pokémon image...</div>
      ) : broken ? (
        <div className={styles.stageLoading}>Image missing at local asset path.</div>
      ) : (
        <img src={imageSrc} alt={alt} draggable={false} onError={() => setBroken(true)} />
      )}
    </section>
  );
}

import { PokemonStage } from "./PokemonStage";
import { TapChoices, type TapOption } from "./TapChoices";
import { TopBar, type InputMode } from "./TopBar";
import { VoiceHUD } from "./VoiceHUD";
import styles from "./ui.module.css";
import type { SpeechStatus } from "../lib/speech/SpeechProvider";

type RunScreenProps = {
  timerLabel: string;
  progressLabel: string;
  mode: InputMode;
  canUseVoice: boolean;
  micStatus: SpeechStatus;
  micDetail?: string;
  difficulty: 1 | 2;
  banner: string;
  imageSrc: string | null;
  imageReady: boolean;
  imageAlt: string;
  transcript: string;
  lastAcceptedName: string;
  tapOptions: TapOption[];
  tapShake: boolean;
  onToggleMode: () => void;
  onTapChoice: (id: number) => void;
};

export function RunScreen({
  timerLabel,
  progressLabel,
  mode,
  canUseVoice,
  micStatus,
  micDetail,
  difficulty,
  banner,
  imageSrc,
  imageReady,
  imageAlt,
  transcript,
  lastAcceptedName,
  tapOptions,
  tapShake,
  onToggleMode,
  onTapChoice,
}: RunScreenProps) {
  return (
    <section className={styles.shell}>
      <TopBar
        timerLabel={timerLabel}
        progressLabel={progressLabel}
        mode={mode}
        canUseVoice={canUseVoice}
        micStatus={micStatus}
        micDetail={micDetail}
        difficulty={difficulty}
        onToggleMode={onToggleMode}
      />

      {banner ? <div className={styles.banner}>{banner}</div> : null}

      <PokemonStage imageSrc={imageSrc} ready={imageReady} alt={imageAlt} />

      <div className={styles.bottomRow}>
        {mode === "voice" ? (
          <VoiceHUD transcript={transcript} lastAcceptedName={lastAcceptedName} />
        ) : (
          <TapChoices options={tapOptions} shake={tapShake} onChoose={onTapChoice} />
        )}
      </div>
    </section>
  );
}

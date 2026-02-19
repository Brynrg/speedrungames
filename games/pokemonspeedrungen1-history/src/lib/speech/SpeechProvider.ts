export type SpeechStatus = "idle" | "starting" | "listening" | "denied" | "error" | "unsupported";

export type SpeechCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onStatus: (status: SpeechStatus, detail?: string) => void;
};

export type StartSpeechOptions = {
  lang: string;
};

export interface SpeechProvider {
  readonly supported: boolean;
  readonly active: boolean;
  setCallbacks(callbacks: SpeechCallbacks): void;
  start(options: StartSpeechOptions): Promise<void>;
  stop(): void;
  destroy(): void;
}

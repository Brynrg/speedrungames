import type { SpeechCallbacks, SpeechProvider, SpeechStatus, StartSpeechOptions } from "@/lib/speech/SpeechProvider";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: ((this: BrowserSpeechRecognition, ev: Event) => unknown) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => unknown) | null;
  onerror: ((this: BrowserSpeechRecognition, ev: SpeechRecognitionErrorEventLike) => unknown) | null;
  onresult: ((this: BrowserSpeechRecognition, ev: SpeechRecognitionEventLike) => unknown) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => BrowserSpeechRecognition;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

const NOOP_CALLBACKS: SpeechCallbacks = {
  onInterim: () => undefined,
  onFinal: () => undefined,
  onStatus: () => undefined,
};

function mapErrorToStatus(error: string): SpeechStatus {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "denied";
  }
  return "error";
}

export class WebSpeechProvider implements SpeechProvider {
  private recognition: BrowserSpeechRecognition | null = null;
  private callbacks: SpeechCallbacks = NOOP_CALLBACKS;
  private shouldContinue = false;
  private status: SpeechStatus = "idle";

  public get supported(): boolean {
    return Boolean(this.getCtor());
  }

  public get active(): boolean {
    return this.shouldContinue;
  }

  public setCallbacks(callbacks: SpeechCallbacks): void {
    this.callbacks = callbacks;
  }

  public async start(options: StartSpeechOptions): Promise<void> {
    const Ctor = this.getCtor();
    if (!Ctor) {
      this.emitStatus("unsupported", "Web Speech API not available");
      throw new Error("Speech not supported");
    }

    this.shouldContinue = true;

    if (!this.recognition) {
      this.recognition = new Ctor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.bindRecognitionEvents(this.recognition, options);
    }

    this.recognition.lang = options.lang;

    this.emitStatus("starting");

    try {
      this.recognition.start();
    } catch {
      // Safari/Chrome can throw if start is called while already active.
    }
  }

  public stop(): void {
    this.shouldContinue = false;
    if (!this.recognition) {
      this.emitStatus("idle");
      return;
    }

    try {
      this.recognition.stop();
    } catch {
      // Ignore stop failures.
    }

    this.emitStatus("idle");
  }

  public destroy(): void {
    this.stop();
    this.recognition = null;
  }

  private getCtor(): SpeechRecognitionConstructorLike | null {
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }

  private emitStatus(status: SpeechStatus, detail?: string): void {
    this.status = status;
    this.callbacks.onStatus(status, detail);
  }

  private bindRecognitionEvents(recognition: BrowserSpeechRecognition, options: StartSpeechOptions): void {
    recognition.lang = options.lang;

    recognition.onstart = () => {
      this.emitStatus("listening");
    };

    recognition.onend = () => {
      if (this.shouldContinue) {
        try {
          recognition.start();
        } catch {
          // Browser may reject immediate restart. It will retry on next tick.
          setTimeout(() => {
            if (!this.shouldContinue) {
              return;
            }
            try {
              recognition.start();
            } catch {
              this.emitStatus("error", "Auto-restart failed");
            }
          }, 120);
        }
      } else {
        this.emitStatus("idle");
      }
    };

    recognition.onerror = (event) => {
      const status = mapErrorToStatus(event.error);
      this.emitStatus(status, event.error);
      if (status === "denied") {
        this.shouldContinue = false;
      }
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          this.callbacks.onFinal(transcript);
        } else {
          this.callbacks.onInterim(transcript);
        }
      }
    };
  }
}

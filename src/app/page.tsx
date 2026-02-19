"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EndScreen } from "@/components/EndScreen";
import { RunScreen } from "@/components/RunScreen";
import { StartScreen, type Difficulty } from "@/components/StartScreen";
import { UnlockModal } from "@/components/UnlockModal";
import styles from "@/components/ui.module.css";
import { GEN1_POKEMON, type Gen1Pokemon } from "@/data/gen1";
import { normalize } from "@/lib/normalize";
import { ensureImageLoadedById, preloadAllGen1 } from "@/lib/preload";
import { getSilhouetteForId } from "@/lib/silhouette";
import type { SpeechStatus } from "@/lib/speech/SpeechProvider";
import { WebSpeechProvider } from "@/lib/speech/WebSpeechProvider";
import type { InputMode } from "@/components/TopBar";
import type { TapOption } from "@/components/TapChoices";

const TOTAL_POKEMON = 151;
const LEVEL2_KEY = "pokedex_speedrun_level2_unlocked";

const POKEMON_BY_ID = new Map<number, Gen1Pokemon>(GEN1_POKEMON.map((pokemon) => [pokemon.id, pokemon]));

type Screen = "start" | "run" | "end";

function formatMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const centiseconds = Math.floor((safe % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function containsWholeWords(text: string, variant: string): boolean {
  if (!text || !variant) {
    return false;
  }

  const paddedText = ` ${text} `;
  const paddedVariant = ` ${variant} `;
  return paddedText.includes(paddedVariant);
}

function matchesCurrentTranscript(normalizedTranscript: string, variants: Set<string>): boolean {
  if (variants.has(normalizedTranscript)) {
    return true;
  }

  for (const variant of variants) {
    if (containsWholeWords(normalizedTranscript, variant)) {
      return true;
    }
  }

  return false;
}

function makeTapOptions(correctId: number): TapOption[] {
  const pool = GEN1_POKEMON.filter((pokemon) => pokemon.id !== correctId).map((pokemon) => pokemon.id);
  shuffleInPlace(pool);

  const picks = [correctId, pool[0], pool[1], pool[2]];
  shuffleInPlace(picks);

  return picks.map((id) => ({
    id,
    name: POKEMON_BY_ID.get(id)?.name ?? "Unknown",
  }));
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [runDifficulty, setRunDifficulty] = useState<Difficulty>(1);
  const [preferVoice, setPreferVoice] = useState<boolean>(true);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [level2Unlocked, setLevel2Unlocked] = useState<boolean>(false);

  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState<number>(0);

  const [mode, setMode] = useState<InputMode>("tap");
  const [micStatus, setMicStatus] = useState<SpeechStatus>("idle");
  const [micDetail, setMicDetail] = useState<string>("");

  const [banner, setBanner] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [lastAcceptedName, setLastAcceptedName] = useState<string>("");

  const [tapOptions, setTapOptions] = useState<TapOption[]>([]);
  const [tapShake, setTapShake] = useState<boolean>(false);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState<boolean>(false);

  const [timerMs, setTimerMs] = useState<number>(0);
  const [penaltyMs, setPenaltyMs] = useState<number>(0);
  const [penaltyCount, setPenaltyCount] = useState<number>(0);

  const [finalTimeMs, setFinalTimeMs] = useState<number>(0);
  const [finalPenaltyMs, setFinalPenaltyMs] = useState<number>(0);
  const [finalPenaltyCount, setFinalPenaltyCount] = useState<number>(0);

  const [unlockedThisRun, setUnlockedThisRun] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);

  const speechProviderRef = useRef<WebSpeechProvider | null>(null);
  const silhouetteCacheRef = useRef<Map<number, string>>(new Map());

  const runActiveRef = useRef<boolean>(false);
  const screenRef = useRef<Screen>("start");
  const modeRef = useRef<InputMode>("tap");
  const orderRef = useRef<number[]>([]);
  const indexRef = useRef<number>(0);
  const runDifficultyRef = useRef<Difficulty>(1);
  const runStartRef = useRef<number>(0);
  const penaltyMsRef = useRef<number>(0);
  const penaltyCountRef = useRef<number>(0);
  const level2UnlockedRef = useRef<boolean>(false);
  const acceptGateRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const currentVariantsRef = useRef<Set<string>>(new Set());

  const shakeTimeoutRef = useRef<number | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);

  const currentPokemon = useMemo<Gen1Pokemon | null>(() => {
    if (screen !== "run") {
      return null;
    }

    const id = order[index];
    if (!id) {
      return null;
    }

    return POKEMON_BY_ID.get(id) ?? null;
  }, [screen, order, index]);

  const clearBanner = useCallback((message = "") => {
    if (bannerTimeoutRef.current) {
      window.clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }

    setBanner(message);
  }, []);

  const showBanner = useCallback(
    (message: string) => {
      clearBanner(message);
      bannerTimeoutRef.current = window.setTimeout(() => {
        setBanner("");
      }, 2200);
    },
    [clearBanner],
  );

  const stopTicker = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();

    const tick = () => {
      if (!runActiveRef.current) {
        return;
      }

      setTimerMs(performance.now() - runStartRef.current + penaltyMsRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopTicker]);

  const switchToTapMode = useCallback(
    (message: string) => {
      setMode("tap");
      modeRef.current = "tap";
      speechProviderRef.current?.stop();
      showBanner(message);
    },
    [showBanner],
  );

  const finishRun = useCallback(() => {
    if (!runActiveRef.current) {
      return;
    }

    runActiveRef.current = false;
    stopTicker();
    speechProviderRef.current?.stop();

    const final = performance.now() - runStartRef.current + penaltyMsRef.current;
    setTimerMs(final);
    setFinalTimeMs(final);
    setFinalPenaltyMs(penaltyMsRef.current);
    setFinalPenaltyCount(penaltyCountRef.current);

    let unlockedNow = false;
    if (runDifficultyRef.current === 1 && !level2UnlockedRef.current) {
      unlockedNow = true;
      level2UnlockedRef.current = true;
      setLevel2Unlocked(true);
      localStorage.setItem(LEVEL2_KEY, "true");
      setShowUnlockModal(true);
    }

    setUnlockedThisRun(unlockedNow);

    setScreen("end");
    screenRef.current = "end";
  }, [stopTicker]);

  const acceptCurrent = useCallback(
    (acceptedName: string) => {
      if (!runActiveRef.current || screenRef.current !== "run") {
        return;
      }

      const now = performance.now();
      if (now - acceptGateRef.current < 250) {
        return;
      }

      acceptGateRef.current = now;
      setLastAcceptedName(acceptedName);
      setTranscript("");

      const nextIndex = indexRef.current + 1;
      if (nextIndex >= TOTAL_POKEMON) {
        finishRun();
        return;
      }

      indexRef.current = nextIndex;
      setIndex(nextIndex);
    },
    [finishRun],
  );

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    runDifficultyRef.current = runDifficulty;
  }, [runDifficulty]);

  useEffect(() => {
    penaltyMsRef.current = penaltyMs;
  }, [penaltyMs]);

  useEffect(() => {
    penaltyCountRef.current = penaltyCount;
  }, [penaltyCount]);

  useEffect(() => {
    if (currentPokemon) {
      const accepted = new Set<string>([normalize(currentPokemon.name), ...currentPokemon.variants.map((entry) => normalize(entry))]);
      currentVariantsRef.current = accepted;
    }
  }, [currentPokemon]);

  useEffect(() => {
    const provider = new WebSpeechProvider();
    speechProviderRef.current = provider;
    setSpeechSupported(provider.supported);

    provider.setCallbacks({
      onInterim: (text) => {
        if (!runActiveRef.current || modeRef.current !== "voice" || screenRef.current !== "run") {
          return;
        }
        setTranscript(text);
      },
      onFinal: (text) => {
        if (!runActiveRef.current || modeRef.current !== "voice" || screenRef.current !== "run") {
          return;
        }

        setTranscript(text);
        const normalizedTranscript = normalize(text);
        if (!normalizedTranscript) {
          return;
        }

        if (matchesCurrentTranscript(normalizedTranscript, currentVariantsRef.current)) {
          const pokemon = POKEMON_BY_ID.get(orderRef.current[indexRef.current]);
          acceptCurrent(pokemon?.name ?? text);
        }
      },
      onStatus: (status, detail) => {
        setMicStatus(status);
        setMicDetail(detail ?? "");

        if ((status === "denied" || status === "error" || status === "unsupported") && modeRef.current === "voice") {
          switchToTapMode("Voice unavailable. Switched to TAP.");
        }
      },
    });

    if (!provider.supported) {
      setMicStatus("unsupported");
    }

    return () => {
      provider.destroy();
      stopTicker();
      if (shakeTimeoutRef.current) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      if (bannerTimeoutRef.current) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, [acceptCurrent, stopTicker, switchToTapMode]);

  useEffect(() => {
    const unlocked = localStorage.getItem(LEVEL2_KEY) === "true";
    level2UnlockedRef.current = unlocked;
    setLevel2Unlocked(unlocked);
    if (!unlocked) {
      setDifficulty(1);
    }
  }, []);

  useEffect(() => {
    if (screen !== "run" || !currentPokemon) {
      return;
    }

    setTapOptions(makeTapOptions(currentPokemon.id));
  }, [screen, currentPokemon?.id]);

  useEffect(() => {
    if (screen !== "run" || !currentPokemon) {
      return;
    }

    let cancelled = false;
    const localDifficulty = runDifficulty;

    setImageReady(false);

    const loadCurrent = async () => {
      const baseSrc = await ensureImageLoadedById(currentPokemon.id);
      let nextSrc = baseSrc;

      if (localDifficulty === 2) {
        try {
          nextSrc = await getSilhouetteForId(currentPokemon.id, baseSrc, silhouetteCacheRef.current);
        } catch {
          nextSrc = baseSrc;
        }
      }

      if (cancelled) {
        return;
      }

      setImageSrc(nextSrc);
      setImageReady(true);
    };

    void loadCurrent();

    const nextId = order[index + 1];
    if (nextId) {
      void ensureImageLoadedById(nextId).then((src) => {
        if (localDifficulty === 2) {
          void getSilhouetteForId(nextId, src, silhouetteCacheRef.current).catch(() => undefined);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [screen, currentPokemon, runDifficulty, order, index]);

  const startRun = useCallback(
    async (difficultyToUse: Difficulty, preferVoiceToUse: boolean) => {
      if (isStarting) {
        return;
      }

      setIsStarting(true);
      clearBanner();
      setTranscript("");
      setLastAcceptedName("");
      setTapShake(false);
      setShowUnlockModal(false);
      setUnlockedThisRun(false);

      const ids = GEN1_POKEMON.map((pokemon) => pokemon.id);
      shuffleInPlace(ids);
      preloadAllGen1(ids);

      const firstId = ids[0];
      const firstSrc = await ensureImageLoadedById(firstId);
      if (difficultyToUse === 2) {
        try {
          await getSilhouetteForId(firstId, firstSrc, silhouetteCacheRef.current);
        } catch {
          // Keep base image fallback.
        }
      }

      setOrder(ids);
      orderRef.current = ids;
      setIndex(0);
      indexRef.current = 0;

      setPenaltyMs(0);
      setPenaltyCount(0);
      penaltyMsRef.current = 0;
      penaltyCountRef.current = 0;

      setRunDifficulty(difficultyToUse);
      runDifficultyRef.current = difficultyToUse;

      const initialMode: InputMode = preferVoiceToUse ? "voice" : "tap";
      setMode(initialMode);
      modeRef.current = initialMode;

      setMicDetail("");
      setTimerMs(0);

      setScreen("run");
      screenRef.current = "run";
      runStartRef.current = performance.now();
      runActiveRef.current = true;
      acceptGateRef.current = 0;

      startTicker();

      if (preferVoiceToUse) {
        const provider = speechProviderRef.current;
        if (!provider || !provider.supported) {
          switchToTapMode("Voice unavailable. Switched to TAP.");
        } else {
          try {
            await provider.start({ lang: "en-US" });
          } catch {
            switchToTapMode("Microphone denied. Switched to TAP.");
          }
        }
      } else {
        speechProviderRef.current?.stop();
      }

      setIsStarting(false);
    },
    [clearBanner, isStarting, startTicker, switchToTapMode],
  );

  const onStart = useCallback(() => {
    const pickedDifficulty = difficulty;
    const voicePreference = preferVoice;
    void startRun(pickedDifficulty, voicePreference);
  }, [difficulty, preferVoice, startRun]);

  const onRestart = useCallback(() => {
    void startRun(runDifficultyRef.current, preferVoice);
  }, [preferVoice, startRun]);

  const onBackToStart = useCallback(() => {
    runActiveRef.current = false;
    speechProviderRef.current?.stop();
    stopTicker();
    clearBanner();
    setScreen("start");
    screenRef.current = "start";
    setTranscript("");
    setLastAcceptedName("");
  }, [clearBanner, stopTicker]);

  const onTapChoice = useCallback(
    (id: number) => {
      if (!runActiveRef.current || screenRef.current !== "run") {
        return;
      }

      const currentId = orderRef.current[indexRef.current];
      if (!currentId) {
        return;
      }

      if (id === currentId) {
        const pokemon = POKEMON_BY_ID.get(currentId);
        acceptCurrent(pokemon?.name ?? "Correct");
        return;
      }

      setPenaltyMs((previous) => {
        const next = previous + 1000;
        penaltyMsRef.current = next;
        return next;
      });
      setPenaltyCount((previous) => {
        const next = previous + 1;
        penaltyCountRef.current = next;
        return next;
      });

      setTapShake(true);
      if (shakeTimeoutRef.current) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      shakeTimeoutRef.current = window.setTimeout(() => {
        setTapShake(false);
      }, 130);
    },
    [acceptCurrent],
  );

  const onToggleMode = useCallback(async () => {
    if (screenRef.current !== "run") {
      return;
    }

    if (modeRef.current === "voice") {
      setMode("tap");
      modeRef.current = "tap";
      speechProviderRef.current?.stop();
      return;
    }

    const provider = speechProviderRef.current;
    if (!provider || !provider.supported) {
      switchToTapMode("Voice unavailable on this browser.");
      return;
    }

    setMode("voice");
    modeRef.current = "voice";
    clearBanner();

    try {
      await provider.start({ lang: "en-US" });
    } catch {
      switchToTapMode("Could not enable microphone. Switched to TAP.");
    }
  }, [clearBanner, switchToTapMode]);

  const progressLabel = `${Math.min(index + 1, TOTAL_POKEMON)} / ${TOTAL_POKEMON}`;

  return (
    <main className={styles.page}>
      {screen === "start" ? (
        <StartScreen
          difficulty={difficulty}
          level2Unlocked={level2Unlocked}
          preferVoice={preferVoice}
          speechSupported={speechSupported}
          isStarting={isStarting}
          onDifficultyChange={setDifficulty}
          onPreferVoiceChange={setPreferVoice}
          onStart={onStart}
        />
      ) : null}

      {screen === "run" && currentPokemon ? (
        <RunScreen
          timerLabel={formatMs(timerMs)}
          progressLabel={progressLabel}
          mode={mode}
          canUseVoice={speechSupported}
          micStatus={micStatus}
          micDetail={micDetail}
          difficulty={runDifficulty}
          banner={banner}
          imageSrc={imageSrc}
          imageReady={imageReady}
          imageAlt={`${currentPokemon.name} artwork`}
          transcript={transcript}
          lastAcceptedName={lastAcceptedName}
          tapOptions={tapOptions}
          tapShake={tapShake}
          onToggleMode={() => {
            void onToggleMode();
          }}
          onTapChoice={onTapChoice}
        />
      ) : null}

      {screen === "end" ? (
        <EndScreen
          finalTimeLabel={formatMs(finalTimeMs)}
          penaltyCount={finalPenaltyCount}
          penaltySecondsLabel={formatMs(finalPenaltyMs)}
          unlockedThisRun={unlockedThisRun}
          onRestart={onRestart}
          onBackToStart={onBackToStart}
        />
      ) : null}

      <UnlockModal
        open={showUnlockModal}
        onDismiss={() => {
          setShowUnlockModal(false);
        }}
      />
    </main>
  );
}

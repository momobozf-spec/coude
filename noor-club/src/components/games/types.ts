"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgeBand } from "@/lib/validators";

/**
 * The one contract every engine implements.
 *
 * `ageBand` is passed in because the scoring rule differs per band (see
 * `computeScore`); everything else an engine needs lives in `data`.
 */
export type GameProps<TData> = {
  data: TData;
  locale: string;
  ageBand: AgeBand;
  /** Roep exact één keer aan als het spel klaar is. score 0-100. */
  onFinish: (score: number, durationSec: number) => void;
};

export type Feedback = "idle" | "correct" | "wrong";

/** Returns a getter for seconds elapsed since the component mounted. */
export function useElapsedSeconds(): () => number {
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  return useCallback(() => Math.round((Date.now() - startedAt.current) / 1000), []);
}

/**
 * Non-blocking feedback: a value that flips to "correct"/"wrong" for a moment
 * and then clears itself. No modals, no dialogs, nothing to dismiss.
 */
export function useFeedback(resetMs = 500) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (next: Exclude<Feedback, "idle">) => {
      if (timer.current) clearTimeout(timer.current);
      setFeedback(next);
      timer.current = setTimeout(() => setFeedback("idle"), resetMs);
    },
    [resetMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { feedback, flash };
}

/**
 * Guards `onFinish` so an engine can never report twice, no matter how the
 * player hammers the last button. `GameHost` writes to the database on finish.
 */
export function useOnce(onFinish: (score: number, durationSec: number) => void) {
  const fired = useRef(false);

  return useCallback(
    (score: number, durationSec: number) => {
      if (fired.current) return;
      fired.current = true;
      onFinish(score, durationSec);
    },
    [onFinish],
  );
}

/** Deterministic shuffle so re-renders never reorder the board mid-game. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    const j = Math.abs(hash) % (i + 1);
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

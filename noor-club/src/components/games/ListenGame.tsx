"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameShell, feedbackClasses } from "@/components/games/GameShell";
import {
  seededShuffle,
  useElapsedSeconds,
  useFeedback,
  useOnce,
  type GameProps,
} from "@/components/games/types";
import type { ListenData } from "@/lib/game-schemas";
import { computeScore } from "@/lib/scoring";
import { play, unlockAudio } from "@/lib/audio";
import { cn } from "@/lib/cn";

/** Milliseconds the green pulse stays on screen before the next round loads. */
const ADVANCE_MS = 700;

type Choice = {
  key: string;
  glyph: string;
  correct: boolean;
};

type Round = {
  id: string;
  audioUrl: string;
  choices: Choice[];
};

export function ListenGame({ data, locale, ageBand, onFinish }: GameProps<ListenData>) {
  // `locale` hoort bij het gedeelde GameProps-contract; een LISTEN-payload bevat
  // geen vertaalde teksten (alleen Arabische glyphs), dus hij wordt hier niet gebruikt.
  void locale;

  const t = useTranslations("games");
  const elapsedSeconds = useElapsedSeconds();
  const finish = useOnce(onFinish);
  const { feedback, flash } = useFeedback(600);

  const [current, setCurrent] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [solvedKey, setSolvedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  // 0 = fine, 1 = ask for one more tap, 2+ = this device is not going to play.
  const [audioFailures, setAudioFailures] = useState(0);
  const [locked, setLocked] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousRound = useRef(0);

  const seed = data.rounds[0]?.id ?? "listen";

  const board = useMemo<Round[]>(
    () =>
      data.rounds.map((round) => {
        const choices: Choice[] = round.options.map((glyph, index) => ({
          key: `${round.id}-${index}`,
          glyph,
          correct: index === round.correctIndex,
        }));
        return {
          id: round.id,
          audioUrl: round.audioUrl,
          choices: seededShuffle(choices, `${seed}-${round.id}`),
        };
      }),
    [data.rounds, seed],
  );

  const total = board.length;

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Na een ronde verdwijnen de oude knoppen uit de DOM; zonder dit valt de
  // toetsenbordfocus terug naar <body> en moet het kind opnieuw tabben.
  useEffect(() => {
    if (previousRound.current === current) return;
    previousRound.current = current;
    playButtonRef.current?.focus();
  }, [current]);

  const handlePlay = useCallback(() => {
    const round = board[current];
    if (round === undefined) return;

    // This handler *is* the user gesture, so it is the right place to lift
    // iOS's audio block if the start screen was somehow bypassed.
    unlockAudio();
    setHasPlayed(true);

    void play(round.audioUrl).then((ok) => {
      setAudioFailures((count) => (ok ? 0 : count + 1));
    });
  }, [board, current]);

  const handleChoose = useCallback(
    (choice: Choice) => {
      if (locked || solvedKey !== null || wrongKeys.includes(choice.key)) return;

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setActiveKey(choice.key);

      if (!choice.correct) {
        setWrongKeys((keys) => [...keys, choice.key]);
        flash("wrong");
        return;
      }

      setSolvedKey(choice.key);
      setLocked(true);
      flash("correct");

      const isLast = current >= total - 1;
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (isLast) {
          finish(
            computeScore({ correct: total, total, attempts: nextAttempts, ageBand }),
            elapsedSeconds(),
          );
          return;
        }
        setCurrent((index) => index + 1);
        setWrongKeys([]);
        setSolvedKey(null);
        setActiveKey(null);
        setHasPlayed(false);
        setAudioFailures(0);
        setLocked(false);
      }, ADVANCE_MS);
    },
    [
      ageBand,
      attempts,
      current,
      elapsedSeconds,
      finish,
      flash,
      locked,
      solvedKey,
      total,
      wrongKeys,
    ],
  );

  const round = board[current];
  if (round === undefined) return null;

  const step = Math.min(current + 1, total);
  const progressLabel = t("round", { current: step, total });
  const listenLabel = hasPlayed ? t("playAudioAgain") : t("playAudio");

  let statusText = "";
  if (feedback === "correct") statusText = t("correct");
  if (feedback === "wrong") statusText = t("wrong");

  return (
    <GameShell
      prompt={t("listen.prompt")}
      step={step}
      total={total}
      progressLabel={progressLabel}
    >
      <div className="flex flex-col items-center gap-4 md:gap-6">
        <button
          ref={playButtonRef}
          type="button"
          onClick={handlePlay}
          aria-label={listenLabel}
          className={cn(
            "flex size-24 shrink-0 items-center justify-center rounded-full bg-gold text-4xl text-white shadow-card transition-transform md:size-32 md:text-6xl",
            "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald focus-visible:ring-offset-2",
            "active:scale-95 hover:shadow-lift",
          )}
        >
          <span aria-hidden="true">🔊</span>
        </button>

        <p className="text-center text-base font-bold text-emerald-dark md:text-xl">
          {listenLabel}
        </p>

        {audioFailures === 1 ? (
          <p role="status" className="text-center text-sm font-bold text-gold">
            {t("audioTapAgain")}
          </p>
        ) : null}

        {audioFailures >= 2 ? (
          <p role="status" className="text-center text-sm font-bold text-red-600">
            {t("audioUnavailable")}
          </p>
        ) : null}

        <p
          role="status"
          aria-live="polite"
          className="min-h-[20px] text-center text-sm font-bold text-emerald"
        >
          {statusText}
        </p>

        {/* Two columns on a phone, four once the tablet is in landscape, so the
            glyphs sit in one row under the play button instead of scrolling. */}
        <ul className="grid w-full grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
          {round.choices.map((choice, index) => {
            const isWrong = wrongKeys.includes(choice.key);
            const isSolved = solvedKey === choice.key;
            const showFeedback = activeKey === choice.key;

            return (
              <li key={choice.key}>
                <button
                  type="button"
                  onClick={() => handleChoose(choice)}
                  aria-label={t("listen.optionLabel", { index: index + 1 })}
                  aria-disabled={isWrong || locked}
                  className={cn(
                    "tap-target flex min-h-[96px] w-full items-center justify-center rounded-card border-2 bg-white px-4 py-4 shadow-card transition md:min-h-[128px]",
                    "focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald focus-visible:ring-offset-2",
                    !isWrong && !isSolved && "border-emerald-light hover:border-emerald",
                    isWrong && "border-red-200 opacity-40",
                    isSolved && "border-emerald bg-emerald-light",
                    showFeedback && feedbackClasses(feedback),
                  )}
                >
                  <span className="arabic text-4xl leading-relaxed text-emerald-dark md:text-6xl">
                    {choice.glyph}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </GameShell>
  );
}

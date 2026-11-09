"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { feedbackClasses, GameShell } from "@/components/games/GameShell";
import type { GameProps } from "@/components/games/types";
import {
  seededShuffle,
  useElapsedSeconds,
  useFeedback,
  useOnce,
} from "@/components/games/types";
import { cn } from "@/lib/cn";
import type { WordBuildData } from "@/lib/game-schemas";
import { pickText } from "@/lib/i18n-json";
import { computeScore } from "@/lib/scoring";
import { play, unlockAudio } from "@/lib/audio";

/**
 * Een letter uit de pool. Dezelfde glyph kan meerdere keren voorkomen, dus de
 * knop wordt geïdentificeerd op positie, niet op teken.
 */
type PoolLetter = { glyph: string; key: string };

const ADVANCE_MS = 800;
const SHAKE_MS = 420;

export function WordBuildGame({ data, locale, ageBand, onFinish }: GameProps<WordBuildData>) {
  const t = useTranslations("games");
  const finishOnce = useOnce(onFinish);
  const elapsedSeconds = useElapsedSeconds();
  const { feedback, flash } = useFeedback(600);

  const [wordIndex, setWordIndex] = useState(0);
  /** Pool-posities in logische lettervolgorde: placements[0] hoort in slot 1. */
  const [placements, setPlacements] = useState<number[]>([]);
  const [shakeIndex, setShakeIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);

  const attemptsRef = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const words = data.words;
  const word = words[wordIndex];

  const targetLetters = useMemo(
    () => (word === undefined ? [] : Array.from(word.word)),
    [word],
  );

  const pool = useMemo<PoolLetter[]>(() => {
    if (word === undefined) return [];
    const entries = word.letters.map((glyph, index) => ({
      glyph,
      key: `${word.id}:${index}`,
    }));
    return seededShuffle(entries, word.id);
  }, [word]);

  /** Elke lettersleuf is een scorebaar item; perfect spelen = evenveel pogingen. */
  const totalSlots = useMemo(
    () => words.reduce((sum, item) => sum + Array.from(item.word).length, 0),
    [words],
  );

  useEffect(() => {
    setAudioFailed(false);
    setAudioPlayed(false);
  }, [wordIndex]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  if (word === undefined) return null;

  const usedPoolIndexes = new Set(placements);
  const nextSlot = placements.length;
  const wordComplete = targetLetters.length > 0 && nextSlot >= targetLetters.length;
  const step = Math.min(wordIndex + 1, words.length);
  const progressLabel = t("word", { current: step, total: words.length });
  const meaning = pickText(word.meaning, locale);
  const audioUrl = word.audioUrl;

  function shakeButton(poolIndex: number) {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    // Even naar null zodat dezelfde knop de animatie opnieuw afspeelt.
    setShakeIndex(null);
    shakeTimer.current = setTimeout(() => {
      setShakeIndex(poolIndex);
      shakeTimer.current = setTimeout(() => setShakeIndex(null), SHAKE_MS);
    }, 20);
  }

  function solveWord() {
    setLocked(true);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (wordIndex >= words.length - 1) {
        finishOnce(
          computeScore({
            correct: totalSlots,
            total: totalSlots,
            attempts: attemptsRef.current,
            ageBand,
          }),
          elapsedSeconds(),
        );
        return;
      }
      setWordIndex((current) => current + 1);
      setPlacements([]);
      setShakeIndex(null);
      setLocked(false);
    }, ADVANCE_MS);
  }

  function handleLetter(poolIndex: number) {
    if (locked || wordComplete) return;
    if (usedPoolIndexes.has(poolIndex)) return;

    const entry = pool[poolIndex];
    const expected = targetLetters[nextSlot];
    if (entry === undefined || expected === undefined) return;

    attemptsRef.current += 1;

    if (entry.glyph !== expected) {
      shakeButton(poolIndex);
      return;
    }

    const next = [...placements, poolIndex];
    setPlacements(next);
    flash("correct");
    if (next.length === targetLetters.length) solveWord();
  }

  function handleRemoveLast() {
    if (locked || placements.length === 0) return;
    setPlacements(placements.slice(0, -1));
  }

  function handleClear() {
    if (locked || placements.length === 0) return;
    // Pogingen blijven staan: wissen is geen gratis herstart.
    setPlacements([]);
    setShakeIndex(null);
  }

  function handlePlayAudio() {
    if (audioUrl === undefined) return;

    unlockAudio();
    setAudioPlayed(true);
    void play(audioUrl).then((ok) => setAudioFailed(!ok));
  }

  return (
    <GameShell
      prompt={t("wordbuild.prompt")}
      step={step}
      total={words.length}
      progressLabel={progressLabel}
    >
      {/* Landscape tablet splits the board in two: the word being built on the
          left, the letter pool on the right, so each thumb owns one half. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 id="wordbuild-slots-label" className="text-sm font-bold text-emerald-dark md:text-base">
            {t("wordbuild.yourWord")}
          </h2>

          <div
            role="group"
            aria-labelledby="wordbuild-slots-label"
            dir="rtl"
            className={cn(
              "flex flex-wrap items-center justify-center gap-2 rounded-card border-2 p-3",
              feedback === "correct" ? "" : "border-transparent bg-emerald-light/40",
              feedbackClasses(feedback),
            )}
          >
            {targetLetters.map((letter, index) => {
              const filled = index < placements.length;
              const isLastFilled = filled && index === placements.length - 1;
              const isNext = !filled && index === nextSlot;

              if (isLastFilled) {
                return (
                  <button
                    key={`slot-${word.id}-${index}`}
                    type="button"
                    onClick={handleRemoveLast}
                    aria-label={t("wordbuild.removeLetter")}
                    aria-disabled={locked ? true : undefined}
                    className={cn(
                      "tap-target flex min-h-[64px] min-w-[56px] items-center justify-center rounded-card border-2 border-emerald bg-emerald-light px-2 py-1 transition-transform",
                      locked ? "opacity-90" : "active:scale-95",
                    )}
                  >
                    <span lang="ar" className="arabic text-4xl leading-none text-emerald-dark md:text-6xl">
                      {letter}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={`slot-${word.id}-${index}`}
                  className={cn(
                    "flex min-h-[64px] min-w-[56px] items-center justify-center rounded-card border-2 px-2 py-1",
                    filled && "border-emerald bg-emerald-light",
                    !filled && "border-dashed border-slate-300 bg-white",
                    isNext && "ring-2 ring-gold",
                  )}
                >
                  {filled ? (
                    <span lang="ar" className="arabic text-4xl leading-none text-emerald-dark md:text-6xl">
                      {letter}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="text-2xl text-slate-300">
                      ·
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col items-center gap-3">
          <p className="text-center text-base font-bold text-emerald-dark">
            {t("wordbuild.meaning", { meaning })}
          </p>

          {audioUrl !== undefined ? (
            <button
              type="button"
              onClick={handlePlayAudio}
              aria-label={audioPlayed ? t("playAudioAgain") : t("playAudio")}
              className="tap-target inline-flex items-center justify-center gap-2 rounded-card border-2 border-emerald bg-white px-5 py-3 text-base font-bold text-emerald transition-transform active:scale-95"
            >
              <span aria-hidden="true">🔊</span>
              {audioPlayed ? t("playAudioAgain") : t("playAudio")}
            </button>
          ) : null}

          {audioFailed ? (
            <p role="status" className="text-center text-sm font-medium text-gold">
              {t("audioTapAgain")}
            </p>
          ) : null}
        </section>
        </div>

        <section className="flex flex-col gap-3">
          <h2 id="wordbuild-pool-label" className="text-sm font-bold text-emerald-dark md:text-base">
            {t("wordbuild.letterPool")}
          </h2>

          <div
            role="group"
            aria-labelledby="wordbuild-pool-label"
            className="flex flex-wrap justify-center gap-2"
          >
            {pool.map((entry, poolIndex) => {
              const used = usedPoolIndexes.has(poolIndex);
              const shaking = shakeIndex === poolIndex;

              return (
                <button
                  key={entry.key}
                  type="button"
                  lang="ar"
                  onClick={() => handleLetter(poolIndex)}
                  aria-label={entry.glyph}
                  aria-pressed={used}
                  aria-disabled={used || locked ? true : undefined}
                  className={cn(
                    "flex min-h-[64px] min-w-[64px] items-center justify-center rounded-card border-2 px-3 py-2 transition-transform md:min-h-[72px] md:min-w-[72px]",
                    used && "border-slate-200 bg-slate-100 opacity-50",
                    !used && !shaking && "border-emerald-light bg-white shadow-card active:scale-95",
                    !used && shaking && feedbackClasses("wrong"),
                  )}
                >
                  <span
                    className={cn(
                      "arabic text-3xl leading-none md:text-5xl",
                      used ? "text-slate-400" : "text-emerald-dark",
                    )}
                  >
                    {entry.glyph}
                  </span>
                </button>
              );
            })}
          </div>

          {/* The only action button in this game, so it belongs at the bottom
              of the letter column — inside thumb reach rather than up in the
              corner where a child has to stretch across the tablet for it. */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("clear")}
              aria-disabled={locked || placements.length === 0 ? true : undefined}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-card border-2 px-5 text-sm font-bold transition-transform md:text-base",
                locked || placements.length === 0
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : "border-emerald bg-white text-emerald active:scale-95",
              )}
            >
              {t("clear")}
            </button>
          </div>
        </section>
      </div>
    </GameShell>
  );
}

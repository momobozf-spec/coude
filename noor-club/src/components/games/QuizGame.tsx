"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameShell, feedbackClasses } from "@/components/games/GameShell";
import {
  seededShuffle,
  useElapsedSeconds,
  useFeedback,
  useOnce,
  type GameProps,
} from "@/components/games/types";
import { cn } from "@/lib/cn";
import type { QuizData } from "@/lib/game-schemas";
import { pickText } from "@/lib/i18n-json";
import { computeScore } from "@/lib/scoring";

const LETTERS = ["A", "B", "C", "D"] as const;

/** No i18n key under "games" means "next question", so the quiz advances itself. */
const ADVANCE_MS = 1000;
const ADVANCE_WITH_EXPLANATION_MS = 2600;

/**
 * Quiz payloads are localized prose, but a payload may still quote an Arabic term.
 * Code points are compared numerically so the source file stays pure ASCII.
 */
function hasArabic(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code >= 0x0600 && code <= 0x06ff) return true;
    if (code >= 0x0750 && code <= 0x077f) return true;
    if (code >= 0xfb50 && code <= 0xfdff) return true;
    if (code >= 0xfe70 && code <= 0xfeff) return true;
  }
  return false;
}

type PreparedOption = { text: Record<string, string>; originalIndex: number };

type PreparedQuestion = {
  id: string;
  question: Record<string, string>;
  explanation: Record<string, string> | undefined;
  correctIndex: number;
  options: PreparedOption[];
};

function letterFor(position: number): string {
  return LETTERS[position] ?? String(position + 1);
}

export function QuizGame({ data, locale, ageBand, onFinish }: GameProps<QuizData>) {
  const t = useTranslations("games");
  const finish = useOnce(onFinish);
  const elapsedSeconds = useElapsedSeconds();
  const { feedback, flash } = useFeedback();

  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questions = useMemo<PreparedQuestion[]>(() => {
    const first = data.questions[0];
    const seedBase = first === undefined ? "quiz" : first.id;

    return data.questions.map((question) => {
      // Belt-and-braces: the seed validates this, but a bad payload must not crash a child's screen.
      const inRange =
        Number.isInteger(question.correctIndex) &&
        question.correctIndex >= 0 &&
        question.correctIndex < question.options.length;

      const numbered: PreparedOption[] = question.options.map((text, originalIndex) => ({
        text,
        originalIndex,
      }));

      return {
        id: question.id,
        question: question.question,
        explanation: question.explanation,
        correctIndex: inRange ? question.correctIndex : 0,
        options: seededShuffle(numbered, `${seedBase}:${question.id}`),
      };
    });
  }, [data]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    };
  }, []);

  const total = questions.length;
  const current = questions[index];

  if (current === undefined) return null;

  const step = Math.min(index + 1, total);
  const progressLabel = t("question", { current: step, total });
  const questionText = pickText(current.question, locale);
  const explanationText =
    current.explanation === undefined ? "" : pickText(current.explanation, locale);
  const statusText = solved ? t("correct") : wrongPicks.length > 0 ? t("wrong") : "";

  function goToNextQuestion() {
    advanceTimer.current = null;
    setIndex((previous) => previous + 1);
    setSolved(false);
    setWrongPicks([]);
    setFlashIndex(null);
  }

  function handleAnswer(originalIndex: number) {
    if (current === undefined) return;
    if (solved) return;
    if (wrongPicks.includes(originalIndex)) return;

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setFlashIndex(originalIndex);

    if (originalIndex !== current.correctIndex) {
      setWrongPicks((previous) => [...previous, originalIndex]);
      flash("wrong");
      return;
    }

    const nextCorrect = correctCount + 1;
    setSolved(true);
    setCorrectCount(nextCorrect);
    flash("correct");

    if (index >= total - 1) {
      finish(
        computeScore({ correct: nextCorrect, total, attempts: nextAttempts, ageBand }),
        elapsedSeconds(),
      );
      return;
    }

    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(
      goToNextQuestion,
      explanationText === "" ? ADVANCE_MS : ADVANCE_WITH_EXPLANATION_MS,
    );
  }

  return (
    <GameShell
      prompt={t("quiz.chooseOne")}
      step={step}
      total={total}
      progressLabel={progressLabel}
    >
      {/* The question sits in the upper half and the answers in the lower half,
          which on a tablet is the part a child can actually reach. */}
      <div className="flex flex-col gap-4 md:min-h-[420px] md:justify-between md:gap-8">
        <h2
          className={cn(
            "font-bold leading-snug text-emerald-dark",
            hasArabic(questionText)
              ? "arabic text-3xl leading-relaxed md:text-5xl"
              : "text-2xl md:text-4xl",
          )}
        >
          {questionText}
        </h2>

        {solved && explanationText !== "" ? (
          <div className="animate-pop-in rounded-card border-2 border-gold bg-gold-light p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-dark">
              {t("quiz.explanation")}
            </p>
            <p className="mt-1 text-base leading-relaxed text-slate-800">{explanationText}</p>
          </div>
        ) : null}

        {/* Four options become a 2x2 grid on a tablet; two or three stay stacked
            so a lone option never stretches across the whole board. */}
        <ul
          className={cn(
            "grid list-none gap-3 p-0 md:gap-5",
            current.options.length === 4 ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {current.options.map((option, position) => {
            const optionText = pickText(option.text, locale);
            const letter = letterFor(position);
            const isCorrectOption = option.originalIndex === current.correctIndex;
            const isWrongPick = wrongPicks.includes(option.originalIndex);
            const isChosen = isWrongPick || (solved && isCorrectOption);
            const isLocked = solved || isWrongPick;
            // While a card flashes, its resting colours are dropped so the pulse/shake
            // background is never fighting an equally specific utility class.
            const isFlashing = flashIndex === option.originalIndex && feedback !== "idle";

            return (
              <li key={`${current.id}-${option.originalIndex}`} className="flex">
                <button
                  type="button"
                  onClick={() => handleAnswer(option.originalIndex)}
                  aria-label={`${letter}. ${optionText}`}
                  aria-pressed={isChosen}
                  aria-disabled={isLocked}
                  className={cn(
                    "tap-target flex w-full items-center gap-3 rounded-card border-2 px-3 py-3 text-left transition-colors md:gap-4 md:px-5 md:py-5",
                    isFlashing && "text-slate-800",
                    isFlashing && feedbackClasses(feedback),
                    !isFlashing &&
                      solved &&
                      isCorrectOption &&
                      "border-emerald bg-emerald-light text-emerald-dark",
                    !isFlashing &&
                      solved &&
                      !isCorrectOption &&
                      "border-slate-200 bg-white text-slate-500 opacity-50",
                    !isFlashing &&
                      !solved &&
                      isWrongPick &&
                      "border-red-300 bg-red-50 text-slate-500 opacity-60",
                    !isFlashing &&
                      !solved &&
                      !isWrongPick &&
                      "border-slate-200 bg-white text-slate-800 hover:border-emerald",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold md:h-14 md:w-14 md:text-xl",
                      solved && isCorrectOption
                        ? "bg-emerald text-white"
                        : "bg-emerald-light text-emerald-dark",
                    )}
                  >
                    {letter}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 font-bold",
                      hasArabic(optionText)
                        ? "arabic text-3xl leading-relaxed md:text-5xl"
                        : "text-lg leading-snug md:text-2xl",
                    )}
                  >
                    {optionText}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-[24px] text-sm font-bold",
            solved ? "text-emerald" : "text-red-600",
          )}
        >
          {statusText}
        </p>
      </div>
    </GameShell>
  );
}

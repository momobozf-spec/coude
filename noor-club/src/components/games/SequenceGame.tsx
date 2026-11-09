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
import type { SequenceData } from "@/lib/game-schemas";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/i18n-json";
import { computeScore } from "@/lib/scoring";

type SequenceItem = SequenceData["items"][number];

/**
 * Progressive placement: only the next slot in the row can be filled, so a
 * four-year-old never has to hold the whole sequence in their head at once.
 * Tapping a card is one full move; the select-then-place path exists on top of
 * it for children who want to aim at the slot itself.
 */
export function SequenceGame({ data, locale, ageBand, onFinish }: GameProps<SequenceData>) {
  const t = useTranslations("games");
  const finish = useOnce(onFinish);
  const elapsedSeconds = useElapsedSeconds();
  const { feedback, flash } = useFeedback();

  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Attempts never render, so a ref keeps the count exact at finish time.
  const attempts = useRef(0);

  const ordered = useMemo(
    () => [...data.items].sort((a, b) => a.order - b.order),
    [data.items],
  );

  const byId = useMemo(
    () => new Map<string, SequenceItem>(data.items.map((item) => [item.id, item])),
    [data.items],
  );

  const firstItem = data.items[0];
  const seed = firstItem === undefined ? "sequence" : firstItem.id;

  const shuffled = useMemo(() => seededShuffle(data.items, seed), [data.items, seed]);
  const pool = useMemo(
    () => shuffled.filter((item) => !placedIds.includes(item.id)),
    [shuffled, placedIds],
  );

  const total = ordered.length;
  const filled = placedIds.length;
  const done = total > 0 && filled >= total;

  useEffect(() => {
    if (total <= 0 || filled < total) return;
    const score = computeScore({
      correct: total,
      total,
      attempts: attempts.current,
      ageBand,
    });
    finish(score, elapsedSeconds());
  }, [filled, total, ageBand, finish, elapsedSeconds]);

  function attemptPlace(item: SequenceItem) {
    const expected = ordered[filled];
    if (done || expected === undefined) return;

    attempts.current += 1;
    setFlashId(item.id);

    if (expected.id === item.id) {
      setPlacedIds((previous) =>
        previous.includes(item.id) ? previous : [...previous, item.id],
      );
      setSelectedId(null);
      flash("correct");
      return;
    }

    // Keep the wrong card selected: the slot stays a valid second route.
    setSelectedId(item.id);
    flash("wrong");
  }

  function handleCard(item: SequenceItem) {
    if (selectedId === item.id) {
      setSelectedId(null);
      return;
    }
    attemptPlace(item);
  }

  function handleNextSlot() {
    if (selectedId === null) return;
    const item = byId.get(selectedId);
    if (item === undefined) return;
    attemptPlace(item);
  }

  const prompt = pickText(data.prompt, locale);
  const progressLabel = t("step", { current: filled, total });
  const targetHint = selectedId === null ? t("sequence.empty") : t("selectTarget");

  let announcement = "";
  if (feedback === "correct") announcement = t("correct");
  if (feedback === "wrong") announcement = t("wrong");

  // Up to five steps fit side by side on a landscape tablet; beyond that the
  // row would squeeze each label into an unreadable column, so it stays a list.
  const rowSlots = total <= 5;

  return (
    <GameShell prompt={prompt} step={filled} total={total} progressLabel={progressLabel}>
      <div className="flex flex-col gap-5 md:gap-7">
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>

        <ol
          className={cn(
            "flex flex-col gap-2 md:gap-4",
            rowSlots && "lg:flex-row lg:items-stretch",
          )}
        >
          {ordered.map((_slot, index) => {
            const positionLabel = t("sequence.position", { index: index + 1 });
            const placedId = placedIds[index];
            const placedItem = placedId === undefined ? undefined : byId.get(placedId);
            const isNext = !done && index === filled;

            return (
              <li key={`slot-${index}`} className={cn(rowSlots && "lg:flex-1")}>
                {placedItem !== undefined ? (
                  <div
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-card border-2 border-emerald bg-emerald-light px-3 py-2 md:min-h-[72px]",
                      // In the row layout the number belongs under the label:
                      // column-reverse flips the DOM order into exactly that.
                      rowSlots &&
                        "lg:h-full lg:flex-col-reverse lg:justify-center lg:gap-2 lg:py-4 lg:text-center",
                      flashId === placedItem.id &&
                        feedback === "correct" &&
                        feedbackClasses(feedback),
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald text-sm font-bold text-white md:h-11 md:w-11 md:text-lg"
                    >
                      {index + 1}
                    </span>
                    <span className="sr-only">{positionLabel}</span>
                    <span
                      key={placedItem.id}
                      className="flex animate-pop-in items-center gap-2 text-base font-bold text-emerald-dark md:text-xl"
                    >
                      {placedItem.iconUrl !== undefined ? (
                        <img
                          src={placedItem.iconUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 object-contain"
                        />
                      ) : null}
                      {pickText(placedItem.label, locale)}
                    </span>
                  </div>
                ) : isNext ? (
                  <button
                    type="button"
                    onClick={handleNextSlot}
                    aria-disabled={selectedId === null}
                    aria-label={`${positionLabel}. ${targetHint}`}
                    className={cn(
                      "tap-target flex min-h-[56px] w-full items-center gap-3 rounded-card border-2 border-dashed border-gold bg-gold-light px-3 py-2 text-left ring-2 ring-gold md:min-h-[72px]",
                      rowSlots &&
                        "lg:h-full lg:flex-col-reverse lg:justify-center lg:gap-2 lg:py-4 lg:text-center",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-white"
                    >
                      {index + 1}
                    </span>
                    <span aria-hidden="true" className="text-sm font-bold text-emerald-dark">
                      {targetHint}
                    </span>
                  </button>
                ) : (
                  <div
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-card border-2 border-dashed border-slate-300 bg-white px-3 py-2 md:min-h-[72px]",
                      rowSlots &&
                        "lg:h-full lg:flex-col-reverse lg:justify-center lg:gap-2 lg:py-4 lg:text-center",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
                    >
                      {index + 1}
                    </span>
                    <span className="sr-only">{positionLabel}</span>
                    <span className="text-sm font-semibold text-slate-400">
                      {t("sequence.empty")}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {pool.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-5">
            {pool.map((item) => {
              const isSelected = selectedId === item.id;
              const isFlashing = flashId === item.id && feedback !== "idle";

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleCard(item)}
                    aria-pressed={isSelected}
                    aria-label={pickText(item.label, locale)}
                    className={cn(
                      "tap-target flex min-h-[64px] w-full items-center gap-3 rounded-card border-2 border-slate-200 bg-white px-4 py-3 text-left text-lg font-bold text-emerald-dark shadow-card transition-transform md:min-h-[88px] md:px-5 md:text-2xl",
                      isSelected && "scale-[1.03] border-emerald ring-2 ring-emerald",
                      isFlashing && feedbackClasses(feedback),
                    )}
                  >
                    {item.iconUrl !== undefined ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 object-contain"
                      />
                    ) : null}
                    <span>{pickText(item.label, locale)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="text-center text-sm font-semibold text-slate-500">
          {done ? t("wellDone") : t("sequence.hintTap")}
        </p>
      </div>
    </GameShell>
  );
}

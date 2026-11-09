"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { GameShell, feedbackClasses } from "@/components/games/GameShell";
import {
  seededShuffle,
  useElapsedSeconds,
  useFeedback,
  useOnce,
  type GameProps,
} from "@/components/games/types";
import type { MatchData } from "@/lib/game-schemas";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/i18n-json";
import { computeScore } from "@/lib/scoring";
import { play, unlockAudio } from "@/lib/audio";

/** NonNullable keeps this correct whatever `noUncheckedIndexedAccess` does to the lookup. */
type MatchPair = NonNullable<MatchData["pairs"][number]>;

type FlashTarget = { id: string; side: "left" | "right" | "both" };

type DragState = { pairId: string; x: number; y: number; overId: string | null };

type PointerTrack = {
  pairId: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

/** Under this distance a pointer gesture is a tap, above it a drag. */
const TAP_SLOP_PX = 8;

/** Hit-test for the drag path; the ghost is pointer-events-none so it never wins. */
function meaningIdAtPoint(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  if (element === null) return null;
  const holder = element.closest("[data-meaning-id]");
  if (holder === null) return null;
  return holder.getAttribute("data-meaning-id");
}

export function MatchGame({ data, locale, ageBand, onFinish }: GameProps<MatchData>) {
  const t = useTranslations("games");
  const headingId = useId();
  const finish = useOnce(onFinish);
  const elapsed = useElapsedSeconds();
  const { feedback, flash } = useFeedback();

  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [flashTarget, setFlashTarget] = useState<FlashTarget | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);

  const pointerTrack = useRef<PointerTrack | null>(null);
  // A drag ends with a synthetic click on the source; swallow that one click.
  const swallowClick = useRef(false);

  const total = data.pairs.length;
  const solved = lockedIds.length;
  const allDone = total > 0 && solved >= total;

  const seed = data.pairs[0]?.id ?? "match";
  const meaningCards = useMemo(() => seededShuffle(data.pairs, seed), [data.pairs, seed]);

  useEffect(() => {
    if (total === 0 || solved < total) return;
    finish(computeScore({ correct: solved, total, attempts, ageBand }), elapsed());
  }, [solved, total, attempts, ageBand, finish, elapsed]);

  function cardFeedback(pairId: string, side: "left" | "right"): string {
    if (feedback === "idle" || flashTarget === null) return "";
    if (flashTarget.id !== pairId) return "";
    if (flashTarget.side !== "both" && flashTarget.side !== side) return "";
    return feedbackClasses(feedback);
  }

  /** The single answer path: both the tap flow and the drag flow end up here. */
  function resolve(sourceId: string, targetId: string): void {
    if (lockedIds.includes(sourceId) || lockedIds.includes(targetId)) return;

    setAttempts((count) => count + 1);

    if (sourceId === targetId) {
      setFlashTarget({ id: sourceId, side: "both" });
      flash("correct");
      setSelectedId(null);
      setLockedIds((current) => (current.includes(sourceId) ? current : [...current, sourceId]));
      return;
    }

    setFlashTarget({ id: targetId, side: "right" });
    flash("wrong");
    setSelectedId(sourceId);
  }

  function handleSourceClick(pairId: string, isLocked: boolean): void {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (isLocked) return;
    setSelectedId((current) => (current === pairId ? null : pairId));
  }

  function handleTargetClick(pairId: string, isLocked: boolean): void {
    if (isLocked || selectedId === null) return;
    resolve(selectedId, pairId);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    pairId: string,
    isLocked: boolean,
  ): void {
    swallowClick.current = false;
    if (isLocked) return;

    pointerTrack.current = {
      pairId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    const track = pointerTrack.current;
    if (track === null || track.pointerId !== event.pointerId) return;

    const dx = event.clientX - track.startX;
    const dy = event.clientY - track.startY;
    if (!track.moved && Math.sqrt(dx * dx + dy * dy) < TAP_SLOP_PX) return;

    track.moved = true;
    setDrag({
      pairId: track.pairId,
      x: event.clientX,
      y: event.clientY,
      overId: meaningIdAtPoint(event.clientX, event.clientY),
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>): void {
    const track = pointerTrack.current;
    if (track === null || track.pointerId !== event.pointerId) return;

    pointerTrack.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // A tap falls through to onClick so keyboard and pointer share one code path.
    if (!track.moved) return;

    swallowClick.current = true;
    const targetId = meaningIdAtPoint(event.clientX, event.clientY);
    if (targetId === null) return;
    resolve(track.pairId, targetId);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>): void {
    const track = pointerTrack.current;
    if (track === null || track.pointerId !== event.pointerId) return;
    pointerTrack.current = null;
    setDrag(null);
  }

  function playClip(url: string): void {
    // Called straight from the button's onClick, which is the user gesture iOS
    // needs before it will let any audio through.
    unlockAudio();
    void play(url).then((ok) => setAudioFailed(!ok));
  }

  const dragPair: MatchPair | undefined =
    drag === null ? undefined : data.pairs.find((pair) => pair.id === drag.pairId);

  return (
    <GameShell
      prompt={t("match.prompt")}
      step={solved}
      total={total}
      progressLabel={t("step", { current: solved, total })}
    >
      <p
        className="mb-4 text-center text-sm font-bold text-emerald-dark"
        aria-live="polite"
        role="status"
      >
        {allDone ? t("wellDone") : selectedId === null ? t("selectSource") : t("selectTarget")}
      </p>

      {/* Two columns throughout — on a tablet the cards get taller and the gap
          wider, rather than the board splitting into three or four columns. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-8">
        <section aria-labelledby={`${headingId}-left`} className="flex flex-col gap-2">
          <h3
            id={`${headingId}-left`}
            className="text-xs font-bold uppercase tracking-wide text-emerald md:text-sm"
          >
            {t("match.leftHeading")}
          </h3>
          <ul className="flex flex-col gap-2 md:gap-4">
            {data.pairs.map((pair) => {
              const isLocked = lockedIds.includes(pair.id);
              const isSelected = selectedId === pair.id;
              const meaning = pickText(pair.right, locale);
              const heading = t("match.leftHeading");

              return (
                <li key={pair.id}>
                  <div
                    className={cn(
                      "flex items-stretch rounded-card border-2 transition-transform md:min-h-[88px]",
                      isLocked ? "border-emerald bg-emerald-light" : "border-slate-200 bg-white",
                      isSelected && "scale-[1.02] border-gold ring-2 ring-gold ring-offset-2",
                      cardFeedback(pair.id, "left"),
                    )}
                  >
                    <button
                      type="button"
                      className="drag-item tap-target flex flex-1 flex-col items-center justify-center gap-1 rounded-card px-3 py-3 text-center"
                      aria-pressed={isSelected}
                      aria-disabled={isLocked}
                      aria-label={
                        isLocked
                          ? `${heading}: ${pair.left}. ${meaning}. ${t("match.placed")}`
                          : `${heading}: ${pair.left}`
                      }
                      onClick={() => handleSourceClick(pair.id, isLocked)}
                      onPointerDown={(event) => handlePointerDown(event, pair.id, isLocked)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                    >
                      <span
                        className="arabic text-3xl leading-loose text-emerald-dark sm:text-4xl md:text-5xl"
                        lang="ar"
                      >
                        {pair.left}
                      </span>
                      {isLocked ? (
                        <span className="animate-pop-in flex flex-col items-center gap-0.5">
                          <span className="text-sm font-semibold text-slate-700">{meaning}</span>
                          <span className="text-xs font-bold text-emerald">
                            <span aria-hidden="true">✓ </span>
                            {t("match.placed")}
                          </span>
                        </span>
                      ) : null}
                    </button>

                    {pair.audioUrl !== undefined ? (
                      <button
                        type="button"
                        className="tap-target m-1 flex shrink-0 items-center justify-center rounded-card border-2 border-gold bg-gold-light text-xl"
                        aria-label={t("playAudio")}
                        onClick={(event) => {
                          event.stopPropagation();
                          playClip(pair.audioUrl ?? "");
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <span aria-hidden="true">🔊</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby={`${headingId}-right`} className="flex flex-col gap-2">
          <h3
            id={`${headingId}-right`}
            className="text-xs font-bold uppercase tracking-wide text-emerald md:text-sm"
          >
            {t("match.rightHeading")}
          </h3>
          <ul className="flex flex-col gap-2 md:gap-4">
            {meaningCards.map((pair) => {
              const isLocked = lockedIds.includes(pair.id);
              const isOver = drag !== null && drag.overId === pair.id;
              const meaning = pickText(pair.right, locale);
              const heading = t("match.rightHeading");

              return (
                <li key={pair.id}>
                  <button
                    type="button"
                    data-meaning-id={pair.id}
                    className={cn(
                      "tap-target flex w-full items-center justify-between gap-2 rounded-card border-2 px-4 py-3 text-left text-lg font-semibold md:min-h-[88px] md:px-5 md:text-2xl",
                      isLocked
                        ? "border-emerald bg-emerald-light text-emerald-dark"
                        : "border-slate-200 bg-white text-slate-800",
                      isOver && !isLocked && "scale-[1.02] border-gold ring-2 ring-gold",
                      cardFeedback(pair.id, "right"),
                    )}
                    aria-disabled={isLocked}
                    aria-label={
                      isLocked
                        ? `${heading}: ${meaning}. ${t("match.placed")}`
                        : `${heading}: ${meaning}`
                    }
                    onClick={() => handleTargetClick(pair.id, isLocked)}
                  >
                    <span>{meaning}</span>
                    {isLocked ? (
                      <span className="animate-pop-in shrink-0 text-xs font-bold text-emerald">
                        <span aria-hidden="true">✓ </span>
                        {t("match.placed")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {audioFailed ? (
        <p role="status" className="mt-4 text-center text-sm font-semibold text-gold">
          {t("audioTapAgain")}
        </p>
      ) : null}

      {drag !== null && dragPair !== undefined ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-card border-2 border-gold bg-white px-4 py-2 shadow-lift"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <span className="arabic text-3xl text-emerald-dark" lang="ar">
            {dragPair.left}
          </span>
        </div>
      ) : null}
    </GameShell>
  );
}

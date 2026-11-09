"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared sizing tokens for the play surface.
 *
 * The rule on a tablet is to *bound* the board and let the pieces grow into it,
 * not to stretch a phone layout across 1366px and leave a child poking at
 * thumbnail-sized cards in the middle of an empty screen.
 */
export const GAME_TOKENS = {
  /** The board itself. Grows in steps, never edge to edge. */
  surface: "w-full max-w-[560px] md:max-w-[720px] lg:max-w-[880px] mx-auto",
  /** 56px is the floor for a child's finger; 72px once there is room. */
  touch: "min-h-[56px] min-w-[56px] md:min-h-[72px] md:min-w-[72px]",
  /** Body text inside a game. */
  text: "text-lg md:text-2xl",
  /** Arabic needs to be bigger than Latin to stay readable. */
  arabic: "text-3xl md:text-5xl",
  /** Spacing between pieces. */
  gap: "gap-3 md:gap-5",
} as const;

type GameShellProps = {
  /** Localized instruction shown above the board. */
  prompt: string;
  /** 1-based index of the current step, for the progress pill. */
  step: number;
  total: number;
  progressLabel: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared chrome for all five engines: prompt, progress, board area.
 * Keeps every game visually identical so a child recognises the layout
 * instantly, while each engine owns only its own interaction logic.
 */
export function GameShell({
  prompt,
  step,
  total,
  progressLabel,
  children,
  footer,
}: GameShellProps) {
  const percent = total > 0 ? Math.min(100, Math.round((step / total) * 100)) : 0;

  return (
    <section className={cn("flex flex-col gap-4 md:gap-6", GAME_TOKENS.surface)}>
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-bold leading-snug text-emerald-dark sm:text-lg md:text-xl">
            {prompt}
          </p>
          <span
            className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-bold text-emerald shadow-card md:px-4 md:py-1.5 md:text-base"
            aria-label={progressLabel}
          >
            {step}/{total}
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white md:h-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={step}
          aria-label={progressLabel}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      {/* `game-surface` lives here rather than being repeated in each engine:
          GameShell wraps the board of all five and nothing else, so this is
          exactly the five play surfaces and no other element in the app. */}
      <div className="card game-surface md:p-7">{children}</div>

      {footer ? <footer className="flex justify-center">{footer}</footer> : null}
    </section>
  );
}

/**
 * Visual state helper shared by the engines so "green pulse / red shake" looks
 * and times identically everywhere.
 */
export function feedbackClasses(state: "idle" | "correct" | "wrong"): string {
  return cn(
    state === "correct" && "animate-pulse-ok border-emerald bg-emerald-light",
    state === "wrong" && "animate-shake-bad border-red-400 bg-red-50",
  );
}

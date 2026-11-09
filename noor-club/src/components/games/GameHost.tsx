"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import {
  checkGameInvariants,
  parseGameData,
  type ParsedGameData,
} from "@/lib/game-schemas";
import { preload, unlockAudio } from "@/lib/audio";
import type { AgeBand } from "@/lib/validators";
import { noteGameStarted, recordPlay, type RecordPlayResult } from "@/actions/play";
import { MatchGame } from "@/components/games/MatchGame";
import { SequenceGame } from "@/components/games/SequenceGame";
import { QuizGame } from "@/components/games/QuizGame";
import { ListenGame } from "@/components/games/ListenGame";
import { WordBuildGame } from "@/components/games/WordBuildGame";
import { RewardOverlay } from "@/components/games/RewardOverlay";

type GameHostProps = {
  gameSlug: string;
  engine: string;
  rawData: unknown;
  locale: string;
  ageBand: AgeBand;
  childId: string;
  packSlug: string;
};

/** Every clip this game will ever need, so it can all be decoded up front. */
function audioUrlsFor(parsed: ParsedGameData): string[] {
  if (!parsed.ok) return [];

  const defined = (value: string | undefined): value is string => value !== undefined;

  switch (parsed.engine) {
    case "MATCH":
      return parsed.data.pairs.map((pair) => pair.audioUrl).filter(defined);
    case "LISTEN":
      return parsed.data.rounds.map((round) => round.audioUrl);
    case "WORDBUILD":
      return parsed.data.words.map((word) => word.audioUrl).filter(defined);
    case "QUIZ":
    case "SEQUENCE":
      return [];
  }
}

/**
 * Does three things and nothing more: validate the payload, pick the engine,
 * and turn `onFinish` into a `recordPlay` call plus a reward screen.
 *
 * Adding a sixth engine means one case in the switch below. Adding a hundred
 * new *games* means zero code — they are rows in the database.
 */
export function GameHost({
  gameSlug,
  engine,
  rawData,
  locale,
  ageBand,
  childId,
  packSlug,
}: GameHostProps) {
  const t = useTranslations("games");
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<RecordPlayResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseGameData(engine, rawData), [engine, rawData]);
  const invariant = useMemo(() => checkGameInvariants(parsed), [parsed]);
  const audioUrls = useMemo(() => audioUrlsFor(parsed), [parsed]);

  const handleFinish = useCallback(
    (nextScore: number, durationSec: number) => {
      setScore(nextScore);
      setFinished(true);
      setResult(null);

      startTransition(async () => {
        const outcome = await recordPlay({
          childId,
          gameSlug,
          score: nextScore,
          durationSec,
          locale,
        });
        setResult(outcome);
        // Pull fresh XP, streak and badges into the surrounding server
        // components without a full page reload.
        router.refresh();
      });
    },
    [childId, gameSlug, locale, router],
  );

  const playAgain = useCallback(() => {
    setFinished(false);
    setResult(null);
    setScore(0);
    // Remounts the engine, which resets all of its internal state.
    setAttempt((value) => value + 1);
  }, []);

  const beginGame = useCallback(() => {
    // Must run inside the gesture itself, which is why it is not in an effect.
    unlockAudio();
    setStarted(true);
    void preload(audioUrls);
    void noteGameStarted({ childId, gameSlug });
  }, [audioUrls, childId, gameSlug]);

  if (!parsed.ok || invariant !== null) {
    const reason = parsed.ok ? invariant : parsed.issue;
    return (
      <div className="mx-auto max-w-md rounded-card bg-white p-6 text-center shadow-card">
        <p className="text-4xl" aria-hidden="true">
          🧩
        </p>
        <h2 className="mt-2 text-lg font-extrabold text-emerald-dark">
          {t("invalidTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t("invalidBody")}</p>
        {process.env.NODE_ENV === "development" && reason ? (
          <p className="mt-3 rounded-2xl bg-slate-100 px-3 py-2 text-left text-xs text-slate-600">
            {reason}
          </p>
        ) : null}
      </div>
    );
  }

  // The start screen exists for one technical reason: iOS only lets audio play
  // after a real user gesture, and `unlockAudio()` has to run inside one. It
  // doubles as a moment to decode the clips before the first round.
  if (!started) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 rounded-card bg-white p-8 text-center shadow-card md:max-w-[720px] md:p-12">
        <p className="text-6xl md:text-7xl" aria-hidden="true">
          🎲
        </p>
        <button
          type="button"
          onPointerDown={unlockAudio}
          onClick={beginGame}
          className="min-h-[64px] w-full max-w-xs rounded-full bg-emerald px-8 text-xl font-extrabold text-white shadow-card transition-colors hover:bg-emerald-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald focus-visible:ring-offset-2 active:bg-emerald-dark md:min-h-[76px] md:text-2xl"
        >
          {t("start")}
        </button>
      </div>
    );
  }

  const common = { locale, ageBand, onFinish: handleFinish };

  return (
    <>
      <div key={attempt}>
        {parsed.engine === "MATCH" ? <MatchGame data={parsed.data} {...common} /> : null}
        {parsed.engine === "SEQUENCE" ? (
          <SequenceGame data={parsed.data} {...common} />
        ) : null}
        {parsed.engine === "QUIZ" ? <QuizGame data={parsed.data} {...common} /> : null}
        {parsed.engine === "LISTEN" ? (
          <ListenGame data={parsed.data} {...common} />
        ) : null}
        {parsed.engine === "WORDBUILD" ? (
          <WordBuildGame data={parsed.data} {...common} />
        ) : null}
      </div>

      {finished ? (
        <RewardOverlay
          score={score}
          result={result}
          pending={isPending}
          childId={childId}
          packSlug={packSlug}
          onPlayAgain={playAgain}
        />
      ) : null}
    </>
  );
}

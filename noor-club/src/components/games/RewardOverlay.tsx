"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import type { RecordPlayResult } from "@/actions/play";

/**
 * Shown only once the game is over, so a full-screen celebration is fine here —
 * the "never block the child" rule applies to in-game feedback, not to the
 * end-of-game reward.
 */
export function RewardOverlay({
  score,
  result,
  pending,
  childId,
  packSlug,
  onPlayAgain,
}: {
  score: number;
  result: RecordPlayResult | null;
  pending: boolean;
  childId: string;
  packSlug: string;
  onPlayAgain: () => void;
}) {
  const t = useTranslations("games");
  const tRoot = useTranslations();
  const great = score >= 80;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-emerald-dark/60 p-4 sm:items-center">
      {/* The buttons sit at the bottom of the sheet, which on a notched iPhone
          is exactly where the home indicator lives. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        className="w-full max-w-md animate-pop-in rounded-card bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center shadow-lift sm:pb-6 md:max-w-lg"
      >
        <p className="text-5xl" aria-hidden="true">
          {great ? "🌟" : "👏"}
        </p>

        <h2 id="reward-title" className="mt-2 text-2xl font-extrabold text-emerald-dark">
          {great ? t("wellDone") : t("goodTry")}
        </h2>

        <p className="mt-1 text-lg font-bold text-slate-700">
          {t("yourScore", { score })}
        </p>

        {pending ? (
          <p className="mt-4 text-sm font-semibold text-slate-500">{t("saving")}</p>
        ) : null}

        {result?.error ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <p>{t("saveErrorTitle")}</p>
            <p className="mt-1 font-normal">{tRoot(result.error)}</p>
          </div>
        ) : null}

        {!pending && result && !result.error ? (
          <div className="mt-4 space-y-3">
            {typeof result.xpGained === "number" ? (
              <p className="rounded-full bg-gold-light px-4 py-2 text-lg font-extrabold text-gold">
                {t("xpEarned", { xp: result.xpGained })}
              </p>
            ) : null}

            {result.levelUp && typeof result.level === "number" ? (
              <div className="rounded-2xl bg-emerald-light px-4 py-3">
                <p className="font-extrabold text-emerald-dark">{t("levelUp")}</p>
                <p className="text-sm text-emerald-dark">
                  {t("levelUpBody", { level: result.level })}
                </p>
              </div>
            ) : null}

            {result.newBadge ? (
              <div className="rounded-2xl bg-gold-light px-4 py-3">
                <p className="text-3xl" aria-hidden="true">
                  🏅
                </p>
                <p className="font-extrabold text-gold">{t("newBadge")}</p>
                <p className="text-sm font-semibold text-slate-700">
                  {result.newBadge.title}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={onPlayAgain} disabled={pending}>
            {t("playAgain")}
          </Button>

          <Link
            href={`/pakket/${packSlug}?kind=${childId}`}
            className={buttonClasses("secondary", "md")}
          >
            {t("backToPack")}
          </Link>

          <Link
            href={`/paspoort/${childId}`}
            className={buttonClasses("ghost", "md")}
          >
            {t("toPassport")}
          </Link>
        </div>
      </div>
    </div>
  );
}

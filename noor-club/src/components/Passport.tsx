import { getTranslations } from "next-intl/server";
import { AvatarBubble } from "@/components/ui/AvatarBubble";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrintButton } from "@/components/ui/PrintButton";
import { EmptyState } from "@/components/ui/StatTile";
import { levelFor } from "@/lib/xp";
import { cn } from "@/lib/cn";

export type PassportBadge = {
  id: string;
  title: string;
  iconUrl: string;
  packTitle: string;
  earnedAt: Date | null;
};

/**
 * The screen parents put on the fridge. Everything outside the sheet carries
 * `no-print`, and the sheet itself is laid out to survive an A4 print — see the
 * `@media print` block in globals.css.
 */
export async function Passport({
  child,
  badges,
  locale,
}: {
  child: { name: string; avatar: string; xp: number; streak: number };
  badges: PassportBadge[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "passport" });
  const { level, progress } = levelFor(child.xp);

  const earnedCount = badges.filter((badge) => badge.earnedAt !== null).length;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-emerald-dark sm:text-3xl">
          {t("title", { name: child.name })}
        </h1>
        <PrintButton label={t("print")} />
      </div>

      <div className="print-sheet rounded-card bg-white p-6 shadow-card">
        <header className="flex flex-wrap items-center gap-4 border-b border-emerald-light pb-5">
          <AvatarBubble avatar={child.avatar} name={child.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold text-emerald-dark">{child.name}</p>
            <p className="text-sm text-slate-600">
              {t("level", { level })} · {t("xp", { xp: child.xp })} ·{" "}
              {t("streak", { count: child.streak })}
            </p>
            <p className="mt-1 text-sm font-bold text-gold">
              {t("badgesEarned", { count: earnedCount })}
            </p>
          </div>
        </header>

        <div className="mt-4">
          <ProgressBar value={progress} label={t("level", { level })} />
        </div>

        <p className="mt-5 text-sm text-slate-600">{t("subtitle")}</p>

        {badges.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          </div>
        ) : (
          <ul className="print-grid mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {badges.map((badge) => {
              const earned = badge.earnedAt !== null;

              return (
                <li
                  key={badge.id}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border-2 p-3 text-center",
                    earned
                      ? "border-gold bg-gold-light"
                      : "border-dashed border-slate-200 bg-slate-50",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badge.iconUrl}
                    alt=""
                    width={72}
                    height={72}
                    className={cn("h-16 w-16", !earned && "opacity-25 grayscale")}
                  />
                  <p
                    className={cn(
                      "mt-2 text-sm font-extrabold leading-tight",
                      earned ? "text-emerald-dark" : "text-slate-400",
                    )}
                  >
                    {badge.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    {badge.packTitle}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {earned && badge.earnedAt
                      ? t("earnedOn", { date: dateFormat.format(badge.earnedAt) })
                      : t("notEarned")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="mt-6 border-t border-emerald-light pt-3 text-xs text-slate-400">
          Noor Club · {t("printedOn", { date: dateFormat.format(new Date()) })}
        </footer>
      </div>
    </div>
  );
}

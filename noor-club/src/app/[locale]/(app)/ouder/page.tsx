import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/entitlement";
import { localize } from "@/lib/i18n-json";
import { levelFor } from "@/lib/xp";
import { AvatarBubble } from "@/components/ui/AvatarBubble";
import { Card, SectionHeading } from "@/components/ui/Card";
import { EmptyState, StatTile } from "@/components/ui/StatTile";
import { buttonClasses } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function ParentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const t = await getTranslations({ locale, namespace: "parent" });
  const tChildren = await getTranslations({ locale, namespace: "children" });

  const children = await db.child.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      avatar: true,
      xp: true,
      streak: true,
      lastPlay: true,
      _count: { select: { badges: true } },
    },
  });

  const childIds = children.map((child) => child.id);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [monthStats, recent] = await Promise.all([
    childIds.length === 0
      ? Promise.resolve([])
      : db.gamePlay.groupBy({
          by: ["childId"],
          where: { childId: { in: childIds }, createdAt: { gte: monthStart } },
          _count: { _all: true },
          _sum: { durationSec: true },
          _avg: { score: true },
        }),
    childIds.length === 0
      ? Promise.resolve([])
      : db.gamePlay.findMany({
          where: { childId: { in: childIds } },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: {
            id: true,
            score: true,
            durationSec: true,
            createdAt: true,
            child: { select: { id: true, name: true, avatar: true } },
            game: { select: { slug: true, titles: true } },
          },
        }),
  ]);

  const statsByChild = new Map(monthStats.map((row) => [row.childId, row]));
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />

      {children.length === 0 ? (
        <EmptyState
          title={t("noChildren")}
          body={tChildren("emptyBody")}
          action={
            <Link href="/kinderen" className={buttonClasses("primary", "md")}>
              {tChildren("add")}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {children.map((child) => {
              const stats = statsByChild.get(child.id);
              const plays = stats?._count._all ?? 0;
              const seconds = stats?._sum.durationSec ?? 0;
              const average = stats?._avg.score ?? null;
              const { level } = levelFor(child.xp);

              return (
                <li key={child.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <AvatarBubble avatar={child.avatar} name={child.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-extrabold text-emerald-dark">
                          {child.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {tChildren("level", { level })} · {child.xp} XP ·{" "}
                          {tChildren("streakDays", { count: child.streak })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/paspoort/${child.id}`}
                          className={buttonClasses("ghost", "sm")}
                        >
                          {t("openPassport")}
                        </Link>
                        <Link
                          href={`/kind/${child.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          {t("openChild")}
                        </Link>
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                      {t("thisMonth")}
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-4">
                      <StatTile label={t("totalPlays")} value={plays} />
                      <StatTile
                        label={t("totalTime")}
                        value={t("minutes", { count: Math.round(seconds / 60) })}
                      />
                      <StatTile
                        label={t("avgScore")}
                        value={average === null ? "—" : `${Math.round(average)}%`}
                      />
                      <StatTile
                        label={t("lastActive")}
                        value={
                          child.lastPlay ? dateTime.format(child.lastPlay) : t("never")
                        }
                      />
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      🏅 {t("badges")}: {child._count.badges}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>

          <section className="flex flex-col gap-3">
            <SectionHeading title={t("activity")} />

            {recent.length === 0 ? (
              <EmptyState title={t("activity")} body={t("activityEmpty")} />
            ) : (
              <div className="overflow-x-auto rounded-card bg-white shadow-card">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        {tChildren("title")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("colGame")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("colScore")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("colDuration")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("colDate")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((play) => (
                      <tr key={play.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <AvatarBubble
                              avatar={play.child.avatar}
                              name={play.child.name}
                              size="sm"
                            />
                            <span className="font-bold text-emerald-dark">
                              {play.child.name}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {localize(play.game.titles, locale, play.game.slug)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">
                          {play.score}%
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {t("minutes", { count: Math.max(1, Math.round(play.durationSec / 60)) })}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {dateTime.format(play.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

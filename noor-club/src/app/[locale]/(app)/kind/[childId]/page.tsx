import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { packAccess, requireChild } from "@/lib/entitlement";
import { localize } from "@/lib/i18n-json";
import { levelFor } from "@/lib/xp";
import { AvatarBubble } from "@/components/ui/AvatarBubble";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, StatTile } from "@/components/ui/StatTile";
import { buttonClasses } from "@/components/ui/Button";
import { PackCard, type PackCardData } from "@/components/PackCard";
import { ChildForm } from "@/components/forms/ChildForm";
import { DeleteChildForm } from "@/components/forms/DeleteChildForm";
import { InstallHint } from "@/components/InstallHint";

export const dynamic = "force-dynamic";

export default async function ChildDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  setRequestLocale(locale);

  // Ownership is checked here, not in the query below: a childId belonging to
  // another account redirects out before a single row is read.
  const { user, child } = await requireChild(childId);

  const t = await getTranslations({ locale, namespace: "children" });
  const tPacks = await getTranslations({ locale, namespace: "packs" });
  const tParent = await getTranslations({ locale, namespace: "parent" });

  const [packs, finishedPlays] = await Promise.all([
    db.pack.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true,
        slug: true,
        titles: true,
        descriptions: true,
        coverUrl: true,
        isFree: true,
        releaseAt: true,
        games: { select: { id: true } },
      },
    }),
    db.gamePlay.findMany({
      where: { childId: child.id, completed: true },
      select: { gameId: true },
      distinct: ["gameId"],
    }),
  ]);

  const doneGameIds = new Set(finishedPlays.map((play) => play.gameId));
  const { level, progress } = levelFor(child.xp);

  const cards: PackCardData[] = packs.map((pack) => ({
    slug: pack.slug,
    title: localize(pack.titles, locale, pack.slug),
    description: localize(pack.descriptions, locale),
    coverUrl: pack.coverUrl,
    isFree: pack.isFree,
    releaseAt: pack.releaseAt,
    total: pack.games.length,
    done: pack.games.filter((game) => doneGameIds.has(game.id)).length,
    locked: packAccess(user, pack) === "paywall",
  }));

  // Shown right where the parent lands after a session, but only once ever.
  const showInstallHint =
    !user.installHintSeen &&
    (await db.gamePlay.count({ where: { child: { userId: user.id } } })) > 0;

  return (
    <div className="flex flex-col gap-6">
      {showInstallHint ? <InstallHint /> : null}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <AvatarBubble avatar={child.avatar} name={child.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold text-emerald-dark">
              {child.name}
            </h1>
            <p className="text-sm text-slate-600">
              {child.ageBand === "4-6" ? t("ageBand46") : t("ageBand79")}
            </p>
          </div>
          <Link
            href={`/paspoort/${child.id}`}
            className={buttonClasses("secondary", "md")}
          >
            🏅 {tParent("openPassport")}
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile label={t("level", { level })} value={`${child.xp} XP`} />
          <StatTile
            label={tParent("badges")}
            value={await db.childBadge.count({ where: { childId: child.id } })}
          />
          <StatTile
            label={t("streakDays", { count: child.streak })}
            value={`🔥 ${child.streak}`}
          />
        </div>

        <div className="mt-4">
          <ProgressBar value={progress} label={t("level", { level })} />
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <SectionHeading title={tPacks("title")} subtitle={tPacks("subtitle")} />

        {cards.length === 0 ? (
          <EmptyState title={tPacks("emptyTitle")} body={tPacks("emptyBody")} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((pack) => (
              <li key={pack.slug}>
                <PackCard pack={pack} childId={child.id} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <details>
          <summary className="cursor-pointer list-none font-extrabold text-emerald-dark marker:hidden">
            ⚙ {t("editTitle")}
          </summary>

          <div className="mt-4">
            <ChildForm
              child={{
                id: child.id,
                name: child.name,
                avatar: child.avatar,
                ageBand: child.ageBand,
              }}
            />
          </div>

          <DeleteChildForm childId={child.id} />
        </details>
      </Card>
    </div>
  );
}

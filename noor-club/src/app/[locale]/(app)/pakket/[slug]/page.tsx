import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AssetKind } from "@prisma/client";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { packAccess, requireChild } from "@/lib/entitlement";
import { localize } from "@/lib/i18n-json";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Chip } from "@/components/ui/StatTile";
import { buttonClasses } from "@/components/ui/Button";
import { PaywallCard, UnreleasedCard } from "@/components/PaywallCard";

export const dynamic = "force-dynamic";

export default async function PackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale, slug } = await params;
  const { kind } = await searchParams;
  setRequestLocale(locale);

  if (!kind) redirect(`/${locale}/kinderen`);
  const { user, child } = await requireChild(kind);

  const t = await getTranslations({ locale, namespace: "packs" });
  const tGames = await getTranslations({ locale, namespace: "games" });
  const tKind = await getTranslations({ locale, namespace: "assetKind" });

  const pack = await db.pack.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      titles: true,
      descriptions: true,
      coverUrl: true,
      isFree: true,
      releaseAt: true,
      games: {
        orderBy: { order: "asc" },
        select: { id: true, slug: true, titles: true, engine: true, xp: true, ageBand: true },
      },
      assets: { select: { id: true, kind: true, titles: true, fileUrl: true } },
      badges: { select: { id: true, slug: true, titles: true, iconUrl: true } },
    },
  });

  if (!pack) notFound();

  const title = localize(pack.titles, locale, pack.slug);
  const access = packAccess(user, pack);

  if (access === "unreleased") {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title={title} />
        <UnreleasedCard locale={locale} releaseAt={pack.releaseAt} />
        <BackLink childId={child.id} label={t("backToChild")} />
      </div>
    );
  }

  if (access === "paywall") {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title={title} subtitle={localize(pack.descriptions, locale)} />
        <PaywallCard locale={locale} />
        <BackLink childId={child.id} label={t("backToChild")} />
      </div>
    );
  }

  const gameIds = pack.games.map((game) => game.id);
  const stats =
    gameIds.length === 0
      ? []
      : await db.gamePlay.groupBy({
          by: ["gameId"],
          where: { childId: child.id, gameId: { in: gameIds } },
          _max: { score: true },
        });

  const bestByGame = new Map(stats.map((row) => [row.gameId, row._max.score ?? 0]));
  const doneCount = pack.games.filter(
    (game) => (bestByGame.get(game.id) ?? 0) >= 60,
  ).length;
  const allDone = pack.games.length > 0 && doneCount === pack.games.length;

  const earnedBadgeIds = new Set(
    (
      await db.childBadge.findMany({
        where: { childId: child.id, badgeId: { in: pack.badges.map((b) => b.id) } },
        select: { badgeId: true },
      })
    ).map((row) => row.badgeId),
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pack.coverUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {pack.isFree ? <Chip tone="gold">{t("free")}</Chip> : null}
            <Chip tone="emerald">{child.name}</Chip>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-emerald-dark sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-slate-600">{localize(pack.descriptions, locale)}</p>

          <div className="mt-4">
            <ProgressBar
              value={pack.games.length > 0 ? doneCount / pack.games.length : 0}
              label={t("progress", { done: doneCount, total: pack.games.length })}
              tone={allDone ? "emerald" : "gold"}
            />
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {t("progress", { done: doneCount, total: pack.games.length })}
            </p>
            {allDone ? (
              <p className="mt-1 text-sm font-bold text-emerald">{t("allDone")}</p>
            ) : null}
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeading title={t("gamesTitle")} subtitle={t("gamesSubtitle")} />

        <ul className="grid gap-3">
          {pack.games.map((game) => {
            const best = bestByGame.get(game.id) ?? null;
            const done = (best ?? 0) >= 60;

            return (
              <li
                key={game.id}
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-card bg-white p-4 shadow-card"
              >
                <span className="text-2xl" aria-hidden="true">
                  {done ? "✅" : "🎲"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-emerald-dark">
                    {localize(game.titles, locale, game.slug)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip tone="muted">{tGames(`engineName.${game.engine}`)}</Chip>
                    <Chip tone="gold">{t("xpReward", { xp: game.xp })}</Chip>
                    {best !== null ? (
                      <Chip tone="neutral">{t("bestScore", { score: best })}</Chip>
                    ) : null}
                  </div>
                </div>

                <Link
                  href={`/spel/${game.slug}?kind=${child.id}`}
                  className={buttonClasses(done ? "secondary" : "primary", "md")}
                >
                  {done ? t("replay") : t("play")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {pack.badges.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading title={t("badgeTitle")} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {pack.badges.map((badge) => {
              const earned = earnedBadgeIds.has(badge.id);
              return (
                <li
                  key={badge.id}
                  className="flex min-w-0 items-center gap-4 rounded-card bg-white p-4 shadow-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badge.iconUrl}
                    alt=""
                    width={56}
                    height={56}
                    className={`h-14 w-14 shrink-0 ${earned ? "" : "opacity-30 grayscale"}`}
                  />
                  <div className="min-w-0">
                    <p className="font-extrabold text-emerald-dark">
                      {localize(badge.titles, locale, badge.slug)}
                    </p>
                    <p className="text-sm text-slate-600">{t("badgeBody")}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionHeading title={t("assetsTitle")} subtitle={t("assetsSubtitle")} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {pack.assets.map((asset) => (
            <li
              key={asset.id}
              // `min-w-0` matters: a grid item defaults to min-width:auto, which
              // lets its content push the row wider than the 375px viewport
              // instead of letting the title truncate.
              className="flex min-w-0 items-center gap-3 rounded-card bg-white p-4 shadow-card"
            >
              <span className="shrink-0 text-2xl" aria-hidden="true">
                {assetIcon(asset.kind)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-emerald-dark">
                  {localize(asset.titles, locale, asset.fileUrl)}
                </p>
                <p className="text-xs text-slate-500">{tKind(asset.kind)}</p>
              </div>
              {/* Never the file path: the bytes come from a route that checks
                  entitlement first. */}
              <a
                href={`/api/asset/${asset.id}`}
                className={buttonClasses("secondary", "sm", "shrink-0")}
              >
                {t("download")}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <BackLink childId={child.id} label={t("backToChild")} />
    </div>
  );
}

function BackLink({ childId, label }: { childId: string; label: string }) {
  return (
    <Link href={`/kind/${childId}`} className="text-sm font-bold text-emerald underline">
      ← {label}
    </Link>
  );
}

function assetIcon(kind: AssetKind): string {
  switch (kind) {
    case "WORKSHEET":
      return "📝";
    case "STORY":
      return "📖";
    case "PARENT_GUIDE":
      return "🧭";
    case "POSTER":
      return "🖼️";
  }
}

import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireChild } from "@/lib/entitlement";
import { localize } from "@/lib/i18n-json";
import { Passport, type PassportBadge } from "@/components/Passport";

export const dynamic = "force-dynamic";

export default async function PassportPage({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  setRequestLocale(locale);

  const { child } = await requireChild(childId);

  // Every badge that exists, not only the earned ones: the grey silhouettes are
  // the point of the passport.
  const [allBadges, earned] = await Promise.all([
    db.badge.findMany({
      orderBy: { slug: "asc" },
      select: {
        id: true,
        titles: true,
        iconUrl: true,
        slug: true,
        pack: { select: { titles: true, slug: true } },
      },
    }),
    db.childBadge.findMany({
      where: { childId: child.id },
      select: { badgeId: true, earnedAt: true },
    }),
  ]);

  const earnedAtByBadge = new Map(earned.map((row) => [row.badgeId, row.earnedAt]));

  const badges: PassportBadge[] = allBadges.map((badge) => ({
    id: badge.id,
    title: localize(badge.titles, locale, badge.slug),
    iconUrl: badge.iconUrl,
    packTitle: badge.pack ? localize(badge.pack.titles, locale, badge.pack.slug) : "",
    earnedAt: earnedAtByBadge.get(badge.id) ?? null,
  }));

  return <Passport child={child} badges={badges} locale={locale} />;
}

import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { packAccess, requireChild } from "@/lib/entitlement";
import { localize } from "@/lib/i18n-json";
import { AGE_BANDS, type AgeBand } from "@/lib/validators";
import { GameHost } from "@/components/games/GameHost";
import { PaywallCard, UnreleasedCard } from "@/components/PaywallCard";
import { SectionHeading } from "@/components/ui/Card";
import { AvatarBubble } from "@/components/ui/AvatarBubble";

export const dynamic = "force-dynamic";

function toAgeBand(value: string): AgeBand {
  return (AGE_BANDS as readonly string[]).includes(value) ? (value as AgeBand) : "4-6";
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; gameSlug: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { locale, gameSlug } = await params;
  const { kind } = await searchParams;
  setRequestLocale(locale);

  if (!kind) redirect(`/${locale}/kinderen`);
  const { user, child } = await requireChild(kind);

  const t = await getTranslations({ locale, namespace: "packs" });

  const game = await db.game.findUnique({
    where: { slug: gameSlug },
    select: {
      slug: true,
      engine: true,
      titles: true,
      ageBand: true,
      data: true,
      pack: {
        select: { slug: true, titles: true, isFree: true, releaseAt: true },
      },
    },
  });

  if (!game) notFound();

  // Re-checked here even though the pack page already gated: a direct link to a
  // game must not be a way around the paywall.
  const access = packAccess(user, game.pack);
  const title = localize(game.titles, locale, game.slug);

  if (access !== "ok") {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title={title} />
        {access === "paywall" ? (
          <PaywallCard locale={locale} />
        ) : (
          <UnreleasedCard locale={locale} releaseAt={game.pack.releaseAt} />
        )}
        <Link
          href={`/kind/${child.id}`}
          className="text-sm font-bold text-emerald underline"
        >
          ← {t("backToChild")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarBubble avatar={child.avatar} name={child.name} size="sm" />
          <div>
            <h1 className="text-lg font-extrabold text-emerald-dark">{title}</h1>
            <p className="text-xs text-slate-500">
              {localize(game.pack.titles, locale, game.pack.slug)}
            </p>
          </div>
        </div>

        <Link
          href={`/pakket/${game.pack.slug}?kind=${child.id}`}
          className="text-sm font-bold text-emerald underline"
        >
          ← {t("backToChild")}
        </Link>
      </div>

      <GameHost
        gameSlug={game.slug}
        engine={game.engine}
        rawData={game.data}
        locale={locale}
        ageBand={toAgeBand(game.ageBand)}
        childId={child.id}
        packSlug={game.pack.slug}
      />
    </div>
  );
}

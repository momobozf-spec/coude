import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/entitlement";
import { levelFor } from "@/lib/xp";
import { AvatarBubble } from "@/components/ui/AvatarBubble";
import { Card, CardTitle, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Chip, EmptyState } from "@/components/ui/StatTile";
import { ChildForm } from "@/components/forms/ChildForm";
import { InstallHint } from "@/components/InstallHint";

export const dynamic = "force-dynamic";

export default async function ChildrenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const t = await getTranslations({ locale, namespace: "children" });

  const children = await db.child.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      avatar: true,
      ageBand: true,
      xp: true,
      streak: true,
      _count: { select: { badges: true } },
    },
  });

  // Only worth asking once the child has actually played something.
  const showInstallHint =
    !user.installHintSeen &&
    (await db.gamePlay.count({ where: { child: { userId: user.id } } })) > 0;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />

      {showInstallHint ? <InstallHint /> : null}

      {children.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => {
            const { level, progress } = levelFor(child.xp);

            return (
              <li key={child.id}>
                <Link
                  href={`/kind/${child.id}`}
                  className="block rounded-card bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-center gap-4">
                    <AvatarBubble avatar={child.avatar} name={child.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-extrabold text-emerald-dark">
                        {child.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Chip tone="emerald">{t("level", { level })}</Chip>
                        <Chip tone="gold">{t("xpTotal", { xp: child.xp })}</Chip>
                        {child._count.badges > 0 ? (
                          <Chip tone="neutral">🏅 {child._count.badges}</Chip>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar value={progress} label={t("level", { level })} />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {t("streakDays", { count: child.streak })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardTitle>+ {t("add")}</CardTitle>
        <p className="mb-4 mt-1 text-sm text-slate-600">{t("addSubtitle")}</p>
        <ChildForm />
      </Card>
    </div>
  );
}

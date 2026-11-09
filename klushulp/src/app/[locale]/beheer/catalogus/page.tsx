import { asc } from "drizzle-orm";
import { localeFromParams } from "@/lib/locale";
import { db } from "@/db";
import { category, region, municipality } from "@/db/schema";
import { pick } from "@/i18n";
import { Badge, Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { adminCatalogAction } from "../actions";
import { sql } from "drizzle-orm";

export default async function AdminCatalog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const [cats, regions, counts] = await Promise.all([
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db.select().from(region),
    db.select({ regionId: municipality.regionId, n: sql<number>`count(*)::int` }).from(municipality).groupBy(municipality.regionId),
  ]);
  const Toggle = ({ kind, id, active }: { kind: string; id: string; active: boolean }) => (
    <form action={adminCatalogAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <Button variant="secondary" className="min-h-9 px-3 text-xs">
        {active ? t("admin.hide") : t("admin.show")}
      </Button>
    </form>
  );
  return (
    <div className="space-y-6">
      <PageTitle>{t("admin.nav_catalog")}</PageTitle>
      <Card className="space-y-3">
        <SectionTitle>{t("req.category_label")}</SectionTitle>
        {cats.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <div>
              <p className="font-semibold">
                {pick(c, "name", locale)} <Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "actief" : "uit"}</Badge>
              </p>
              <p className="text-xs text-muted">
                {c.slug} · {c.allowedProviderTypes.join(", ")} · {t("admin.nav_verifications")}: {c.requiredVerifications.join(", ") || "—"}
              </p>
            </div>
            <Toggle kind="category" id={c.id} active={c.active} />
          </div>
        ))}
      </Card>
      <Card className="space-y-3">
        <SectionTitle>Regio&apos;s / Régions</SectionTitle>
        {regions.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <p className="font-semibold">
              {pick(r, "name", locale)} <Badge tone={r.active ? "ok" : "neutral"}>{r.active ? "actief" : "uit"}</Badge> <span className="text-xs font-normal text-muted">{counts.find((x) => x.regionId === r.id)?.n ?? 0} gemeenten</span>
            </p>
            <Toggle kind="region" id={r.id} active={r.active} />
          </div>
        ))}
      </Card>
    </div>
  );
}

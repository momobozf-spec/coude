import { eq } from "drizzle-orm";
import { localeFromParams } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { db } from "@/db";
import { providerVerification, type VerificationKind } from "@/db/schema";
import { requiredVerificationsFor } from "@/lib/services/admin";
import { getCategories } from "@/lib/catalog";
import { pick, type MessageKey } from "@/i18n";
import { Badge, Card, PageTitle } from "@/components/ui";
import { VerificationForm } from "@/components/verification-form";

const KINDS: VerificationKind[] = ["kbo", "identity", "insurance", "certificate"];

export default async function VerificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { provider } = (await getCurrentProvider())!;
  const [rows, required, cats] = await Promise.all([db.select().from(providerVerification).where(eq(providerVerification.providerId, provider.id)), requiredVerificationsFor(provider.id), getCategories()]);
  const labels = { "ver.reference": t("ver.reference"), "ver.document": t("ver.document"), "ver.submit": t("ver.submit"), "common.loading": t("common.loading"), "common.error_generic": t("common.error_generic"), "common.saved": t("common.saved") };
  return (
    <div className="space-y-6">
      <PageTitle sub={t("ver.help")}>{t("ver.title")}</PageTitle>
      {KINDS.map((kind) => {
        const row = rows.find((r) => r.kind === kind);
        const status = row?.status ?? "missing";
        const tone = status === "approved" ? "ok" : status === "pending" ? "warn" : status === "rejected" ? "danger" : "neutral";
        const reqCats = cats.filter((c) => c.requiredVerifications.includes(kind) && required.includes(kind)).map((c) => pick(c, "name", locale));
        return (
          <Card key={kind} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">{t(`ver.kind_${kind}` as MessageKey)}</h2>
              <Badge tone={tone}>{t(`ver.status_${status}` as MessageKey)}</Badge>
            </div>
            {reqCats.length > 0 && <p className="text-sm text-muted">{t("ver.required_for", { cats: reqCats.join(", ") })}</p>}
            {row?.note && status === "rejected" && <p className="text-sm text-danger">{row.note}</p>}
            {row?.reference && <p className="text-sm">{row.reference}</p>}
            {status !== "approved" && <VerificationForm locale={locale} kind={kind} labels={labels} />}
          </Card>
        );
      })}
    </div>
  );
}

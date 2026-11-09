import type { Metadata } from "next";
import { localeFromParams } from "@/lib/locale";
import { env } from "@/lib/env";
import { Alert, Card, DescriptionList, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Juridische informatie" };

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { t } = await localeFromParams(params);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <PageTitle>{t("legal.title")}</PageTitle>
      <Alert tone="warn">{t("legal.draft_notice")}</Alert>
      <Card>
        <h2 className="mb-2 font-bold">{t("legal.operator")}</h2>
        <DescriptionList items={[{ k: "Naam / Nom", v: env.legal.name || "—" }, { k: "BTW / TVA", v: env.legal.vat || "—" }, { k: "Adres / Adresse", v: env.legal.address || "Zaventem" }]} />
      </Card>
      <Card className="space-y-2 text-sm">
        <p>{t("legal.payment_note")}</p>
        <p>{t("legal.no_claims")}</p>
      </Card>
    </div>
  );
}

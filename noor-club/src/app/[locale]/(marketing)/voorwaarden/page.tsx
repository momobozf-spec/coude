import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/LegalPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "terms");
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalPage locale={locale} title={t("termsTitle")}>
      {/*
        TODO(jurist): laat deze tekst opstellen door een jurist voordat je live
        gaat. Neem in elk geval op:

        TODO - Wie de overeenkomst aangaat: de ouder/voogd, niet het kind.
        TODO - Beschrijving van de dienst: maandelijkse digitale leerpakketten,
               toegang zolang het abonnement loopt.
        TODO - Prijs en betaling: €1 voor de eerste maand, daarna €79 per jaar,
               automatische incasso via Stripe. Btw-behandeling van digitale
               diensten aan consumenten in de EU.
        TODO - Herroepingsrecht: 14 dagen, met de uitzondering voor digitale
               content die direct wordt geleverd. De klant vinkt bij het
               afrekenen expliciet aan dat hij daarvan afstand doet; dat wordt
               met tijdstip vastgelegd (User.withdrawalWaivedAt).
        TODO - Opzegging: op elk moment via het klantportaal, toegang loopt door
               tot het einde van de betaalde periode.
        TODO - Intellectueel eigendom: licentie voor persoonlijk gebruik binnen
               het gezin; werkbladen mogen thuis geprint worden, niet
               herverspreid of klassikaal gebruikt.
        TODO - Aansprakelijkheid en beschikbaarheid.
        TODO - Wijzigingen van voorwaarden en prijzen, met opzegmogelijkheid.
        TODO - Toepasselijk recht en bevoegde rechter.
      */}
    </LegalPage>
  );
}

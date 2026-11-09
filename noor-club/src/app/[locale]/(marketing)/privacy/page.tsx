import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/LegalPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "privacy");
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalPage locale={locale} title={t("privacyTitle")}>
      {/*
        TODO(jurist): laat deze tekst opstellen door een jurist voordat je live
        gaat. Neem in elk geval op:

        TODO - Verwerkingsverantwoordelijke: bedrijfsnaam, adres, KvK, contact.
        TODO - Welke persoonsgegevens: naam en e-mailadres van de ouder; naam,
               avatar en leeftijdsgroep van het kind; speelresultaten; IP-adres
               en tijdstempels voor beveiliging (rate limiting).
        TODO - Grondslag per categorie (uitvoering overeenkomst / gerechtvaardigd
               belang / toestemming).
        TODO - Kinderen onder 16: hoe ouderlijke toestemming wordt vastgesteld.
               Dit is voor deze doelgroep het belangrijkste punt.
        TODO - Verwerkers: Stripe (betalingen), Resend (e-mail), Vercel
               (hosting), Supabase (database). Met verwerkersovereenkomsten en
               vestigingsland.
        TODO - Doorgifte buiten de EER en de waarborgen daarvoor.
        TODO - Bewaartermijnen per categorie.
        TODO - Rechten van betrokkenen: inzage, correctie, verwijdering,
               dataportabiliteit, bezwaar. Verwijs naar /account, waar de ouder
               zelf kan exporteren en verwijderen.
        TODO - Klachtrecht bij de Autoriteit Persoonsgegevens.
        TODO - Cookies: op dit moment alleen een strikt noodzakelijke
               sessiecookie. Werk dit bij zodra er analytics bij komt.
      */}
    </LegalPage>
  );
}

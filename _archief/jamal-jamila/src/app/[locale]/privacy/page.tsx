import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacybeleid" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Privacybeleid</h1>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>Laatst bijgewerkt: juni 2026</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">1. Welke gegevens verzamelen wij?</h2>
        <p>Wij verzamelen de volgende persoonsgegevens wanneer je een bestelling plaatst of een account aanmaakt: naam, e-mailadres, telefoonnummer, verzendadres en betaalgegevens (veilig verwerkt door onze betaalprovider Mollie).</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">2. Hoe gebruiken wij je gegevens?</h2>
        <p>We gebruiken je gegevens om: bestellingen te verwerken en te verzenden, je account te beheren, klantenservice te bieden, en je te informeren over nieuwe collecties en aanbiedingen (met jouw toestemming).</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">3. Cookies</h2>
        <p>Wij gebruiken functionele cookies om je winkelervaring te verbeteren (zoals het onthouden van je winkelmandje). Analytische en marketingcookies worden alleen geplaatst met jouw toestemming, conform de AVG/GDPR-wetgeving. Zie ons <a href="/cookies" className="text-emerald underline">cookiebeleid</a>.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">4. Delen van gegevens</h2>
        <p>Wij delen je gegevens alleen met derden die noodzakelijk zijn voor de dienstverlening: Mollie (betalingen), onze verzendpartners, en Resend (e-mailberichten). Wij verkopen je gegevens nooit aan derden.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">5. Je rechten</h2>
        <p>Je hebt het recht om je persoonsgegevens in te zien, te corrigeren of te verwijderen. Neem contact op via hello@layali.shop om gebruik te maken van deze rechten.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">6. Beveiliging</h2>
        <p>We nemen passende technische en organisatorische maatregelen om je persoonsgegevens te beschermen. Alle betalingen worden versleuteld verwerkt via Mollie.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">7. Contact</h2>
        <p>Voor vragen over ons privacybeleid kun je contact opnemen via hello@layali.shop of via ons contactformulier.</p>
      </div>
    </div>
  );
}

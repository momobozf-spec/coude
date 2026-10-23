import type { Metadata } from "next";

export const metadata: Metadata = { title: "Algemene Voorwaarden" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Algemene Voorwaarden</h1>
      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>Laatst bijgewerkt: juni 2026</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">1. Toepasselijkheid</h2>
        <p>Deze algemene voorwaarden zijn van toepassing op elke bestelling en overeenkomst tussen Layali en de klant via deze webshop.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">2. Prijzen</h2>
        <p>Alle prijzen zijn in euro en inclusief btw, tenzij anders vermeld. Verzendkosten worden apart berekend en getoond tijdens het afrekenen.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">3. Bestelling & overeenkomst</h2>
        <p>Een overeenkomst komt tot stand zodra je bestelling is bevestigd en de betaling is ontvangen. Je ontvangt een bevestiging per e-mail met je bestelnummer.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">4. Betaling</h2>
        <p>Betalingen verlopen veilig via Mollie (Bancontact, iDEAL, creditcard en andere methoden). Je gegevens worden versleuteld verwerkt.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">5. Levering</h2>
        <p>We streven naar levering binnen 3-5 werkdagen (standaard) of 1-2 werkdagen (express) in België en Nederland. Levertijden zijn indicatief. Zie ook ons <a href="/shipping-returns" className="text-emerald underline">verzend- en retourbeleid</a>.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">6. Herroepingsrecht</h2>
        <p>Je hebt het recht om je bestelling binnen 14 dagen na ontvangst zonder opgave van reden te retourneren. Producten dienen ongebruikt en in de originele verpakking te zijn. Geuren, parfumolie en voedingswaren zijn om hygiënische redenen uitgesloten van retour wanneer geopend.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">7. Aansprakelijkheid</h2>
        <p>Handgemaakte producten kunnen kleine afwijkingen in kleur, vorm en patroon vertonen; dit is inherent aan het ambacht en geen gebrek. Layali is niet aansprakelijk voor indirecte schade.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">8. Toepasselijk recht</h2>
        <p>Op deze voorwaarden is het Belgisch recht van toepassing.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">9. Contact</h2>
        <p>Vragen? Mail ons op hello@layali.shop.</p>
      </div>
    </div>
  );
}

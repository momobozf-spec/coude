import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import LegalEntityBlock, { legalEmail } from "@/components/legal/LegalEntityBlock";

export const metadata: Metadata = { title: "Privacybeleid" };
export const dynamic = "force-dynamic";

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";

export default function PrivacyPage() {
  const email = legalEmail();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Privacybeleid</h1>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>Laatst bijgewerkt: oktober 2026</p>

        <h2 className={h2}>1. Wie is verantwoordelijk?</h2>
        <LegalEntityBlock />

        <h2 className={h2}>2. Welke gegevens en waarvoor?</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Bestellingen</strong> — naam, e-mailadres, telefoonnummer (optioneel), verzendadres en de producten die je
            bestelt. Nodig om je bestelling uit te voeren (uitvoering van de overeenkomst).
          </li>
          <li>
            <strong>Account</strong> — naam, e-mailadres en een versleuteld wachtwoord, zodat je je bestellingen kunt
            volgen (uitvoering van de overeenkomst).
          </li>
          <li>
            <strong>Nieuwsbrief</strong> — je e-mailadres en taal, alleen als je je zelf inschrijft (toestemming). Je kunt je
            altijd uitschrijven via {email}.
          </li>
          <li>
            <strong>Betaling</strong> — je betaalt via Mollie. Wij krijgen geen kaart- of bankgegevens te zien, alleen of de
            betaling gelukt is.
          </li>
        </ul>

        <h2 className={h2}>3. Hoe lang bewaren we ze?</h2>
        <p>
          Gegevens over bestellingen en facturen bewaren we zeven jaar, omdat de boekhoudwetgeving dat verplicht. Je account
          bewaren we tot je vraagt om het te verwijderen. Nieuwsbriefinschrijvingen tot je je uitschrijft.
        </p>

        <h2 className={h2}>4. Met wie delen we ze?</h2>
        <p>
          Alleen met verwerkers die nodig zijn voor de dienst: Mollie (betalingen), Resend (e-mails), onze hostingpartners
          (Render en Neon, servers in Frankfurt) en de pakketdienst die je bestelling levert. We verkopen je gegevens nooit.
        </p>

        <h2 className={h2}>5. Cookies</h2>
        <p>
          We gebruiken noodzakelijke cookies om je aan te melden en je winkelmandje te onthouden. Analytische of
          marketingcookies alleen met jouw toestemming. Zie ons{" "}
          <Link href="/cookies" className="text-emerald underline">cookiebeleid</Link>.
        </p>

        <h2 className={h2}>6. Je rechten</h2>
        <p>
          Je hebt het recht om je gegevens in te zien, te laten verbeteren of te laten wissen, de verwerking te beperken, je
          te verzetten tegen de verwerking en je gegevens mee te nemen. Mail naar {email}; we antwoorden binnen een maand.
          Ben je niet tevreden, dan kun je een klacht indienen bij de Gegevensbeschermingsautoriteit
          (www.gegevensbeschermingsautoriteit.be).
        </p>

        <h2 className={h2}>7. Beveiliging</h2>
        <p>
          Wachtwoorden worden versleuteld opgeslagen, alle verbindingen lopen over https en alleen beheerders hebben toegang
          tot bestellingen.
        </p>
      </div>
    </div>
  );
}

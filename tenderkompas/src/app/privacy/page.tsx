import Link from "next/link";
import { EntityBlock, LegalPage } from "@/components/legal-page";
import { legalAddress } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacyverklaring" };

const days = (key: string, fallback: number) => Number(process.env[key] ?? fallback) || fallback;

export default function Privacy() {
  return (
    <LegalPage title="Privacyverklaring TenderKompas IT" version="Versie 2026-10-24.">
      <h2>1. Verwerkingsverantwoordelijke</h2>
      <EntityBlock address={legalAddress()} />

      <h2>2. Welke gegevens, waarom en op welke grond</h2>
      <ul>
        <li>
          <strong>Pilotaanvraag via de website:</strong> bedrijfsnaam, contactpersoon, e-mailadres, website, teamgrootte, focus en toelichting. Doel:
          uw aanvraag behandelen en contact opnemen. Rechtsgrond: maatregelen op uw verzoek vóór een overeenkomst (art. 6.1.b AVG) en de
          toestemming die u in het formulier aanvinkt.
        </li>
        <li>
          <strong>Klantaccounts:</strong> naam, e-mailadres, versleuteld wachtwoord (hash), sessiegegevens (IP-adres en browsertype van de sessie) en
          uw meldingsvoorkeuren. Doel: aanmelden, beveiliging en de dienst leveren. Rechtsgrond: uitvoering van de overeenkomst (art. 6.1.b AVG).
        </li>
        <li>
          <strong>Bedrijfsprofiel en feedback:</strong> vooral bedrijfsgegevens; eventuele persoonsgegevens daarin verwerken we als verwerker voor de
          klant (zie artikel 8 van de{" "}
          <Link href="/voorwaarden" className="underline">
            algemene voorwaarden
          </Link>
          ).
        </li>
        <li>
          <strong>Auditlog:</strong> wie wat wijzigde en wanneer, om de dienst te beveiligen en fouten te kunnen herstellen (gerechtvaardigd belang, art.
          6.1.f AVG).
        </li>
        <li>
          <strong>Facturatie:</strong> contact- en facturatiegegevens van klanten, om te factureren en aan de boekhoudplicht te voldoen (art. 6.1.c AVG).
        </li>
      </ul>
      <p>Openbare aanbestedingen (o.a. TED) bevatten soms namen van contactpersonen bij aanbestedende diensten; we bewaren die zoals ze openbaar gepubliceerd zijn en gebruiken ze niet voor marketing.</p>

      <h2>3. Cookies</h2>
      <p>We gebruiken enkel een strikt noodzakelijk sessiecookie om u aangemeld te houden. Geen analytics, geen advertentiecookies, geen trackers van derden.</p>

      <h2>4. Ontvangers en subverwerkers</h2>
      <ul>
        {/* TODO(Mohamed): aanpassen als je een andere host kiest dan render.yaml (Render, regio Frankfurt). */}
        <li>Hosting, database en documentopslag: Render Services, Inc., in de regio Frankfurt (Europese Unie).</li>
        <li>E-mailverzending van selecties: onze SMTP-provider (TODO: naam invullen zodra gekozen).</li>
        <li>
          Optioneel AI-extractie (Anthropic): enkel voor <em>openbare aanbestedingsdocumenten</em>, niet voor uw account- of profielgegevens.
        </li>
      </ul>
      <p>
        Waar een provider gegevens buiten de Europese Economische Ruimte kan verwerken, gebeurt dat op basis van het EU-VS Data Privacy Framework
        en/of de standaardcontractbepalingen van de Europese Commissie. We verkopen geen persoonsgegevens.
      </p>

      <h2>5. Bewaartermijnen</h2>
      <ul>
        <li>Pilotaanvragen: maximaal {days("RETENTION_LEADS_DAYS", 180)} dagen, tenzij u klant wordt.</li>
        <li>Klantaccounts: zolang het abonnement loopt; daarna verwijderd binnen 90 dagen, behalve facturatiegegevens (7 jaar, wettelijke plicht).</li>
        <li>Auditlog: {days("RETENTION_AUDIT_DAYS", 730)} dagen.</li>
        <li>Back-ups: ongeveer 30 dagen, daarna overschreven.</li>
      </ul>

      <h2>6. Beveiliging</h2>
      <p>Versleutelde verbindingen (HTTPS), wachtwoorden enkel als hash, klantgegevens per organisatie afgeschermd op de server, rate limiting op aanmelden, en documenten enkel downloadbaar na autorisatie.</p>

      <h2>7. Uw rechten</h2>
      <p>
        U hebt recht op inzage, verbetering, verwijdering, beperking, overdraagbaarheid en bezwaar, en u kunt een gegeven toestemming altijd
        intrekken. Mail{" "}
        <a className="underline" href="mailto:momobozf@gmail.com">
          momobozf@gmail.com
        </a>
        ; we antwoorden binnen één maand. Klacht: Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel,{" "}
        <a className="underline" href="https://www.gegevensbeschermingsautoriteit.be" rel="noopener">
          www.gegevensbeschermingsautoriteit.be
        </a>
        .
      </p>
    </LegalPage>
  );
}

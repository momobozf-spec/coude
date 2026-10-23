import { getEnv, isMarketRadarEnabled } from '@/lib/env'

import { LegalIdentity, PublicShell, Section } from '../PublicShell'

export const metadata = { title: 'Verwerkersovereenkomst' }

// Leest de configuratie bij elke request, niet één keer bij de build.
export const dynamic = 'force-dynamic'

/**
 * Verwerkersovereenkomst (art. 28 AVG) tussen het kantoor
 * (verwerkingsverantwoordelijke) en de uitbater (verwerker).
 *
 * CONCEPTTEKST. Moet door een jurist nagekeken worden en per kantoor
 * ondertekend (of als bijlage bij de commerciële overeenkomst aanvaard).
 */
export default function DataProcessingAgreementPage() {
  const env = getEnv()
  const market = isMarketRadarEnabled(env)
  const processor = env.LEGAL_ENTITY_NAME

  return (
    <PublicShell title="Verwerkersovereenkomst">
      <p>
        Deze overeenkomst geldt tussen het vastgoedkantoor dat LeadRevive gebruikt (de
        &quot;verwerkingsverantwoordelijke&quot;, hierna &quot;het kantoor&quot;) en de uitbater
        (de &quot;verwerker&quot;), en maakt deel uit van de gebruiksvoorwaarden en de
        commerciële overeenkomst.
      </p>

      <Section title="1. Partijen">
        <p>
          <strong>Verwerker:</strong>
        </p>
        <LegalIdentity
          name={processor}
          vat={env.LEGAL_ENTITY_VAT}
          address={env.LEGAL_ENTITY_ADDRESS}
          municipality={env.LEGAL_ENTITY_MUNICIPALITY}
          email={env.LEGAL_CONTACT_EMAIL}
        />
        <p>
          <strong>Verwerkingsverantwoordelijke:</strong> het kantoor zoals vermeld in de
          commerciële overeenkomst (naam, ondernemingsnummer, adres, vertegenwoordiger).
        </p>
      </Section>

      <Section title="2. Onderwerp, aard en doel">
        <p>
          De verwerker verwerkt persoonsgegevens uitsluitend om de dienst LeadRevive te leveren:
          het inlezen van het klantenbestand van het kantoor (CSV-import), het ontdubbelen en
          normaliseren van contacten, het bepalen welke relaties een aanleiding hebben om
          gecontacteerd te worden, het tonen daarvan in het dashboard van het kantoor en, als het
          kantoor dat instelt, het versturen van meldingen.
          {market &&
            ' Wanneer de module Marktradar actief is, worden marktgegevens waarvoor de verwerker zelf verantwoordelijk is aan het klantenbestand gekoppeld; die koppeling gebeurt uitsluitend voor het kantoor zelf.'}
        </p>
      </Section>

      <Section title="3. Categorieën van gegevens en betrokkenen">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Betrokkenen: klanten, oud-klanten, prospecten en andere contacten van het kantoor;
            medewerkers van het kantoor (gebruikersaccounts).
          </li>
          <li>
            Gegevens: identificatie (naam), contactgegevens (telefoon, e-mail), adres en
            pandgegevens, relatie tot een pand (koper, verkoper, eigenaar, schattingsaanvraag),
            data en aard van contactmomenten, vrije notities zoals aangeleverd door het kantoor.
          </li>
          <li>
            Het kantoor levert geen bijzondere categorieën van persoonsgegevens (art. 9 AVG) of
            gegevens over strafrechtelijke veroordelingen aan.
          </li>
        </ul>
      </Section>

      <Section title="4. Duur">
        <p>
          Deze overeenkomst loopt zolang de verwerker persoonsgegevens voor het kantoor verwerkt,
          en eindigt met de teruggave of verwijdering zoals in artikel 11.
        </p>
      </Section>

      <Section title="5. Instructies">
        <p>
          De verwerker verwerkt de gegevens alleen op basis van schriftelijke instructies van het
          kantoor; de configuratie en het gebruik van LeadRevive door het kantoor gelden als
          zodanig. De verwerker gebruikt de gegevens nooit voor eigen doeleinden en deelt ze nooit
          met andere kantoren. Meent de verwerker dat een instructie de AVG schendt, dan meldt hij
          dat onmiddellijk.
        </p>
      </Section>

      <Section title="6. Vertrouwelijkheid">
        <p>
          Iedereen die onder het gezag van de verwerker toegang heeft tot de gegevens, is tot
          geheimhouding verplicht. Platformbeheerders zien van een klantenbestand enkel aantallen,
          niet de inhoud.
        </p>
      </Section>

      <Section title="7. Beveiliging (art. 32 AVG)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Versleutelde verbindingen (https) en hosting en databank in de Europese Unie.</li>
          <li>
            Strikte scheiding tussen kantoren: elke query is beperkt tot het eigen kantoor.
          </li>
          <li>
            Wachtwoorden gehasht met scrypt, tijdelijke vergrendeling na mislukte pogingen,
            beperking per IP-adres, mogelijkheid om alle sessies in te trekken.
          </li>
          <li>Logboeken zonder persoonsgegevens (geredigeerd); auditlog van gevoelige acties.</li>
          <li>Automatische opruiming volgens de bewaartermijnen; dagelijkse back-ups.</li>
        </ul>
      </Section>

      <Section title="8. Subverwerkers">
        <p>
          Het kantoor geeft algemene toestemming voor het inschakelen van subverwerkers. De actuele
          lijst: de hostingprovider van applicatie en databank (regio Frankfurt, EU) en, alleen als
          het kantoor meldingen activeert, Telegram voor het afleveren van berichten. De verwerker
          meldt een nieuwe of gewijzigde subverwerker minstens dertig dagen vooraf; het kantoor kan
          binnen die termijn gemotiveerd bezwaar maken en, als geen oplossing gevonden wordt, de
          overeenkomst opzeggen. De verwerker legt subverwerkers dezelfde verplichtingen op en
          blijft tegenover het kantoor aansprakelijk.
        </p>
      </Section>

      <Section title="9. Doorgifte buiten de EER">
        <p>
          Gegevens worden opgeslagen en verwerkt binnen de Europese Economische Ruimte. Een
          doorgifte daarbuiten gebeurt alleen met een passende waarborg (adequaatheidsbesluit of
          modelcontractbepalingen) en na voorafgaande melding aan het kantoor.
        </p>
      </Section>

      <Section title="10. Bijstand, rechten van betrokkenen en datalekken">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            De verwerker helpt het kantoor bij verzoeken van betrokkenen (inzage, verbetering,
            wissing, bezwaar) en stuurt een verzoek dat hij rechtstreeks ontvangt door naar het
            kantoor.
          </li>
          <li>
            Een inbreuk in verband met persoonsgegevens meldt de verwerker zonder onredelijke
            vertraging en uiterlijk binnen 48 uur na ontdekking aan het kantoor, met de informatie
            die het kantoor nodig heeft voor een eventuele melding aan de
            Gegevensbeschermingsautoriteit.
          </li>
          <li>
            De verwerker verleent redelijke bijstand bij een gegevensbeschermingseffectbeoordeling
            (DPIA) en een voorafgaande raadpleging.
          </li>
        </ul>
      </Section>

      <Section title="11. Einde: teruggave en verwijdering">
        <p>
          Na het einde van de dienstverlening kan het kantoor binnen dertig dagen een export van
          zijn geïmporteerde gegevens vragen. Daarna verwijdert de verwerker de gegevens, ook uit
          de actieve databank; back-ups verlopen volgens hun rotatieschema, tenzij een wettelijke
          bewaarplicht anders vereist.
        </p>
      </Section>

      <Section title="12. Audit">
        <p>
          De verwerker stelt alle informatie ter beschikking die nodig is om de naleving aan te
          tonen, en staat audits toe door het kantoor of een door het kantoor aangewezen
          onafhankelijke auditor, na redelijke voorafgaande kennisgeving en op kosten van het
          kantoor.
        </p>
      </Section>

      <Section title="13. Aansprakelijkheid en toepasselijk recht">
        <p>
          De aansprakelijkheid volgt art. 82 AVG en de beperkingen in de gebruiksvoorwaarden, voor
          zover wettelijk toegelaten. Op deze overeenkomst is Belgisch recht van toepassing.
        </p>
      </Section>

      <Section title="Ondertekening">
        <p>
          Voor het kantoor: naam, functie, datum, handtekening. Voor {processor}: naam, functie,
          datum, handtekening.
        </p>
      </Section>
    </PublicShell>
  )
}

import Link from 'next/link'

import { getEnv, isMarketRadarEnabled } from '@/lib/env'

import { LegalIdentity, PublicShell, Section } from '../PublicShell'

export const metadata = { title: 'Gebruiksvoorwaarden' }

// Leest de configuratie bij elke request, niet één keer bij de build.
export const dynamic = 'force-dynamic'

/**
 * Gebruiksvoorwaarden voor kantoren (B2B).
 *
 * De commerciële afspraken (prijs, looptijd, opzegging) staan in de
 * overeenkomst met elk kantoor; deze pagina regelt het gebruik van de software.
 * Concept: moet vóór de lancering door een jurist nagekeken worden.
 */
export default function TermsPage() {
  const env = getEnv()
  const market = isMarketRadarEnabled(env)

  return (
    <PublicShell title="Gebruiksvoorwaarden">
      <Section title="Partijen">
        <LegalIdentity
          name={env.LEGAL_ENTITY_NAME}
          vat={env.LEGAL_ENTITY_VAT}
          address={env.LEGAL_ENTITY_ADDRESS}
          municipality={env.LEGAL_ENTITY_MUNICIPALITY}
          email={env.LEGAL_CONTACT_EMAIL}
        />
        <p>
          Deze voorwaarden gelden voor elk vastgoedkantoor met een LeadRevive-abonnement en voor
          iedere medewerker die namens dat kantoor inlogt. Prijs, looptijd en opzegging staan in de
          overeenkomst tussen de uitbater en het kantoor; bij tegenstrijdigheid gaat die
          overeenkomst voor. De verwerking van het klantenbestand is geregeld in de{' '}
          <Link href="/verwerkersovereenkomst" className="text-brand-700 underline">
            verwerkersovereenkomst
          </Link>
          , die deel uitmaakt van deze voorwaarden.
        </p>
      </Section>

      <Section title="Wat LeadRevive doet">
        <p>
          LeadRevive analyseert het klantenbestand dat het kantoor zelf importeert (CSV-export uit
          zijn CRM) en zet bestaande relaties met een aanleiding om te bellen in een geprioriteerde
          lijst: eerdere kopers en verkopers, schattingsaanvragen, contacten die al lang stil zijn.
          {market &&
            ' Met de module Marktradar worden daar marktgebeurtenissen (nieuwe particuliere verkopen, prijsdalingen, lang te koop staande panden) aan gekoppeld; marktgegevens komen uit bronnen die we mogen gebruiken, zonder garantie op volledigheid.'}{' '}
          Scores en suggesties zijn een hulpmiddel bij het prioriteren, geen garantie op een
          opdracht of een verkoop.
        </p>
      </Section>

      <Section title="Verplichtingen van het kantoor">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Het kantoor importeert alleen klantgegevens die het rechtmatig verwerkt, heeft daarvoor
            een grondslag en informeert de betrokkenen zoals de AVG vereist. Het blijft
            verwerkingsverantwoordelijke.
          </li>
          <li>
            Contact met (oud-)klanten gebeurt met respect voor hun keuze: wie aangeeft geen contact
            te willen, wordt niet opnieuw benaderd. Het kantoor respecteert de regels rond
            telefonische en elektronische prospectie, waaronder de Bel-me-niet-meer-lijst.
          </li>
          <li>
            Inloggegevens zijn persoonlijk. Het kantoor deactiveert de toegang van medewerkers die
            vertrekken.
          </li>
          <li>
            Gegevens uit LeadRevive worden niet doorverkocht, niet massaal geëxporteerd en niet
            gebruikt om een concurrerende dienst te bouwen.
          </li>
        </ul>
      </Section>

      <Section title="Abonnement en facturatie">
        <p>
          Het abonnement (plan, maximum aantal kansen per dag, einddatum) wordt door de uitbater
          ingesteld volgens de overeenkomst en maandelijks gefactureerd. Een gepauzeerd of verlopen
          abonnement sluit de toegang af zonder gegevens te wissen.
        </p>
      </Section>

      <Section title="Beschikbaarheid en aansprakelijkheid">
        <p>
          We doen redelijke inspanningen om LeadRevive beschikbaar en veilig te houden, en melden
          geplande onderbrekingen vooraf. Onze aansprakelijkheid is beperkt tot directe schade en tot
          het bedrag dat het kantoor in de twaalf maanden vóór het schadegeval betaalde, behalve bij
          opzet of grove fout.
        </p>
      </Section>

      <Section title="Gegevens bij het einde van het abonnement">
        <p>
          Bij het einde van het abonnement wordt de toegang gesloten. Het kantoor kan binnen dertig
          dagen vragen om zijn geïmporteerde klantgegevens terug te krijgen; daarna worden ze
          gewist.
        </p>
      </Section>

      <Section title="Toepasselijk recht">
        <p>
          Op deze voorwaarden is Belgisch recht van toepassing. Geschillen behoren tot de
          bevoegdheid van de ondernemingsrechtbank van de zetel van de uitbater.
        </p>
      </Section>
    </PublicShell>
  )
}

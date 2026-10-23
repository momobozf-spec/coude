import Link from 'next/link'

import { getEnv, isMarketRadarEnabled } from '@/lib/env'

import { LegalIdentity, PublicShell, Section } from '../PublicShell'

export const metadata = { title: 'Privacyverklaring' }

// Leest de configuratie bij elke request, niet één keer bij de build.
export const dynamic = 'force-dynamic'

/**
 * Privacyverklaring.
 *
 * De bewaartermijnen komen uit dezelfde configuratie als de opruimtaak
 * (`runRetention`), zodat wat hier staat en wat het systeem doet niet uit elkaar
 * kunnen lopen. De passages over marktgegevens verschijnen alleen als de
 * marktradar aan staat (`FEATURE_MARKET_RADAR`).
 *
 * Concept: moet vóór de commerciële lancering door een jurist nagekeken worden
 * (zie docs/LAUNCH-CHECKLIST.md).
 */
export default function PrivacyPage() {
  const env = getEnv()
  const market = isMarketRadarEnabled(env)
  const identity = {
    name: env.LEGAL_ENTITY_NAME,
    vat: env.LEGAL_ENTITY_VAT,
    address: env.LEGAL_ENTITY_ADDRESS,
    municipality: env.LEGAL_ENTITY_MUNICIPALITY,
    email: env.LEGAL_CONTACT_EMAIL,
  }

  return (
    <PublicShell title="Privacyverklaring">
      <p>
        LeadRevive is software voor Belgische vastgoedkantoren. Een kantoor laadt zijn eigen
        klantenbestand in (CSV-export uit zijn CRM) en krijgt een lijst van bestaande relaties die
        vandaag een reden hebben om gecontacteerd te worden.
        {market &&
          ' Daarnaast kan de module Marktradar publieke vastgoedadvertenties aan dat bestand koppelen.'}{' '}
        Deze verklaring legt uit welke persoonsgegevens daarbij verwerkt worden, door wie, en welke
        rechten je hebt.
      </p>

      <Section title="Wie is verantwoordelijk?">
        <LegalIdentity {...identity} />
        <p>
          Voor het <strong>klantenbestand</strong> dat een kantoor zelf importeert, is dat kantoor
          verwerkingsverantwoordelijke. {identity.name} treedt op als <strong>verwerker</strong>, in
          opdracht van en uitsluitend voor dat kantoor, volgens de{' '}
          <Link href="/verwerkersovereenkomst" className="text-brand-700 underline">
            verwerkersovereenkomst
          </Link>
          .
        </p>
        <p>
          Voor de <strong>gebruikersaccounts</strong> van kantoormedewerkers en de beveiliging van het
          platform is {identity.name} zelf verwerkingsverantwoordelijke.
        </p>
        {market && (
          <p>
            Voor de <strong>marktgegevens</strong> (publieke advertenties en de contactgegevens van
            particuliere verkopers die daarin staan) is {identity.name} verwerkingsverantwoordelijke.
          </p>
        )}
      </Section>

      <Section title="Welke gegevens en waarom">
        <p>
          <strong>Klanten van een kantoor.</strong> Wat het kantoor uit zijn eigen CRM aanlevert:
          naam, contactgegevens, adres en de geschiedenis van het contact. Doel: het kantoor helpen
          bestaande relaties op te volgen. Grondslag: die bepaalt het kantoor als
          verwerkingsverantwoordelijke. Deze gegevens zijn uitsluitend zichtbaar voor dat ene
          kantoor en worden nooit gebruikt voor of gedeeld met een ander kantoor.
        </p>
        <p>
          <strong>Gebruikers.</strong> Naam, e-mailadres, rol, inlogmomenten en IP-adres bij
          inlogpogingen van medewerkers van kantoren. Doel: toegang beheren en misbruik vaststellen.
          Grondslag: uitvoering van de overeenkomst met het kantoor en gerechtvaardigd belang
          (beveiliging).
        </p>
        {market && (
          <p>
            <strong>Particuliere verkopers.</strong> Uit publieke advertenties: naam en
            telefoonnummer zoals vermeld, adres en kenmerken van het pand, vraagprijs en de
            wijzigingen daarin. Doel: een vastgoedkantoor in jouw regio de mogelijkheid geven je zijn
            diensten aan te bieden. Grondslag: gerechtvaardigd belang (art. 6.1.f AVG) van de
            kantoren, afgewogen tegen jouw belang — daarom bewaren we alleen wat je zelf publiek
            maakte, en wissen we je contactgegevens na{' '}
            <strong>{env.RETENTION_SELLER_CONTACT_DAYS} dagen</strong>.
          </p>
        )}
      </Section>

      <Section title="Hoe lang">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Klantgegevens van een kantoor zonder activiteit:{' '}
            {env.RETENTION_CRM_CONTACT_DAYS > 0
              ? `${env.RETENTION_CRM_CONTACT_DAYS} dagen, of korter als het kantoor dat vraagt`
              : 'zolang het kantoor ze aanhoudt'}
            . Bij het einde van het abonnement: zie de verwerkersovereenkomst.
          </li>
          <li>
            Ruwe kolommen van een importregel (alleen om een import na te kijken):{' '}
            {env.RETENTION_IMPORT_ROWS_DAYS} dagen.
          </li>
          {market && (
            <>
              <li>
                Contactgegevens van particuliere verkopers: {env.RETENTION_SELLER_CONTACT_DAYS}{' '}
                dagen, daarna gewist.
              </li>
              <li>
                Ingetrokken advertenties: {env.RETENTION_REMOVED_LISTING_DAYS} dagen, zonder
                contactgegevens.
              </li>
              <li>
                Ruwe brongegevens (alleen voor foutanalyse): {env.RETENTION_RAW_PAYLOAD_DAYS} dagen.
              </li>
            </>
          )}
        </ul>
      </Section>

      <Section title="Wie heeft toegang">
        <p>
          Medewerkers van het kantoor dat de gegevens importeerde. De beheerders van het platform
          zien van een klantenbestand uitsluitend aantallen, nooit de inhoud. We verkopen geen
          gegevens.
        </p>
        <p>
          Subverwerkers: de hostingpartij van de applicatie en de databank (in de Europese Unie).
          Meldingen over kansen kunnen, als het kantoor dat instelt, via Telegram verstuurd worden
          naar een chat die het kantoor zelf kiest.
        </p>
      </Section>

      <Section title="Je rechten">
        <p>
          Je hebt recht op inzage, verbetering, verwijdering en beperking van je gegevens, en je kunt
          bezwaar maken tegen de verwerking op basis van gerechtvaardigd belang.
          {market && ' Een bezwaar als particuliere verkoper leidt tot het wissen van je contactgegevens.'}
        </p>
        <p>
          Gaat het om je gegevens in het klantenbestand van een kantoor, richt je dan in de eerste
          plaats tot dat kantoor; wij helpen het kantoor je verzoek uit te voeren. Voor al het andere:{' '}
          <a href={`mailto:${identity.email}`} className="text-brand-700 underline">
            {identity.email}
          </a>
          .
        </p>
        <p>
          Je kunt klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000
          Brussel (
          <a
            href="https://www.gegevensbeschermingsautoriteit.be"
            className="text-brand-700 underline"
            rel="noopener noreferrer"
          >
            gegevensbeschermingsautoriteit.be
          </a>
          ).
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          LeadRevive gebruikt één cookie: het sessiecookie dat je ingelogd houdt. Het is strikt
          noodzakelijk, bevat geen tracking en vervalt na je sessie. Er zijn geen analytische of
          advertentiecookies.
        </p>
      </Section>
    </PublicShell>
  )
}

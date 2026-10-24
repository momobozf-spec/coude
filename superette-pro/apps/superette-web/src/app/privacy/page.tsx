'use client';

/**
 * Privacyverklaring — VOORSTEL, in het Nederlands.
 *
 * De structuur volgt AVG art. 13: verwerkingsverantwoordelijke, doelen,
 * rechtsgronden, bewaartermijnen, rechten, contact. De inhoud is afgestemd op
 * wat de software werkelijk doet (zie docs/PRIVACY.md voor het register).
 * Een jurist moet de tekst goedkeuren vóór publicatie; de vertalingen volgen.
 */
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Notice, PageTitle } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

const PROCESSING: ReadonlyArray<{ purpose: string; data: string; basis: string; retention: string }> = [
  { purpose: 'Account en inloggen', data: 'e-mailadres, naam, wachtwoord (gehasht), taal, sessies (apparaattype, tijdstippen)', basis: 'uitvoering van de overeenkomst (art. 6.1.b)', retention: 'tot verwijdering van het account; sessies tot 30 dagen na afloop' },
  { purpose: 'Boodschappenlijsten en voorkeuren', data: 'lijsten, regels, supermarktvoorkeuren, postcode en gemeente (optioneel), klantenkaartbezit', basis: 'uitvoering van de overeenkomst (art. 6.1.b)', retention: 'tot verwijdering door jou of van het account' },
  { purpose: 'Prijsalerts en meldingen', data: 'gekozen producten, doelprijzen, winkels, meldingsgeschiedenis', basis: 'uitvoering van de overeenkomst (art. 6.1.b)', retention: 'tot verwijdering door jou of van het account' },
  { purpose: 'E-mailmeldingen', data: 'e-mailadres, inhoud van de melding', basis: 'toestemming (art. 6.1.a), opt-in in je voorkeuren, altijd intrekbaar', retention: 'afleverlog 90 dagen' },
  { purpose: 'Nieuwsbrief en tips', data: 'e-mailadres', basis: 'toestemming (art. 6.1.a), nooit een voorwaarde', retention: 'tot intrekking' },
  { purpose: 'Beveiliging en misbruikpreventie', data: 'IP-adres (alleen voor rate limiting, niet opgeslagen), request-id, technische logs zonder persoonsgegevens', basis: 'gerechtvaardigd belang (art. 6.1.f)', retention: 'logs 30 dagen' },
  { purpose: 'Boetiek Jamal & Jamila (zelfde account)', data: 'toestemmingen, toegangslogs, bestellingen, kasbonnen', basis: 'overeenkomst, wettelijke verplichting (btw, camerawet)', retention: 'kasbonnen 7 jaar; toestemmingen en toegangslogs volgens de boetiekvoorwaarden' },
];

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <PageTitle>{t('privacy.title')}</PageTitle>
      <Notice tone="warning" className="mb-6">
        {t('privacy.draftNotice')}
      </Notice>

      <div className="space-y-8 text-sm leading-relaxed text-ink" lang="nl-BE">
        <section aria-labelledby="who">
          <h2 id="who" className="text-lg font-bold">
            Wie is verantwoordelijk?
          </h2>
          <p className="mt-2">
            Superette wordt uitgebaat door <strong>[naam van de onderneming, ondernemingsnummer, adres]</strong>. Vragen over je gegevens:{' '}
            <strong>[privacy@…]</strong>. <em>In te vullen door de uitbater; verplicht onder AVG art. 13.</em>
          </p>
        </section>

        <section aria-labelledby="what">
          <h2 id="what" className="text-lg font-bold">
            Welke gegevens, waarvoor, op welke grond en hoe lang
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col" className="py-1 pr-2 font-normal">Doel</th>
                  <th scope="col" className="py-1 pr-2 font-normal">Gegevens</th>
                  <th scope="col" className="py-1 pr-2 font-normal">Rechtsgrond</th>
                  <th scope="col" className="py-1 font-normal">Bewaartermijn</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSING.map((row) => (
                  <tr key={row.purpose} className="border-t border-hairline align-top">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold">{row.purpose}</th>
                    <td className="py-2 pr-2">{row.data}</td>
                    <td className="py-2 pr-2">{row.basis}</td>
                    <td className="py-2">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="alerts">
          <h2 id="alerts" className="text-lg font-bold">
            Prijsalerts en meldingen
          </h2>
          <p className="mt-2">
            Een prijsalert bewaart welk product je volgt, je doelprijs en je gekozen winkels. Bij elke prijscontrole vergelijken we die
            instellingen met de beschikbare prijzen; valt een prijs onder je grens, dan maken we een melding aan die je in de app ziet. Per e-mail
            melden we alleen als je dat expliciet aanzet in je voorkeuren, hoogstens één overzicht per dag. We delen je alerts nooit met
            supermarkten.
          </p>
        </section>

        <section aria-labelledby="demo">
          <h2 id="demo" className="text-lg font-bold">
            Demo- en livegegevens
          </h2>
          <p className="mt-2">
            Elke prijs toont zijn bron en het moment waarop hij is verzameld. Geïmporteerde prijzen blijven Niet geverifieerd zolang
            de bronvoorwaarden niet juridisch zijn beoordeeld. Verzonnen demonstratieprijzen krijgen uitsluitend het label DEMO. Zie{' '}
            <Link href="/over-de-gegevens" className="font-semibold text-brand underline-offset-2 hover:underline">
              Over de gegevens
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="rights">
          <h2 id="rights" className="text-lg font-bold">
            Je rechten
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Inzage en overdraagbaarheid</strong>: download al je gegevens als JSON via Profiel → Jouw gegevens.
            </li>
            <li>
              <strong>Rectificatie</strong>: lijsten, voorkeuren en alerts pas je zelf aan; voor je naam of e-mailadres neem je contact op.
            </li>
            <li>
              <strong>Wissing</strong>: verwijder je account via Profiel → Jouw gegevens. Kasbonnen van de boetiek blijven zeven jaar bewaard
              (fiscale plicht), zonder je naam of e-mail; toestemmingen en toegangslogs van de boetiek blijven als bewijs.
            </li>
            <li>
              <strong>Intrekken van toestemming</strong>: e-mailmeldingen en nieuwsbrief zet je uit in je voorkeuren.
            </li>
            <li>
              <strong>Klacht</strong>: bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be.
            </li>
          </ul>
        </section>

        <section aria-labelledby="security">
          <h2 id="security" className="text-lg font-bold">
            Beveiliging
          </h2>
          <p className="mt-2">
            Wachtwoorden worden gehasht met Argon2id. Sessies lopen via beveiligde HttpOnly-cookies die JavaScript niet kan lezen, met korte
            levensduur en server-side intrekking. Logs bevatten geen wachtwoorden, tokens of volledige e-mailadressen.
          </p>
        </section>

        <section aria-labelledby="changes">
          <h2 id="changes" className="text-lg font-bold">
            Wijzigingen
          </h2>
          <p className="mt-2">
            Versie: voorstel van 4 oktober 2026. Bij een inhoudelijke wijziging melden we dat in de app en vragen we waar nodig opnieuw je
            toestemming.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

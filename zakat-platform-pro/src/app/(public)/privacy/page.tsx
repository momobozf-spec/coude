import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, legalIdentity } from '@/modules/legal/identity'

export const metadata: Metadata = { title: 'Privacyverklaring' }

export default function PrivacyPage() {
  const who = legalIdentity()

  return (
    <LegalPage title="Privacyverklaring" updated="4 oktober 2026">
      <p>
        Barakah helpt je je Zakat te berekenen en je Sadaqah bij te houden. Daarvoor bewaren we
        financiële gegevens die jij invult. Die zijn gevoelig; hieronder staat precies wat we
        bewaren, waarom, en wat je rechten zijn.
      </p>

      <h2>Wie is verantwoordelijk</h2>
      <p>
        {who.name}, ondernemingsnummer {who.vat}, maatschappelijke zetel: {who.address}. Vragen en verzoeken over
        je gegevens: <a className="text-primary hover:underline" href={`mailto:${who.email}`}>{who.email}</a>.
      </p>

      <h2>Wat we bewaren</h2>
      <ul>
        <li>Account: naam, e-mailadres, wachtwoord (alleen als onomkeerbare hash), taal en tijdzone.</li>
        <li>
          Wat je zelf invult: vermogensposten en schulden, Zakat-berekeningen, donaties, Sadaqah-doelen,
          herinneringen en geüploade bewijsstukken.
        </li>
        <li>Een auditlog van belangrijke handelingen (wie, wat, wanneer) — zonder bedragen.</li>
        <li>
          Technisch: een sessiecookie om je ingelogd te houden. Geen advertentie- of trackingcookies,
          geen analysediensten van derden.
        </li>
      </ul>

      <h2>Waarom (rechtsgrond)</h2>
      <ul>
        <li>
          Om de dienst te leveren die je vraagt — berekenen, bijhouden, herinneren (uitvoering van de
          overeenkomst, art. 6.1.b AVG).
        </li>
        <li>Om de dienst te beveiligen, bv. inlogpogingen beperken en het auditlog (gerechtvaardigd belang, art. 6.1.f).</li>
        <li>
          Zakat-, Sadaqah- en donatiegegevens kunnen je religieuze overtuiging onthullen: een bijzondere
          categorie van persoonsgegevens. Die verwerken we alleen met je uitdrukkelijke toestemming (art.
          9.2.a AVG), die je geeft bij het aanmaken van je account. Je trekt ze in door je gegevens of je
          account te verwijderen; dat raakt de verwerking van daarvoor niet.
        </li>
      </ul>
      <p>
        We verkopen je gegevens niet, gebruiken ze niet voor reclame en delen ze niet met goede
        doelen. Een goed doel krijgt niets te zien van wat jij bij ons registreert.
      </p>

      <h2>Wie verwerkt gegevens voor ons</h2>
      <ul>
        <li>Onze hosting- en databaseprovider, in de Europese Unie.</li>
        {who.email_provider === 'resend' ? (
          <li>Resend, voor het versturen van e-mails (wachtwoordherstel, herinneringen): alleen je e-mailadres en de inhoud van die mail.</li>
        ) : null}
        {who.googleLogin ? <li>Google, alleen als je zelf kiest om met Google in te loggen.</li> : null}
      </ul>
      <p>
        Wisselkoersen halen we op bij de Europese Centrale Bank (via frankfurter.dev); daarbij gaan
        geen persoonsgegevens mee.
      </p>

      <h2>Hoe lang</h2>
      <p>
        Zolang je account bestaat. Verwijder je je account, dan wissen we je gegevens en bestanden
        meteen; het auditlog blijft bestaan zonder koppeling aan jou. Uit back-ups verdwijnen ze
        zodra die volgens hun vaste cyclus vervangen worden.
      </p>

      <h2>Je rechten</h2>
      <ul>
        <li>
          Inzage en overdraagbaarheid: download al je gegevens als bestand via{' '}
          <Link className="text-primary hover:underline" href="/profile">Profiel → Je gegevens</Link>.
        </li>
        <li>Verbetering: pas je gegevens zelf aan in de app.</li>
        <li>Verwijdering: verwijder je account via Profiel → Je gegevens.</li>
        <li>Bezwaar of beperking: mail ons op het adres hierboven.</li>
      </ul>
      <p>
        Ben je het niet eens met hoe we met je gegevens omgaan, dan kun je klacht indienen bij de
        Gegevensbeschermingsautoriteit (gegevensbeschermingsautoriteit.be).
      </p>

      <h2>Beveiliging</h2>
      <p>
        Verbindingen zijn versleuteld (https). Wachtwoorden bewaren we alleen als hash. Na herhaalde
        foute inlogpogingen gaat een account tijdelijk op slot. Een wachtwoordwijziging meldt je op
        al je toestellen af.
      </p>
    </LegalPage>
  )
}

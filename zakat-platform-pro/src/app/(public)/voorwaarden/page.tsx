import type { Metadata } from 'next'
import Link from 'next/link'

import { RELIGIOUS_DISCLAIMER } from '@/config/site'
import { LegalPage, legalIdentity } from '@/modules/legal/identity'

export const metadata: Metadata = { title: 'Gebruiksvoorwaarden' }

export default function TermsPage() {
  const who = legalIdentity()

  return (
    <LegalPage title="Gebruiksvoorwaarden" updated="4 oktober 2026">
      <h2>1. Wie we zijn</h2>
      <p>
        Barakah wordt uitgebaat door {who.name} (ondernemingsnummer {who.vat}), maatschappelijke zetel:{' '}
        {who.address}. Contact:{' '}
        <a className="text-primary hover:underline" href={`mailto:${who.email}`}>{who.email}</a>.
      </p>

      <h2>2. Wat Barakah is — en wat niet</h2>
      <p>
        Barakah is een rekenhulpmiddel. Het berekent je Zakat volgens de methode die jij kiest en
        toont elke stap, met de gebruikte goud- of zilverprijs, wisselkoersen en datum.
      </p>
      <ul>
        <li>{RELIGIOUS_DISCLAIMER}</li>
        <li>
          Barakah is geen financieel, fiscaal of juridisch advies en geen bank of betaaldienst. Er
          gaat geen geld via Barakah; donaties doe je zelf, rechtstreeks aan het goede doel.
        </li>
        <li>
          De uitkomst hangt af van wat jij invult. Controleer je bedragen; wij kunnen niet nagaan of
          ze volledig en juist zijn.
        </li>
      </ul>

      <h2>3. Prijzen en koersen</h2>
      <p>
        Goud- en zilverprijzen en wisselkoersen worden met bron en datum gepubliceerd. Is een prijs
        ouder dan enkele dagen, dan weigert Barakah te rekenen in plaats van een verouderde nisab te
        tonen. Een afgeronde berekening bewaart de prijs waarmee ze gemaakt werd.
      </p>

      <h2>4. Informatie over goede doelen</h2>
      <p>
        Wat we over een goed doel tonen, vermeldt de bron. Een vermelding is geen aanbeveling en
        geen garantie over hoe een organisatie je gift besteedt.
      </p>

      <h2>5. Je account</h2>
      <ul>
        <li>Je bent verantwoordelijk voor je wachtwoord. Meld misbruik meteen via het contactadres.</li>
        <li>Je mag de dienst niet gebruiken om de beveiliging te omzeilen of andermans gegevens te benaderen.</li>
        <li>
          Je kunt je account op elk moment verwijderen via{' '}
          <Link className="text-primary hover:underline" href="/profile">Profiel</Link>. Wij kunnen een
          account afsluiten bij misbruik, na verwittiging waar dat redelijk is.
        </li>
      </ul>

      <h2>6. Prijs van de dienst</h2>
      <p>
        Barakah is in deze versie gratis. Betaalde abonnementen zijn nog niet te koop; worden ze
        later aangeboden, dan gebeurt dat met een eigen prijsvermelding, bestelproces en
        herroepingsrecht. Tot dan betaal je niets.
      </p>

      <h2>7. Beschikbaarheid en aansprakelijkheid</h2>
      <p>
        We doen ons best om Barakah beschikbaar en correct te houden, maar kunnen geen
        ononderbroken werking garanderen. Voor zover de wet het toelaat, zijn we niet aansprakelijk
        voor onrechtstreekse schade. Niets in deze voorwaarden beperkt je rechten als consument.
      </p>

      <h2>8. Privacy</h2>
      <p>
        Hoe we met je gegevens omgaan staat in de{' '}
        <Link className="text-primary hover:underline" href="/privacy">privacyverklaring</Link>.
      </p>

      <h2>9. Klachten</h2>
      <p>
        Klachten kun je melden via{' '}
        <a className="text-primary hover:underline" href={`mailto:${who.email}`}>{who.email}</a>. Lukt het
        niet om er samen uit te komen, dan kun je terecht bij de Consumentenombudsdienst
        (consumentenombudsdienst.be).
      </p>

      <h2>10. Wijzigingen en toepasselijk recht</h2>
      <p>
        Wijzigen we deze voorwaarden wezenlijk, dan melden we dat vooraf in de app. Het Belgische
        recht is van toepassing, onverminderd de dwingende bescherming die je als consument geniet in
        het land waar je woont.
      </p>
    </LegalPage>
  )
}

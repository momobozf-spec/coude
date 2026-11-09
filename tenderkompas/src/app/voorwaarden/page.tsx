import Link from "next/link";
import { EntityBlock, LegalPage } from "@/components/legal-page";
import { legalAddress } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Algemene voorwaarden" };

export default function Voorwaarden() {
  return (
    <LegalPage title="Algemene voorwaarden TenderKompas IT" version="Versie 2026-10-24.">
      <h2>1. Wie wij zijn en toepassing</h2>
      <p>
        TenderKompas IT (“de dienst”) wordt aangeboden door:
      </p>
      <EntityBlock address={legalAddress()} />
      <p>
        Deze voorwaarden gelden voor elke offerte, pilot en elk abonnement op de dienst, uitsluitend voor ondernemingen (B2B). Afwijkingen gelden
        enkel als ze schriftelijk zijn overeengekomen. Algemene voorwaarden van de klant zijn niet van toepassing.
      </p>

      <h2>2. De dienst</h2>
      <ul>
        <li>We volgen de openbare bronnen op die vermeld staan onder “Bronnen en werkelijke dekking” op de website en selecteren opdrachten die inhoudelijk aansluiten bij het bedrijfsprofiel van de klant.</li>
        <li>Elke beoordeling wordt door een mens gecontroleerd vóór publicatie in het klantportaal of in een e-mailselectie.</li>
        <li>
          De dienst is een <strong>inspanningsverbintenis</strong>. We garanderen geen volledigheid van de opvolging, geen toelating tot een procedure en
          geen gunning. Een relevantiescore drukt inhoudelijke aansluiting uit, nooit een winkans.
        </li>
        <li>Deadlines, voorwaarden en documenten in de oorspronkelijke bron hebben altijd voorrang. De klant controleert ze zelf vóór hij beslist om in te schrijven.</li>
      </ul>

      <h2>3. Pilot, prijs en facturatie</h2>
      <ul>
        <li>Prijs en inhoud staan in de offerte of de bevestigingsmail. Prijzen zijn exclusief btw.</li>
        <li>Facturatie gebeurt maandelijks vooraf, elektronisch (Peppol). Betaling binnen 30 dagen na factuurdatum.</li>
        <li>Bij laattijdige betaling kunnen we na schriftelijke herinnering de toegang opschorten. De wettelijke regeling inzake betalingsachterstand bij handelstransacties (wet van 2 augustus 2002) is van toepassing.</li>
      </ul>

      <h2>4. Duur en opzegging</h2>
      <p>
        Een abonnement loopt per kalendermaand en wordt stilzwijgend verlengd. Beide partijen kunnen schriftelijk (e-mail volstaat) opzeggen tegen
        het einde van de lopende maand. Een pilot eindigt op de afgesproken einddatum, tenzij partijen schriftelijk verlengen.
      </p>

      <h2>5. Verplichtingen van de klant</h2>
      <ul>
        <li>Het bedrijfsprofiel correct en actueel houden; de selectie is maar zo goed als het profiel.</li>
        <li>Accounts zijn persoonlijk. Wachtwoorden geheim houden en misbruik onmiddellijk melden.</li>
        <li>Selecties en beoordelingen enkel intern gebruiken; niet doorverkopen of publiek verspreiden.</li>
      </ul>

      <h2>6. Bronnen en intellectuele eigendom</h2>
      <p>
        Aankondigingen komen uit openbare bronnen (o.a. TED, hergebruikt onder de open-dataregels van de Europese Unie) of uit documenten die de
        klant rechtmatig aanlevert. De rechten op de software, selecties, samenvattingen en beoordelingen blijven bij Marhaba Data &amp; AI Agent BV;
        de klant krijgt een niet-exclusief gebruiksrecht voor de duur van het abonnement.
      </p>

      <h2>7. Aansprakelijkheid</h2>
      <p>
        Onze aansprakelijkheid is beperkt tot directe schade en tot het bedrag dat de klant in de drie maanden vóór het schadegeval voor de dienst
        betaalde. We zijn niet aansprakelijk voor indirecte schade, zoals gederfde winst, gemiste opdrachten of kosten van een inschrijving. Deze
        beperkingen gelden niet bij opzet of fraude.
      </p>

      <h2>8. Gegevensbescherming en verwerking in opdracht</h2>
      <p>
        Voor gebruikersaccounts, aanvragen via de website en facturatie zijn wij verwerkingsverantwoordelijke; zie de{" "}
        <Link href="/privacy" className="underline">
          privacyverklaring
        </Link>
        . Voor persoonsgegevens die de klant zelf in zijn bedrijfsprofiel of documenten invoert (bv. namen van medewerkers bij referenties),
        handelen wij als <strong>verwerker</strong> in de zin van artikel 28 AVG. In die rol:
      </p>
      <ul>
        <li>verwerken we die gegevens uitsluitend om de dienst te leveren en volgens de schriftelijke instructies van de klant;</li>
        <li>zijn wie toegang heeft tot vertrouwelijkheid gebonden en nemen we passende technische en organisatorische maatregelen (versleutelde verbindingen, toegangsbeheer per organisatie, gescheiden klantgegevens, back-ups);</li>
        <li>schakelen we enkel de subverwerkers in die in de privacyverklaring staan; nieuwe subverwerkers melden we vooraf, zodat de klant bezwaar kan maken;</li>
        <li>helpen we de klant bij verzoeken van betrokkenen en bij het melden van datalekken, die we zonder onredelijke vertraging melden;</li>
        <li>verwijderen of bezorgen we de gegevens bij het einde van het abonnement, naar keuze van de klant, tenzij de wet bewaring oplegt;</li>
        <li>stellen we de informatie ter beschikking die nodig is om naleving aan te tonen.</li>
      </ul>
      <p>De klant voert geen bijzondere categorieën van persoonsgegevens in en enkel persoonsgegevens die nodig zijn om opdrachten te beoordelen.</p>

      <h2>9. Vertrouwelijkheid</h2>
      <p>Beide partijen houden vertrouwelijke informatie van de andere partij geheim, ook tot twee jaar na het einde van de overeenkomst.</p>

      <h2>10. Wijzigingen</h2>
      <p>We kunnen deze voorwaarden wijzigen. Wezenlijke wijzigingen melden we minstens 30 dagen vooraf per e-mail; de klant kan dan kosteloos opzeggen.</p>

      <h2>11. Toepasselijk recht</h2>
      <p>Op deze voorwaarden is het Belgisch recht van toepassing. Geschillen behoren tot de bevoegdheid van de Nederlandstalige rechtbanken te Brussel.</p>
    </LegalPage>
  );
}

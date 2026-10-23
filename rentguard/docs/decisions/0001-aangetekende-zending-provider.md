# ADR 0001 — Provider voor aangetekende zending

- **Datum:** 2026-08-29
- **Status:** Aanvaard (implementatie: interface + één adapter, `CONFIGURATION REQUIRED`)

## Context

De waarborg-terugeis staat of valt met een ingebrekestelling die aantoonbaar
verzonden én ontvangen is. In België is daarvoor klassiek de aangetekende
zending via bpost gebruikt. Sinds eIDAS bestaat er een elektronisch equivalent:
de **gekwalificeerde elektronische aangetekende dienst (QERDS)**, die dezelfde
rechtsgevolgen heeft als papieren aangetekende post — mits uitgevoerd door een
*gekwalificeerde* verlener op de EU Trusted List, met correcte identificatie van
de geadresseerde.

## Onderzochte opties (2026-08-29)

| Provider | Type | API | Opmerking |
|---|---|---|---|
| **Unifiedpost (Digitally Registered)** | QTSP onder eIDAS | Upload via API of portaal | Belgische speler, gevestigd in de markt |
| **EasyPost (easypost.eu)** | QTSP onder eIDAS, extern geauditeerd | API | Positioneert zich expliciet als QERDS |
| **DigiConnect / Aangetekende.email** | QERDS onder eIDAS | API of sFTP | Biedt daarnaast een **hybride** route: digitaal aangeleverd, geprint en als klassieke aangetekende zending aan bpost aangeboden |
| **bpost** | Klassieke aangetekende post | Geen publiek zelfbedienings-API voor losse aangetekende zendingen gevonden | Wel loket- en zakelijke oplossingen |

Bronnen (geraadpleegd 2026-08-29):

- <https://www.unifiedpost.be/solutions/documents/electronic-registered-mail>
- <https://www.easypost.eu/en/digital-registered-mail-qerds>
- <https://aangetekende.email/DefaultEN.aspx>

**Belangrijke onzekerheid.** Geen van deze providers kon in dit onderzoek op
prijs, contractvoorwaarden of API-documentatie geverifieerd worden zonder
commerciële aanvraag. De kwalificatie als QTSP moet vóór productie geverifieerd
worden tegen de **officiële EU Trusted List**
(<https://eidas.ec.europa.eu/efda/tl-browser/>), niet tegen de marketingpagina
van de provider.

## Beslissing

1. We bouwen een provider-agnostische interface `RegisteredMailProvider` met
   drie operaties: `send`, `getStatus`, `getProof`.
2. We implementeren **één** adapter volledig: **DigiConnect / Aangetekende.email**,
   omdat die als enige zowel de zuiver digitale QERDS-route als de **hybride
   route naar fysieke bpost-aangetekende post** aanbiedt. Dat dekt het
   realistische geval waarin een Brusselse verhuurder geen elektronische
   aangetekende zending aanvaardt.
3. De adapter is `CONFIGURATION REQUIRED`: zonder credentials is hij niet
   selecteerbaar in de UI, en de app toont dat expliciet in plaats van te doen
   alsof verzending werkt.
4. Er is **altijd** een gratis fallback `SELF_SERVICE`: de gebruiker downloadt de
   PDF en krijgt een stappenplan om zelf aangetekend te versturen via het
   bpost-loket. Deze route is beschikbaar zonder enige integratie.

## Gevolgen

- De term "aangetekend" verschijnt in de UI **uitsluitend** bij de kanalen
  `QERDS` en `HYBRID_POST`, en enkel wanneer de provider daadwerkelijk
  geconfigureerd is en de zending is geslaagd.
- Verzending via Resend (gewone e-mail) draagt in de UI het label
  "gewone e-mail — geen bewijs van ontvangst".
- `legal_notices.sent_via` legt het gebruikte kanaal vast; `provider_reference`
  bewaart het providerbewijs. Zonder providerbewijs blijft de status `SENT` en
  wordt ze nooit automatisch `DELIVERED`.
- Vóór lancering: kwalificatie verifiëren op de EU Trusted List en het resultaat
  hier bijwerken.

## Verworpen alternatieven

- **Zelf een "aangetekende" e-mail bouwen** met read-receipts of hashing:
  juridisch waardeloos en misleidend voor de gebruiker.
- **Meerdere adapters half implementeren**: strijdig met de regel "geen mocks in
  productieflows". Eén werkende adapter, de rest achter dezelfde interface later.

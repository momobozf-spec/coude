# Integraties

Wat werkt, wat jij moet configureren, en wat er niet is.

Laatst bijgewerkt: **2026-08-29** (einde Fase 0).

## Legenda

| Status | Betekenis |
|---|---|
| **LIVE** | Werkt, zonder configuratie van jouw kant |
| **CONFIGURATION REQUIRED** | Volledig gebouwd, wacht op credentials |
| **NOT AVAILABLE** | Bewust niet gebouwd — met reden |

---

## Overzicht

| Integratie | Status | Zonder dit werkt niet | Zonder dit werkt wél |
|---|---|---|---|
| Supabase (Postgres, Auth, Storage) | **CONFIGURATION REQUIRED** | Alles | Niets |
| Vision-analyse (Anthropic Claude) | **CONFIGURATION REQUIRED** | Automatische classificatie slijtage/schade | Uitcheckwizard, handmatige classificatie, vergelijkend rapport |
| Resend (transactionele e-mail) | **CONFIGURATION REQUIRED** | Uitnodiging verhuurder, herinneringen | Alle rapporten en brieven als download |
| Stripe (Checkout, Billing, Portal) | **CONFIGURATION REQUIRED** | Betaalde formules | Gratis check-in-rapport |
| Aangetekende zending (DigiConnect) | **CONFIGURATION REQUIRED** | Verzending via de app | "Verstuur zelf"-fallback met stappenplan |
| Sentry | **CONFIGURATION REQUIRED** | Foutopvolging in productie | Alles; fouten gaan naar de serverlogs |
| Officiële huurrooster-berekening | **NOT AVAILABLE** | — | Begeleide flow naar de officiële tool |
| Herstelkosten-referentietabel | **NOT AVAILABLE** | Automatische kostenbandbreedte | Kostenverdeling op basis van een offerte die de gebruiker invoert |

---

## Supabase — CONFIGURATION REQUIRED

**Wat je moet doen**

1. Maak een project op supabase.com.
2. Zet `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Draai de migraties:

   ```
   supabase link --project-ref <ref>
   supabase db push
   ```

De migraties maken drie **private** storage buckets aan: `inspection-photos`,
`reports` en `contracts`. Objectpaden beginnen met het user-id, en het
storage-beleid leidt de eigenaar daaruit af. Zet deze buckets nooit op publiek.

**Wat je moet controleren na het aanmaken**

- RLS staat aan op alle tabellen (migratie `20260829000002_rls.sql`).
- De service role key staat nergens in clientcode. Hij wordt alleen gebruikt in
  `createSupabaseAdminClient()`.

---

## Vision-analyse (Anthropic Claude) — CONFIGURATION REQUIRED

**Wat je moet doen** — zet `ANTHROPIC_API_KEY`.

**Wat het doet** — vergelijkt een foto bij intrek met dezelfde foto bij vertrek
en classificeert het verschil als normale slijtage, schade of onduidelijk.

**Wat het bewust niet doet**

- Geen kostenschatting. Bedragen komen uit `repair_cost_reference`, nooit uit het
  model.
- Geen juridische tekst en geen wetsartikelen.
- Bij een zekerheid onder `VISION_CONFIDENCE_THRESHOLD` (standaard 0,70) wordt de
  uitkomst geforceerd naar `UNCLEAR`.
- De gebruiker bevestigt of corrigeert elke classificatie. Het rapport toont het
  gebruikersoordeel; de AI-analyse staat in de bijlage.

**Model en kosten — beslissing die jij kunt bijstellen**

Standaard staat `VISION_MODEL=claude-opus-5`. Per fotopaar gaat er één aanroep
met twee afbeeldingen naar het model; verbruik wordt per analyse gelogd in
`vision_usage`.

Ruwe orde van grootte bij veertig fotoparen in één uitcheckdossier: enkele
tienden van een euro tot ongeveer een euro aan modelkosten, afhankelijk van de
resolutie van de foto's. Dat past ruim binnen Deposit Recovery (€ 29,99).

Wil je goedkoper: zet `VISION_MODEL=claude-sonnet-5`. Dat scheelt ongeveer een
factor twee à drie op de modelkost. Wij hebben dat **niet** als standaard
genomen omdat een verkeerde classificatie de gebruiker rechtstreeks geld kost —
maar het is jouw afweging, en de code hoeft er niet voor te wijzigen.

Foto's worden vóór verzending verkleind, wat de kost per aanroep drukt.

Zie `docs/decisions/0004-vision-provider.md`.

---

## Resend — CONFIGURATION REQUIRED

**Wat je moet doen** — zet `RESEND_API_KEY` en `RESEND_FROM_EMAIL`, en verifieer
het verzenddomein bij Resend.

**Waarvoor** — bevestigingsmails, de uitnodiging aan de verhuurder om het rapport
mee te ondertekenen, en herinneringen over de waarborgtermijn.

**Belangrijk** — dit is gewone e-mail. In de UI heet dit kanaal
"Gewone e-mail — geen bewijs van ontvangst". Het woord "aangetekend" mag er niet
bij staan. Zie `docs/decisions/0003-bewijswaarde-framing.md`.

---

## Stripe — CONFIGURATION REQUIRED

**Wat je moet doen**

1. Zet `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` en
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Activeer **Bancontact** naast kaart in het Stripe-dashboard. In België is
   Bancontact voor veel gebruikers het enige betaalmiddel dat ze gewend zijn.
3. Maak de prijzen aan en zet de price-id's in de tabel `pricing_config`.
   Bedragen zijn admin-configureerbaar; ze staan niet in de code.

**Formules** (bedragen in `pricing_config`, aanpasbaar via de admin)

| plan_key | Soort | Bedrag |
|---|---|---|
| `tenant_protect` | abonnement | € 4,99 / maand |
| `deposit_recovery` | eenmalig | € 29,99 |
| `relocation_pass` | eenmalig | € 49,99 |
| `free_checkin` | gratis | € 0 |

Toegangsrechten worden uitsluitend server-side toegekend, in `entitlements`. De
client kan ze lezen, niet schrijven. Webhooks controleren de handtekening en
worden idempotent verwerkt via `stripe_events`.

---

## Aangetekende zending — CONFIGURATION REQUIRED

**Wat je moet doen**

1. Sluit een contract met een gekwalificeerde verlener. Onderzochte kandidaten:
   Unifiedpost, EasyPost, DigiConnect / Aangetekende.email.
2. **Verifieer de kwalificatie op de EU Trusted List**
   (<https://eidas.ec.europa.eu/efda/tl-browser/>), niet op de website van de
   provider zelf.
3. Zet `REGISTERED_MAIL_PROVIDER=digiconnect` plus `REGISTERED_MAIL_API_URL`,
   `REGISTERED_MAIL_API_KEY` en `REGISTERED_MAIL_ACCOUNT_ID`.

**Zonder configuratie** blijft de fallback beschikbaar: de gebruiker downloadt de
PDF en krijgt een stappenplan om zelf aangetekend te versturen via het
bpost-loket. Gratis, en de gebruiker houdt het verzendingsbewijs zelf bij.

**Kanalen in de UI**

| Kanaal | Label | Aangetekend? |
|---|---|---|
| `SELF_SERVICE` | Zelf aangetekend versturen via het bpost-loket | Ja, door de gebruiker zelf |
| `EMAIL_PLAIN` | Gewone e-mail — geen bewijs van ontvangst | **Nee** |
| `QERDS` | Elektronische aangetekende zending | Ja, mits gekwalificeerde verlener |
| `HYBRID_POST` | Aangetekende brief per post | Ja |

Zie `docs/decisions/0001-aangetekende-zending-provider.md`.

---

## Sentry — CONFIGURATION REQUIRED

Zet `SENTRY_DSN`. Zonder DSN gaan fouten naar de serverlogs.

**Let op bij de configuratie**: foto's, contracten en adresgegevens mogen nooit
in een foutrapport belanden. Scrub `merge_fields`, `exif` en alle storage-paden.

---

## Officiële huurrooster-berekening — NOT AVAILABLE

**Waarom niet.** Het Brussels Gewest publiceert wél welke variabelen in het
indicatieve huurrooster zitten en dat er een marge van 10 % rond de mediaan
geldt, maar **niet** de vergelijkingen, basisprijzen per m² of
wijkcoëfficiënten. Die zitten in de onderliggende ULB-IGEAT-studie.

De formule die op commerciële sites circuleert, is niet door het Gewest
gepubliceerd. Ze overnemen zou getallen opleveren die officieel niet te
verantwoorden zijn.

**Wat er in de plaats komt.** Een begeleide flow: de app verzamelt de kenmerken
van de woning, stuurt de gebruiker naar de officiële tool op loyers.brussels,
en vergelijkt daarna de werkelijke huurprijs met het bekomen referentiebedrag.

Zie `docs/decisions/0002-huurrooster-geen-eigen-berekening.md`.

---

## Nog te doen vóór lancering

Deze punten zijn geen integratie maar blokkeren wel een echte lancering:

- [ ] **Juridische review** van alle brieftemplates. Ze staan nu op
      `PLACEHOLDER` en de app toont dat aan de gebruiker.
- [ ] **Artikelteksten verifiëren** in de geconsolideerde Brusselse
      Huisvestingscode (art. 220, 224/2, 248, 249). De Justel-pagina leverde in
      Fase 0 geen artikelteksten; zie `docs/juridisch.md` §0.
- [ ] **EPB-indexatieregels uitklaren** — bronnen spreken elkaar tegen; de regel
      staat op `UNVERIFIED` en draagt geen enkele brief.
- [ ] **`repair_cost_reference` vullen** met onderbouwde herstelkosten en bron.
- [ ] **Privacyverantwoording** afwerken en laten nakijken (`docs/privacy.md`).

---

## Herstelkosten-referentietabel — NOT AVAILABLE

**Waarom niet.** Wij hebben geen bron gevonden die indicatieve herstelkosten
voor Belgische huurwoningen publiceert op een manier die wij kunnen
verantwoorden. Zelf bedragen bedenken zou precies zijn wat de opdracht verbiedt.

**Wat er in de plaats komt.** De tabel `repair_cost_reference` bestaat en is
admin-beheerd, maar staat leeg. De kostenverdeling werkt zonder haar: de
gebruiker voert een bedrag uit een **offerte** in, en de app verdeelt dat volgens
de Waalse slijtagegrille (40 posten, officieel, wél aanwezig). Zolang er geen
bedrag is, toont de app geen bedrag.

**Om dit te activeren:** vul `repair_cost_reference` met posten waarvan je de
bron kunt noemen. Elke rij vraagt `source_name` en bij voorkeur `source_url`.

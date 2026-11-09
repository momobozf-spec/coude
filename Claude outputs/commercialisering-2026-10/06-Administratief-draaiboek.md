# 06 — Administratief draaiboek (TenderKompas & Kleine Qamar)

*Status: werkdocument, **niet juridisch of fiscaal gevalideerd**. Punten gemarkeerd met ⚖️ eerst laten bevestigen door je boekhouder of een jurist.*

**Rollen:** **M** = jij (Mohamed) · **C** = Claude (voorbereiden, bouwen, controleren, concepten) · **E** = externe specialist (boekhouder, jurist, imam/islamleerkracht, illustrator).
Claude verstuurt, publiceert of betaalt niets zonder jouw expliciete opdracht.

## 1. Verkopende onderneming en bedrijfsgegevens

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| Kies per product de verkopende BV. **Voorstel: beide onder Marhaba Data & AI Agent BV** (BE1003552102): TenderKompas sluit aan bij je data-consultancy, en één BV = één boekhouding/één D-U-N-S. Layali gebruikt in de code "Marhaba Cooperation BV" — dat is een andere naam; kies bewust. ⚖️ Check of het maatschappelijk doel in de KBO "software/SaaS en digitale content" dekt (je doel omvat data/AI-consultancy + e-commerce). | M + E | nee | 1 u + boekhouder |
| D-U-N-S-nummer aanvragen (verplicht voor Apple-organisatie-account; gratis via Dun & Bradstreet) | M | nee | 0,5 u; doorlooptijd tot enkele weken |
| Domeinen + zakelijk e-mailadres op dat domein (Apple vereist e-mail en werkende website op eigen domein) | M (kopen), C (DNS/SPF/DKIM-instructies) | deels | 1 u |
| Wettelijke vermeldingen op elke site: naam BV, adres zetel, ondernemingsnummer, btw-nummer, e-mail | C (template), M (gegevens) | ja (component) | 0 u na opzet |
| Belangenconflict: jij werkt freelance voor Digitaal Vlaanderen (aanbestedende overheid). Contract via Cronos nakijken op concurrentie-/exclusiviteitsclausules; TenderKompas uitsluitend op publieke data. ⚖️ | M + E | nee | 1 u |

## 2. Betalingen, abonnementen, opzeggingen en refunds

### TenderKompas (B2B, Stripe)
| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| Stripe-account op de BV; producten Solo/Team, maand- en jaarprijzen (excl. btw), Stripe Billing + klantportaal (kaart wijzigen, factuurhistoriek, opzeggen) | C bouwt, M activeert account (KYC) | ja | 2 u eenmalig |
| Btw-nummer van klant verplicht bij checkout (B2B); BE-klant: 21%; EU-klant met geldig btw-nummer: verlegging ⚖️ | C (Stripe Tax of eigen logica) | ja | – |
| Pilot 30 dagen zonder kaart → aan het einde een betaallink; geen automatische conversie zonder kaart | C | ja | – |
| Opzeggen: maandelijks opzegbaar via klantportaal; toegang loopt tot einde betaalde periode | C | ja | – |
| Refunds: B2B heeft geen wettelijk herroepingsrecht; beleid in AV: "geen pro-rata terugbetaling, behalve bij aantoonbare dienstonderbreking > 7 dagen" (voorstel) ⚖️ | M beslist, C voert uit in Stripe | deels | 0–1 u/maand |
| Mislukte betalingen: Stripe Smart Retries + automatische mails; na 3 mislukte pogingen account op alleen-lezen | C | ja | – |

### Kleine Qamar (B2C, App Store / Google Play)
| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| In-app abonnementen in App Store Connect en Play Console (Qamar Plus maand/jaar, één abonnementsgroep, gezinsdeling aan) | C bereidt voor, M (account-eigenaar) klikt goed | deels | 2 u eenmalig |
| Apple Small Business Program aanvragen (15% i.p.v. 30%) | M | nee | 0,5 u |
| Opzeggen en refunds lopen volledig via Apple/Google (zij zijn verkoper aan de consument). In de app: knop "Abonnement beheren" achter ouderlijke poort + uitleg in FAQ | C | ja | 0 u |
| Supportvragen over aankopen doorverwijzen naar store-refundprocedure (standaardantwoord) | C (template), M (versturen) | deels | ± 0,5 u/maand |

## 3. Facturatie en boekhoudexport

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| **Peppol:** sinds 1-1-2026 zijn B2B-facturen tussen Belgische btw-plichtigen elektronisch via Peppol verplicht. Een Stripe-PDF-factuur volstaat dan niet voor BE-klanten. ⚖️ Oplossing: Stripe als betaalbron + facturen aanmaken in een Peppol-geschikt boekhoudpakket (via koppeling of maandelijkse import). Je `administratie.skill` voorziet al Peppol. | C (koppeling/export), E (keuze pakket) | ja (koppeling) | 1 u/maand controle |
| Apple/Google-opbrengsten: de stores verkopen aan de consument en betalen jou maandelijks uit (Apple Distribution International / Google — Ierse entiteiten). ⚖️ Boeking vermoedelijk als dienst aan EU-onderneming (verlegging, opnemen in btw-aangifte en intracommunautaire listing) — laten bevestigen. | E bevestigt, C maakt boekingsregel | ja | – |
| Maandexport: Stripe balance report + payouts, App Store Connect financial report, Play Console earnings report → één CSV per maand voor de boekhouder | C (script/notebook) | ja | 0,5 u/maand |
| Kosten (hosting, Apple, domein, ads) op de BV-kaart; facturen automatisch naar boekhoudmailbox doorsturen | M (instellen), C (regels) | ja | 0,5 u/maand |

## 4. Afstemming omzet, kosten en uitbetalingen

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| Maandelijkse reconciliatie: Stripe-charges ↔ facturen ↔ bankpayouts; store-rapporten ↔ bankontvangsten (in EUR, let op wisselkoers bij Apple) | C (script dat verschillen markeert) | ja | 0,5 u/maand nakijken |
| Maandrapport: MRR, nieuwe klanten, opzeggingen, kosten t.o.v. model (tabblad "Samenvatting") | C | ja | 0,25 u/maand lezen |
| Kwartaal: btw-aangifte en listing — boekhouder | E | – | volgens boekhouder |

## 5. Klantenservice en klachten

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| Eén supportadres per product (bv. support@…); antwoordtermijn: 2 werkdagen (geen 24/7) | M | – | – |
| Standaardantwoorden (FAQ uit 04/05-materialen) als e-mailtemplates; Claude stelt antwoordconcepten op die jij nakijkt | C concept, M verstuurt | deels | TK: ± 0,5 u/klant/maand (model Basis); KQ: ± 0,2 u per 100 gebruikers |
| Klachtenregister (datum, klant, probleem, oplossing) — eenvoudige sheet | C | ja | – |
| Escalatie: inhoudelijke klacht over religieuze inhoud → verhaal tijdelijk offline + reviewer raadplegen (zie §8) | M + E | nee | per geval |

## 6. Privacy, voorwaarden, toestemming, gegevensverwijdering

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| **TK:** privacyverklaring, algemene voorwaarden (B2B), cookiebeleid (enkel functionele cookies), verwerkersovereenkomst als klanten eigen documenten uploaden. Concepten door C, review door jurist ⚖️ | C + E | – | eenmalig |
| **KQ:** geen kindaccount; geen persoonsgegevens van het kind; geen third-party analytics of ads (Apple Kids / Google Families); voortgang enkel lokaal op het toestel. Privacyverklaring gericht aan ouders, ook in het Frans. ⚖️ | C + E | – | eenmalig |
| Store-privacylabels (Apple "privacy nutrition label", Google Data safety) correct invullen | C concept, M dient in | – | 1 u eenmalig |
| Wachtlijst (Brevo): double opt-in, uitschrijflink, enkel e-mail van ouder | M (Brevo-instelling), C (formulier) | ja | – |
| Gegevensverwijdering: TK — knop "account verwijderen" + export; KQ — "voortgang wissen" in ouderinstellingen; verzoeken via e-mail binnen 30 dagen | C | ja | 0 u bij weinig verzoeken |
| Verwerkingsregister (art. 30 AVG) bijhouden | C concept, M | – | 1 u eenmalig |

## 7. Onderhoud, back-ups, monitoring

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| TK: dagelijkse database-back-up (Render Postgres back-ups of pg_dump naar opslag), maandelijkse hersteltest | C | ja | 0,25 u/maand |
| TK: monitoring (uptime-check, foutlogging), alert bij mislukte TED-import of lege digest | C | ja | – |
| TK: wekelijkse controle "digest verzonden + aantal publicaties" (automatisch rapport) | C | ja | 0,25 u/week |
| KQ: app-updates bij nieuwe iOS/Android-versies (1–2× per jaar); store-reviews beantwoorden | C bouwt, M dient in | deels | model Basis: 6 u/maand onderhoud |
| Afhankelijkheden updaten en beveiligingsscans (maandelijks) | C | deels | 1 u/maand |
| Geheimen (API-keys) enkel in de omgevingsvariabelen van de host, nooit in de repo; `.env`-bestanden uit git houden | C | ja | – |

## 8. Inhoudelijke en religieuze controle (Kleine Qamar)

| Taak | Wie | Automatiseerbaar | Restwerk |
|---|---|---|---|
| Vind 1 reviewer (imam of islamleerkracht) die NL én FR leest, en spreek af: wat wordt nagekeken, vergoeding (onbekend → offerte), of de naam vermeld mag worden | M | nee | 2–4 u eenmalig |
| Reviewworkflow: per verhaal status *concept → nagelezen (naam, datum) → gepubliceerd*; app toont enkel nagelezen verhalen | C (veld + filter in content) | ja | – |
| Vaste regels: profeten en sahaba worden niet afgebeeld; Arabische termen met transliteratie; bronnen bij uitspraken over sunnah | C (checklist), E (oordeel) | deels | – |
| Doorlopend: 4 nieuwe verhalen per kwartaal → 1 reviewronde per kwartaal | C (concepten), E (review), M (eindkeuze) | deels | model Basis: ± 5 u/maand eigen tijd |
| Claim "nagelezen door een imam" pas gebruiken als het waar is, met naam en datum | M | – | – |

## 9. Samenvatting restwerk per maand (na lancering, Basis-scenario)

| | TenderKompas (20 klanten) | Kleine Qamar (500 betalers) |
|---|---|---|
| Support | ± 10 u | ± 1 u |
| Beheer/onderhoud | ± 8 u | ± 6 u |
| Content | – | ± 5 u |
| Marketing/verkoop | ± 12 u | ± 12 u |
| Administratie (export, controle) | ± 1–2 u | ± 1 u |
| **Totaal** | **± 30 u** | **± 34 u** |

*Bron: tabbladen TenderKompas/KleineQamar in `03-Financieel-model.xlsx` (rij "Eigen uren"); administratie-uren uit dit draaiboek komen erbovenop.*

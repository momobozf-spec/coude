# Beveiliging: wat ik heb nagekeken, hersteld, en wat jij zelf moet doen

*20 oktober 2026.* Er staan geen geheime waarden in dit document. Ik heb geen
toegang tot je accounts bij Render, Railway, Vercel, Firebase, ANWB of Anthropic.
Wat daar staat, kon ik dus **niet** controleren of intrekken.

## 1. Wat ik heb gescand

- Volledige git-geschiedenis van `coude` en `marktonderzoek`, en de huidige
  code van `immoradar`, `muslim-life` en `barakah2`, op API-sleutels,
  Stripe-/webhooksleutels, privésleutels, databank-URL's met wachtwoord en sessiecookies.
- Uitkomst:
  - **Echte gegevens in een publieke repo:** de ANWB-API-sleutel en de
    Firebase-webconfig in `brandstofprijzen.html` (sinds commit `0a3f2b7`), en
    `noor-tracker/cookies.txt` met lokale sessiecookies.
  - **Placeholders, geen lek:** de Anthropic-sleutel in de oude
    `resume-roaster/.env.example` (`sk-ant-xxx…`), de Neon-URL in de documentatie
    van `marktonderzoek`, en de Stripe-sleutels in de tests van `muslim-life`.
  - **Standaardwachtwoorden in publieke code:** de seed-admin van `jamal-jamila` en `luxe-store`; de standaard-admin van `marktonderzoek` (privérepo).
  - **Open endpoints:** `printable-generator` (`/api/admin/stats` zonder login, en
    elke admin-route open als `ADMIN_PASSWORD` ontbrak), `resume-roaster` (geen
    limiet op betaalde AI-aanroepen) en de Hikmar-backend (alles open, `/status`
    toonde welke sleutels gezet zijn).

## 2. Wat ik in de code heb hersteld

Op branch `ccr-02331f64-4fd2md`, nog **niet** gemerged:

| Repo / app | Herstel | Getest |
|---|---|---|
| coude / printable-generator | Eén admincheck voor alle admin-routes, dicht bij ontbrekend wachtwoord, tijdsveilige vergelijking, minimaal 16 tekens; `/api/admin/stats` beschermd; adminpagina vraagt het wachtwoord | `tsc` schoon |
| coude / resume-roaster | Maximaal 5 roasts per IP per uur en 200 per dag (instelbaar), geen open CORS, invoer afgekapt, onleesbaar AI-antwoord netjes afgehandeld, eerlijke melding dat het cv naar Anthropic gaat | lokaal: 5× doorgelaten, daarna 429; geen CORS-headers |
| coude / brandstofprijzen (beide kopieën) | ANWB-sleutel en ANWB-koppeling verwijderd; willekeurig verzonnen prijzen (LU en terugval) verwijderd: zonder echte bron toont de app niets | JS-syntaxcontrole |
| coude / Hikmar-backend | Gedeelde toegangscode (`HIKMAR_ACCESS_TOKEN`) op `/chat` en `/smart-home`, limiet per minuut, maximale lengte van bericht en geschiedenis, `/status` toont geen sleutels meer, geen foutdetails meer naar buiten, CORS alleen voor ingestelde domeinen | FastAPI-testclient: 401 zonder code, 413 te lang, 429 limiet, 503 niet ingesteld |
| coude / noor-tracker | `cookies.txt` verwijderd en genegeerd | — |
| coude / jamal-jamila, luxe-store | Het publieke standaard-adminwachtwoord werkt alleen nog op een lokale database; seeden op Turso of in productie vereist `SEED_ADMIN_PASSWORD` | — |
| marktonderzoek | Geen standaard-admin of -sessiegeheim meer (productie start niet zonder); geen open CORS; de enquête belooft geen anonimiteit meer bij een e-mailadres; de vraag over religieuze praktijk is optioneel | lokaal: start weigert zonder variabelen |

**Wat een codefix niet oplost:** de oude waarden staan nog in de git-geschiedenis
(publiek bij `coude`). Intrekken of roteren is de echte oplossing.

> **Aanvulling (tweede ronde):** de publieke repo `clodeproject1` is een oudere
> kopie van `coude`. Ze bevat dezelfde ANWB-sleutel en Firebase-config
> (`brandstofprijzen.html`, `sites/brandstofprijzen/index.html`) en dezelfde
> kwetsbare admin-routes van printable-generator. Ik heb die repo **niet**
> aangepast. Maak haar privé of archiveer ze, en voer de acties hieronder ook
> voor eventuele deploys vanuit die repo uit.

## 3. Wat jij zelf moet doen

In volgorde van urgentie.

### 3.1 ANWB-API-sleutel (publiek op GitHub sinds maart 2026)
- [ ] Heb je de sleutel zelf aangevraagd bij ANWB? Trek hem dan in bij ANWB en vraag er geen nieuwe aan voor gebruik in de browser.
- [ ] Heb je hem van de ANWB-site of -app overgenomen? Dan kan je hem niet roteren. Gebruik hem niet meer (de code doet dat nu niet meer) en ga ervan uit dat dit buiten de voorwaarden van ANWB viel.

### 3.2 Firebase (project van brandstofprijzen)
De web-API-sleutel van Firebase is per ontwerp publiek. De bescherming zit in de regels:
- [ ] Google Cloud Console → APIs & Services → Credentials → de browsersleutel:
      beperk hem tot de HTTP-referrers van je eigen domein(en) en tot de Firebase-API's.
- [ ] Firebase Console → Firestore → Rules: controleer dat elke gebruiker alleen
      `users/{uid}` kan lezen en schrijven. **Die regels staan niet in de repo; ik heb ze niet kunnen zien.**
- [ ] Firebase Console → Authentication → Settings → Authorized domains: alleen je eigen domeinen.

### 3.3 Sessiegeheim van noor-tracker
De cookies in `cookies.txt` waren voor `localhost` en zijn sinds mei 2026 verlopen.
- [ ] Vervang lokaal `AUTH_SECRET`/`NEXTAUTH_SECRET` in `noor-tracker/.env`. Daarmee is elk oud token ongeldig.
- [ ] Heb je dat geheim ooit ook in een online omgeving gebruikt? Roteer het daar dan ook.

### 3.4 marktonderzoek (draait mogelijk op Render)
- [ ] Render → service *marktonderzoek* → Environment: zet `ADMIN_PASS` (≥ 12 tekens,
      nieuw, nergens anders gebruikt) en controleer `SESSION_SECRET`. **Doe dit
      vóór je de branch merget**: de nieuwe code weigert in productie te starten zonder die variabelen.
- [ ] Gebruikte je het oude standaardwachtwoord ook elders (bv. als admin van
      Layali of in een ander account)? Verander het daar.
- [ ] Bekijk wie toegang had tot de antwoorden: de antwoorden bevatten bijzondere
      gegevens (religie, achtergrond). Zag iemand ze zonder recht, beoordeel dan of het een datalek is.

### 3.5 Admin-wachtwoorden van de webshops
`upsert` in de seed wijzigt bestaande wachtwoorden **niet**.
- [ ] Is jamal-jamila (Layali) of luxe-store ooit online geseed met het
      standaardwachtwoord? Verander het admin-wachtwoord dan nu in de app of de
      database. Doe hetzelfde voor de demo-klant `klant@layali.shop`, of verwijder die.

### 3.6 printable-generator
- [ ] Zet in de online omgeving (Vercel/Render) `ADMIN_PASSWORD` op een nieuwe waarde van ≥ 16 tekens. Zonder die variabele zijn de admin-routes nu dicht.
- [ ] Draaide de app online? `/api/admin/stats` gaf dan namen en e-mailadressen
      van gebruikers vrij aan iedereen. Bekijk de logs van je host op verzoeken
      naar `/api/admin/stats` door anderen dan jijzelf. Zijn er zulke verzoeken,
      beoordeel dan of je dit binnen 72 uur moet melden bij de GBA.

### 3.7 AI-sleutels (resume-roaster, Hikmar)
De sleutels zelf zijn niet gelekt, maar de endpoints waren open.
- [ ] Anthropic Console (en OpenAI, Google AI Studio voor Hikmar): bekijk het
      verbruik sinds de deploy. Bij onverklaard verbruik: roteer de sleutel.
- [ ] Stel bij elke aanbieder een maandelijkse uitgavenlimiet in.
- [ ] Hikmar online? Zet `HIKMAR_ACCESS_TOKEN` (≥ 24 willekeurige tekens) vóór je de nieuwe code deployt. De PWA vraagt er één keer naar.

### 3.8 GitHub en accounts
- [ ] Zet **secret scanning en push protection** aan voor je publieke repo's
      (Settings → Code security). Ook voor `immoradar`: die is **publiek**, terwijl het je commerciële product is.
- [ ] Overweeg `immoradar` (en `coude`) **privé** te maken. Iedereen kan nu je hele product kopiëren.
- [ ] Tweestapsverificatie aan op GitHub, Render, Railway, Vercel, Firebase/Google en Anthropic.
- [ ] Wil je de oude waarden ook uit de git-geschiedenis van `coude` halen? Dat
      vraagt een herschreven geschiedenis en een force-push naar `main`. Dat heb
      ik **niet** gedaan; het is jouw beslissing. Na het roteren is het niet meer nodig.

## 4. Na het mergen

| Repo | Branch | Wat je moet zetten vóór de deploy |
|---|---|---|
| coude | `ccr-02331f64-4fd2md` | `ADMIN_PASSWORD` (printable-generator), `HIKMAR_ACCESS_TOKEN` (Hikmar) |
| marktonderzoek | `ccr-02331f64-4fd2md` | `ADMIN_PASS`, `SESSION_SECRET` |
| immoradar | `ccr-02331f64-4fd2md` | niets nieuws; zie `docs/pilot/pilot-checklist.md` |

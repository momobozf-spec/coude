# Noor Club

Elke maand een Islamitisch leerpakket voor kinderen van 4 tot 9 jaar: printbare
werkbladen, een verhaal, een ouderhandleiding en vijf spellen, met een
voortgangspaspoort per kind.

Next.js 15 (App Router) · TypeScript strict · Prisma 6 · PostgreSQL · NextAuth v5
· next-intl · Stripe · Tailwind · Resend

---

## Aan de slag

Zonder iets te installeren — geen Postgres, geen Docker, geen account. Open
twee terminals:

```bash
# terminal 1 — database (laat open staan)
npm install
npm run db:dev

# terminal 2 — schema + content + app
npm run db:setup     # prisma db push + seed
npm run dev
```

Ga naar **http://localhost:3000** en log in met **demo@noorclub.app** /
**Test1234!** (twee kinderen: Yusuf 4-6, Maryam 7-9).

`npm run db:dev` draait PostgreSQL als WebAssembly in Node, met de data in
`.pgdata/`. Dat is puur een ontwikkelgemak; de `.env` die erbij hoort staat al
goed. Voor productie zet je `DATABASE_URL` en `DIRECT_URL` op Supabase en raak
je dit script nooit aan.

> **Stop hem met Ctrl+C, niet met een force-kill.** Wordt het proces hard
> afgebroken terwijl het schrijft, dan raakt `.pgdata/` beschadigd en weigert
> PGlite daarna te starten met "failed to initialize properly". Herstellen is
> simpel maar je bent je lokale data kwijt:
>
> ```bash
> rm -rf .pgdata && npm run db:dev   # in terminal 1
> npm run db:setup                   # in terminal 2
> ```

### Wat werkt zonder Stripe-sleutels

Registreren, kindprofielen, het gratis pakket, alle vijf de spellen, XP, streak,
badges, het paspoort en het ouderdashboard. Het betaalde pakket toont netjes de
paywall. Vul `STRIPE_*` in `.env` in en herstart om ook af te rekenen; voor
webhooks lokaal: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

| Script | Doet |
|---|---|
| `npm run dev` | Ontwikkelserver |
| `npm run build` | `prisma generate && next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:dev` | Lokale PostgreSQL (WebAssembly), geen installatie nodig |
| `npm run db:setup` | Schema pushen en `content/` inladen |
| `npm run seed` | Valideert en laadt `content/` |
| `npm run db:studio` | Prisma Studio |
| `node scripts/generate-placeholders.mjs` | Genereert de placeholder-PDF's, -MP3's en -SVG's onder `public/` |
| `node scripts/generate-icons.mjs` | Genereert de app-iconen (192, 512, maskable, apple-touch) |

Stripe lokaal: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## Hoe het in elkaar zit

### Engines zijn code, spellen zijn data

Er zijn vijf engines (`MATCH`, `SEQUENCE`, `QUIZ`, `LISTEN`, `WORDBUILD`). Een
spel is een rij in de database: een engine plus een JSON-payload. Een nieuw
maandpakket kost **nul regels code** — je zet JSON in `content/` en draait
`npm run seed`.

De payloads zijn zod-schema's in `src/lib/game-schemas.ts`. Ze worden twee keer
gevalideerd: bij het seeden (hard falen, niets komt in de database) en bij het
renderen (zacht falen, een nette foutkaart in plaats van een crash).
`checkGameInvariants` controleert wat zod niet kan uitdrukken — dat elke
`correctIndex` bestaat, en dat elk woord in WORDBUILD te bouwen is uit de
aangeboden letters.

`GameHost` doet precies drie dingen: payload valideren, de juiste engine kiezen,
en bij `onFinish` `recordPlay` aanroepen en het beloningsscherm tonen.

### Entitlement

`src/lib/entitlement.ts` is de enige poort. `requireUser()` haalt de gebruiker
op en berekent `isSubscribed`; `requireChild()` zoekt het kind mét `userId` in
de query, zodat een vreemde `childId` simpelweg nul rijen oplevert.
`packAccess()` is de niet-gooiende variant voor pagina's die de paywall willen
*renderen*.

Elke betaalde read én write controleert opnieuw op de server. Een directe link
naar een spel uit een betaald pakket toont de paywall, en `recordPlay` weigert
een score voor een pakket waar je geen toegang toe hebt.

### Stripe

Eén jaarabonnement (€79) met 30 dagen trial, plus een eenmalige prijs van €1 in
dezelfde `line_items`. Stripe int daardoor direct €1, houdt de kaart, en int €79
als de trial afloopt.

De webhook schrijft de *huidige* toestand van het abonnement naar de gebruiker
in plaats van iets op te hogen — daardoor is hij idempotent: dezelfde event twee
keer verwerken geeft exact dezelfde eindtoestand. Op dag 23 stuurt
`/api/cron/trial-reminder` een herinneringsmail (Vercel cron, dagelijks 09:00).

---

## Tablet en iOS

Het kind speelt op een tablet, de ouder koopt op een telefoon. De app is op
beide getest, op vijf breedtes: 375, 414, 768 (staand), 1024 en 1366 (liggend).

**Geluid.** iOS Safari laat geen geluid toe tot er een echt gebruikersgebaar is
geweest, en een `<audio>`-element faalt daar *stil*: het kind tikt, er gebeurt
niets, geen foutmelding. Daarom loopt alle audio via `src/lib/audio.ts`: één
gedeelde `AudioContext`, ontgrendeld op de "Beginnen"-knop van een spel, met de
clips vooraf gedecodeerd in een buffercache. Lukt afspelen toch niet, dan zegt
het spel dat ("Tik nogmaals om het geluid te horen"), in plaats van niets te
doen.

**Aanraken.** De klasse `game-surface` staat alleen op het speelvlak van de vijf
spellen, nergens anders. Die zet `touch-action: manipulation` (geen zoom bij
dubbeltikken, scrollen blijft werken), `overscroll-behavior: contain` en schakelt
tekstselectie en het loepmenu uit. Sleepbare kaartjes krijgen daarbovenop
`drag-item` (`touch-action: none`), want dáár mag een vinger de pagina nooit
verschuiven. Op het paspoort en de pakketpagina blijft alles gewoon zoombaar —
dat is geen detail: een ouder die slecht ziet moet kunnen inzoomen.

**Veilige zones.** `viewport-fit=cover` plus `env(safe-area-inset-*)` in de drie
shells, en extra ruimte onder de knoppen van het beloningsscherm, zodat er niets
onder de home-indicator of achter een afgeronde hoek verdwijnt.

### Handmatig testen op een echt iOS-apparaat

Dit deel kan niet headless: er bestaat geen manier om Safari's audiobeleid na te
bootsen. Doe dit op een echte iPhone of iPad voor je uitrolt.

> **Zet er eerst één echte opname in.** De MP3's onder `public/audio/` zijn
> placeholders: ze decoderen correct (ruim een seconde, mono) maar zijn *stil*.
> Met alleen die bestanden kun je "geen geluid" niet onderscheiden van "de bug
> is terug". Vervang één clip — bijvoorbeeld
> `public/audio/2026-08-eerste-stappen/listen-alif.mp3` — door een echte opname
> en test daarop.

1. Open de app in **Safari** (niet Chrome — die kan op iOS geen audio-context
   ontgrendelen zoals Safari dat doet, en kan ook niets aan het beginscherm
   toevoegen).
2. Ga naar een pakket → **Luisteren** en tik op **Beginnen**.
3. Tik op de grote gele knop. **Er moet meteen geluid komen.** Komt er niets,
   dan is de ontgrendeling stuk — kijk of `unlockAudio()` nog in de
   `onPointerDown` van de startknop staat en niet in een `useEffect`.
4. Speel de ronde uit. De tweede ronde moet **zonder laadpauze** klinken; dat
   bewijst dat de buffercache werkt.
5. Zet het toestel op stil met de zijschakelaar. Web Audio blijft dan hoorbaar
   op iOS — dat is verwacht gedrag, geen bug.
6. Controleer in **Woord bouwen** en **Koppelen** dat de kleine luisterknopjes
   ook geluid geven.
7. Deel → **Zet op beginscherm**. Het icoon moet het gouden motief op groen zijn
   en "Noor Club" heten. Open het: geen adresbalk, en de app start op `/nl`.

## Productie-hardening

### Betaalde downloads zijn echt afgeschermd

De PDF's staan **niet** onder `public/` maar onder `private/assets/`, en gaan
alleen via `GET /api/asset/[assetId]`: eerst `requireUser()`, dan
`assertPackAccess()`, dan pas bytes. Geen toegang betekent 403 met een
JSON-body, nooit een halve PDF. De response is `private, no-store`, zodat geen
enkele proxy hem bewaart, en het bestand wordt gestreamd in plaats van in het
geheugen geladen.

`Asset.fileUrl` is daarom een pad *binnen* die map, geen URL. `next.config.ts`
neemt `private/assets/**` expliciet mee in de deployment — Next bundelt alleen
bestanden die het statisch ziet gebruiken, en anders is de map in productie leeg.

### Wachtwoord vergeten en e-mailverificatie

Beide werken met tokens van 32 random bytes waarvan alleen de **SHA-256-hash**
in de database staat. Een gelekte backup levert dus geen accountovername op.
Eenmalig te gebruiken, en een nieuw token maakt alle oudere van die gebruiker
meteen ongeldig.

`/wachtwoord-vergeten` antwoordt **altijd hetzelfde**, of het adres nu bestaat
of niet. Anders is het formulier een manier om te achterhalen welke gezinnen
hier een account hebben.

Een onbevestigd e-mailadres blokkeert de app niet — dat kost alleen conversie —
maar wél het afrekenen. Een betalende klant die je niet kunt bereiken krijgt de
herinnering van dag 23 niet en betwist in plaats daarvan de incasso.

### Rate limiting

Tellers staan in de database (`RateLimit`), niet in het geheugen: op Vercel
heeft elke instance zijn eigen geheugen, en dan is de limiet een suggestie.
Sleutels zijn gehasht, dus die tabel wordt nooit een lijst van wie waarvandaan
probeerde in te loggen.

Login telt **alleen mislukte** pogingen en controleert vooraf. Zou elke poging
meetellen, dan kon een aanvaller een gezin uit hun eigen account sluiten door
simpelweg op hun adres te blijven raden.

| Actie | Limiet |
|---|---|
| Login | 10 per 15 min per e-mailadres én per IP |
| Registreren | 5 per uur per IP |
| Wachtwoord vergeten | 3 per uur per e-mailadres |

> Let op: de limiet per IP betekent dat een gedeeld IP (school, kantoor, groot
> huishouden achter NAT) na tien mislukte pogingen even op slot zit voor
> iedereen erachter. Dat is de afruil die bij deze getallen hoort; verhoog de
> IP-limiet als je daar last van krijgt, de limiet per adres doet het echte werk.

### Verwijderen en exporteren (AVG)

`/account` heeft een gevarenzone. Verwijderen vraagt om het e-mailadres over te
typen en gaat dan in deze volgorde: **eerst Stripe, dan de database.** Lukt het
opzeggen niet, dan wordt er niets verwijderd — een account dat weg is terwijl
het abonnement doorloopt is de enige uitkomst waar geen weg terug uit is: de
klant heeft geen login meer om mee op te zeggen en de incasso's gaan door.

De export (`/api/account/export`) bevat account, kinderen, plays en badges.
Bewust *niet*: `passwordHash` en de Stripe-ID's.

### De €1 innen: twee stappen, geen trial-abonnement

De checkout is `mode: "payment"` van €1 met `setup_future_usage: "off_session"`.
Pas als die betaling geslaagd is maakt de webhook het jaarabonnement aan, met
`trial_end` op 30 dagen en de zojuist bewaarde kaart als
`default_payment_method`.

De reden: een abonnement mét `trial_period_days` factureert zijn eerste factuur
op €0 en belast de kaart pas als de trial afloopt. Dan heb je de €1 niet geïnd,
de kaart nooit gevalideerd, en op dag 30 een muur van mislukte incasso's van
kaarten die nooit goed waren. Zo niet: €1 nu binnen, kaart bewezen, jaarincasso
ingepland.

Het aanmaken is idempotent — een bestaand niet-geannuleerd abonnement slaat het
over — zodat Stripe's retries geen tweede abonnement opleveren.

> **Nog te doen:** deze flow is gebouwd maar niet met echt geld gemeten — daar
> zijn Stripe-testsleutels voor nodig. `docs/stripe-runbook.md` bevat de opzet
> en de checklist voor de vier testkaarten. Loop die door voordat je live gaat;
> dit is het enige onderdeel van de app dat nog niet aantoonbaar werkt.

`trialEndsAt` staat lokaal op de `User`, zodat de herinneringsmail niet afhangt
van of Stripe op dat moment bereikbaar is.

### Dagelijkse cron

`GET /api/cron/daily`, met `Authorization: Bearer $CRON_SECRET`, dagelijks om
07:00 via `vercel.json`. Doet drie dingen: de herinnering op dag 23 (trial loopt
over 6–8 dagen af, nog geen herinnering gestuurd), vervallen rate-limit-rijen
opruimen, en vervallen tokens opruimen.

Idempotent: `renewalReminderSentAt` wordt pas gezet als de mail écht verstuurd
is, dus een mislukte provider betekent morgen opnieuw proberen in plaats van een
ouder die nooit gewaarschuwd wordt.

### Logging en funnel

`src/lib/logger.ts` schrijft één JSON-object per regel — dat is alles wat Vercel
nodig heeft om er doorzoekbare velden van te maken, en het kost geen dependency.
Elke regel heeft een correlatie-ID. Nooit tokens, wachtwoorden, keys of hele
e-mailadressen: gebruik `hashed()` of `maskEmail()`.

`src/lib/track.ts` heeft precies zeven events: `registered`, `child_added`,
`game_started`, `game_completed`, `pack_completed`, `checkout_started`,
`checkout_completed`. Bewust een gesloten lijst — een open `track(string)` wordt
binnen een maand veertig half-gebruikte namen en dan vertrouwt niemand de
cijfers meer. Vandaag schrijven ze naar de log; een analytics-provider aansluiten
is één functie aanpassen.

`GET /api/health` pingt de database en geeft status, latency en commit-SHA. Geen
geheimen.

### Wanneer een pakket opengaat

De seed leidt `releaseAt` **altijd** af uit `year`/`month` (de 1e van die maand,
00:00 UTC). Er staat geen `releaseAt` meer in de content-JSON, dus een datum die
ooit "even" vooruit is gezet kan niet meer in productie belanden.

`SEED_RELEASE_OVERRIDE=true` zet alles meteen open voor lokaal werk, en **gooit
een fout** als `NODE_ENV=production`.

### Juridisch

`/privacy` en `/voorwaarden` bestaan in vier talen, maar de teksten zijn leeg met
`TODO`-markeringen in de source, inclusief een lijst van wat erin moet. Dat is
opzet: plausibel klinkende boilerplate is erger dan een zichtbaar lege pagina,
want die ziet er af uit en wordt nooit vervangen. Laat ze opstellen door een
jurist.

Bij het afrekenen staat een **aparte** verplichte checkbox voor het afstand doen
van het herroepingsrecht — los van de voorwaarden, want dat moet een eigen
bewuste handeling zijn. Het moment wordt vastgelegd in `User.withdrawalWaivedAt`.

## Twee dingen die je moet weten voor je hieraan verder werkt

Beide zijn met de hand gemeten in deze combinatie van Next 15.5 en next-intl 4,
en beide kostten uren om te vinden.

**1. Roep geen `revalidatePath()` aan in een Server Action waarvan de client het
antwoord nog leest.** Het kapt de response-stream af: de mutatie slaagt, maar
`useActionState` krijgt nooit een resultaat en het formulier blijft eeuwig op
"Opslaan…" staan. De acties in `src/actions/children.ts` geven daarom een
`redirectTo` terug en de client navigeert zelf (`useActionRedirect`), waarna de
pagina toch vers rendert.

**2. `redirect()` binnen een Server Action komt niet aan als het doel in
dezelfde route-group zit.** De client bevestigt de redirect maar voert hem niet
uit. Redirects die een group kruisen (login → app, logout → marketing) werken
wél gewoon en gebruiken `redirect()`.

De middleware laat Server-Action-POSTs met opzet ongemoeid: de i18n-middleware
is voor navigatieverzoeken en herschrijft anders het antwoord van de actie.

---

## Afwijkingen van de opdracht

| Wat | Waarom |
|---|---|
| `(app)/page.tsx` → `(app)/kinderen/page.tsx` | `(marketing)/page.tsx` en `(app)/page.tsx` lossen allebei op naar `/[locale]`; Next weigert twee pagina's op hetzelfde pad. `/` is nu de landingspagina en stuurt ingelogde ouders door naar `/kinderen`. |
| `Badge.pack` is `Pack?` | Prisma valideert niet met een verplichte relatie op een optionele `packId` + `onDelete: SetNull`. |
| Enums over meerdere regels | Prisma's parser accepteert geen enum-waarden op één regel. |
| `add_invoice_items` → tweede regel in `line_items` | Checkout Sessions kennen die parameter niet meer; een eenmalige prijs in `line_items` is de gedocumenteerde opvolger en belandt op dezelfde eerste factuur. |
| `2026-09-wudu` heeft `releaseAt` 2026-08-01 | Sectie 11 vraagt dat de paywall meteen testbaar is. Met 2026-09-01 is het pakket vandaag "binnenkort" en is de paywall onbereikbaar. Zet dit terug op de echte releasedatum bij livegang. |
| `GameProps` heeft `ageBand` | De scoreregel verschilt per leeftijdsgroep; zonder dit veld kan een engine hem niet toepassen. |
| Beide pakketten hebben een badge | Het gratis pakket moet zonder betaling een badge kunnen opleveren, anders is het paspoort niet te testen. |
| E-mailteksten in `src/emails/copy.ts` | E-mails renderen buiten een request, waar next-intl geen locale-context heeft. Nog steeds één centrale catalogus in vier talen. |
| `game-surface` gebruikt `touch-action: manipulation`, niet `none` | Met `none` kan een vinger niet meer scrollen. Een MATCH-bord met zes paren is op een telefoon hoger dan het scherm, dus `none` zou het kind opsluiten in het bovenste deel van het bord. `manipulation` haalt de dubbeltik-zoom weg en laat scrollen intact; sleepbare kaartjes krijgen apart `drag-item` met `touch-action: none`, want dáár is het wél nodig. |
| `game-surface` staat in `GameShell`, niet vijf keer los | `GameShell` omhult het bord van alle vijf de engines en niets anders, dus dit is precies de vijf speelvlakken. De suite controleert dat ook op de draaiende app: precies één speelvlak op elke spelpagina, nul op het paspoort, de pakketpagina en het kinderoverzicht. |
| Spellen beginnen met een "Beginnen"-scherm | Puur technisch: iOS geeft pas geluid na een echt gebruikersgebaar, en `unlockAudio()` moet dáárin draaien. Het scherm is meteen het moment om de clips te decoderen. |

---

## Placeholders

De PDF's, MP3's en SVG's onder `public/` zijn gegenereerd
(`scripts/generate-placeholders.mjs`) en bedoeld om één-op-één vervangen te
worden door echt materiaal: zelfde paden, zelfde namen. De JSON-structuur van de
pakketten is wél echt en compleet.

# Chatjaar

Jaaroverzicht van een WhatsApp-groepschat, met prijzen, records, AI-momenten en een roast per lid. Een dienst van Marhaba Cooperation BV.

## Hoe het werkt

1. De klant uploadt een WhatsApp-export (`.zip` of `.txt`, iOS of Android, NL/FR/EN/DE/ES; IT/PT best effort).
2. De chat wordt **in de browser** geparsed en geteld (`src/lib/parser.ts`, `src/lib/stats.ts`). Het bestand gaat nooit naar de server.
3. De eerste 3 slides zijn gratis. Daarna betaalt de klant €7,99 via Stripe Checkout (met verplichte afstand van herroepingsrecht).
4. Na betaling stuurt de browser een gepseudonimiseerde selectie (namen → "Lid A", nummers/links/e-mails weg) naar `/api/ai`. De server controleert de betaling bij Stripe en vraagt de AI-slides aan Claude. Maximaal 3 AI-runs per betaling.
5. De browser zet de echte namen terug en de klant downloadt de kaartjes als PNG (1080×1920) of als zip.

Er is geen database. Alles staat in de `sessionStorage` van het tabblad.

## Talen en merk

- Site, slides, AI-teksten en juridische pagina's in **NL, FR, EN, DE en ES** (`/nl`, `/fr`, `/en`, `/de`, `/es`).
- Bezoekers worden op basis van hun browsertaal doorgestuurd; onbekende talen gaan naar **Engels**.
- De merknaam is instelbaar met `NEXT_PUBLIC_BRAND_NAME` (standaard "Chatjaar"). Alle teksten, slides, bestandsnamen en de Stripe-productnaam volgen mee. Nieuwe build nodig na wijzigen.
- Nieuwe taal toevoegen: `LOCALES`/`LOCALE_TAG` en een `Dict` in `src/i18n/dictionaries.ts`, de lijst in `src/proxy.ts`, `LANGUAGE_NAME` in `src/app/api/ai/route.ts`, `PRODUCT_NAME` in `src/app/api/checkout/route.ts`, de juridische teksten in `src/legal/content.ts`, en exportstrings in `src/lib/parser.ts` (+ test).

## Lokaal draaien

```powershell
npm install
copy .env.example .env.local   # vul de sleutels in
npm run dev
```

Open http://localhost:3000.

## Testen

```powershell
npm test        # parser, statistieken en privacy van de AI-payload
npm run build
```

## Omgevingsvariabelen

Zie `.env.example`. Verplicht in productie: `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL`.

## Mobiele app

De app staat in `../chatjaar-app`. Ze gebruikt dezelfde AI via `POST /api/app/ai`; betalen gebeurt met een in-app aankoop die de server bij RevenueCat controleert. Zet hiervoor in Vercel:
- `REVENUECAT_SECRET_KEY` — secret API key (v1) uit RevenueCat
- `REVENUECAT_PRODUCT_ID` — optioneel, standaard `chatjaar_unlock`

## Live zetten (Vercel)

1. Push deze map naar een privé GitHub-repo en importeer hem in Vercel.
2. Zet de omgevingsvariabelen in Vercel → Settings → Environment Variables.
3. Koppel je domein en zet `NEXT_PUBLIC_SITE_URL` op dat domein.
4. Stripe Dashboard:
   - Zet **Bancontact** aan bij Settings → Payment methods (Checkout toont het dan automatisch).
   - Test eerst met `sk_test_...` en kaart `4242 4242 4242 4242`, daarna `sk_live_...`.
   - Gebruik je Stripe Tax, zet dan `STRIPE_AUTOMATIC_TAX=true`.

## Structuur

- `src/lib/parser.ts` – WhatsApp-exportparser (iOS/Android, meertalig)
- `src/lib/stats.ts` – statistieken en prijzen
- `src/lib/ai-payload.ts` – pseudonimisering en selectie voor de AI
- `src/lib/slides.ts` – opbouw van de slides
- `src/app/api/*` – checkout, betaalverificatie, AI
- `src/i18n/dictionaries.ts` – alle teksten in NL/FR/EN
- `src/legal/content.ts` – privacyverklaring, voorwaarden, colofon

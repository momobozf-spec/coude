# Chatjaar — mobiele app (iOS + Android)

Expo SDK 58 · React Native 0.88 · TypeScript · expo-router. Zelfde product als de website (`../chatjaar`): een jaaroverzicht van een WhatsApp-groepschat, in NL/FR/EN/DE/ES.

## Hoe het werkt
1. In WhatsApp: **Exporteer chat › Zonder media › kies Chatjaar** in het deelmenu (iOS share extension / Android intent). Of kies een geëxporteerd bestand in de app.
2. De app leest de `.txt` of `.zip` **op de telefoon** (`src/lib/readExport.ts`, `parser.ts`, `stats.ts`). Het bestand wordt niet geüpload.
3. De eerste 3 slides zijn gratis. Ontgrendelen = één **in-app aankoop** (consumable, via RevenueCat).
4. Na aankoop stuurt de app een gepseudonimiseerde selectie (namen → "Lid A", nummers/links/e-mails weg) naar `POST {API_URL}/api/app/ai`. De server controleert de aankoop bij RevenueCat (max. 3 AI-runs per aankoop) en vraagt de AI-slides aan Claude.
5. Elke slide kan als PNG (1080×1920) gedeeld worden.
6. Op het toestel wordt enkel bewaard: een vingerafdruk van de chat (hash), het transactie-id en het AI-resultaat (met codes). Zo hoeft dezelfde chat niet opnieuw betaald te worden.

## Gedeelde code met de website
`src/lib/{parser,stats,ai-payload,ai-types,slides,brand}.ts` en `src/i18n/dictionaries.ts` zijn kopieën uit `../chatjaar/src`. Pas je iets aan in de parser, statistieken of vertalingen? Kopieer het naar beide projecten en draai in beide `npm test`.

## Lokaal draaien
Deze app gebruikt native modules (share extension, in-app aankopen). **Expo Go werkt dus niet**; je hebt een development build nodig.

```powershell
npm install
copy .env.example .env      # vul in
npx eas-cli@latest build --profile development --platform android   # of ios
npx expo start --dev-client
```

## Controles
```powershell
npm test          # parser (5 talen), statistieken, privacy van de AI-payload, zip-lezer
npm run typecheck
```

## Wat je moet instellen voor livegang
1. **Apple Developer** (€99/jaar) en **Google Play Console** ($25 eenmalig) op naam van Marhaba Cooperation BV.
2. **App Store Connect en Play Console:** maak een *consumable* product `chatjaar_unlock` (prijsniveau ≈ €7,99).
3. **RevenueCat:** maak een project, koppel beide stores en het product; zet de publieke SDK-sleutels in `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`.
4. **Website/backend (`../chatjaar`) in Vercel:** zet `REVENUECAT_SECRET_KEY` (secret API key, v1) en optioneel `REVENUECAT_PRODUCT_ID`. Zet `EXPO_PUBLIC_API_URL` in de app op het domein van die backend.
5. **iOS:** de share extension gebruikt de App Group `group.be.marhaba.chatjaar`. EAS maakt die normaal automatisch aan bij de eerste build; anders in het Apple Developer-portaal.
6. Bouwen en indienen: `npx eas-cli@latest build --profile production` en `npx eas-cli@latest submit`.

## Store-teksten: let op
- Gebruik "WhatsApp" niet in de appnaam of het icoon (merkrecht). In de beschrijving mag "werkt met exports van WhatsApp-groepschats" met de vermelding dat de app niet verbonden is aan WhatsApp/Meta.
- Privacylabels (App Store) / Data safety (Play): geen tracking; aankoopgegevens via de store/RevenueCat; na aankoop wordt een gepseudonimiseerde tekstselectie verwerkt voor de AI-functie en niet bewaard.

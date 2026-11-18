# ShieldCheck — MVP-prototype

Een eenvoudige beveiligings- en privacycheck voor consumenten en zelfstandigen in België en Nederland.
Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · NativeWind 4 (Tailwind 3).

> Prototype. Geen antivirus, geen VPN, geen achtergrond- of realtime bescherming, geen echte datalekmonitoring.

## Starten

```bash
cd shieldcheck
npm install          # .npmrc zet legacy-peer-deps aan (nodig door een peer-conflict react-dom ↔ react 19.3.0)
npx expo start       # scan de QR-code met Expo Go (SDK 58) op je telefoon
npm run typecheck    # tsc --noEmit
npm run test:heuristics   # zelftest van de link/sms-heuristiek en de OS-versiebeoordeling
```

- Alles draait in **Expo Go**, je hebt geen development build nodig.
- Een eigen build (bv. voor TestFlight of Play) maak je met `npx eas-cli@latest build`. Bundle-id/package is `be.marhaba.shieldcheck`; pas dat aan in `app.json` als je dat wilt.
- Geen `.env`, geen API-sleutels nodig.

## Mappenstructuur

```
shieldcheck/
├─ app.json                 # config: dark mode automatisch, gevoelige Android-rechten geblokkeerd
├─ babel.config.js / metro.config.js / tailwind.config.js / nativewind-env.d.ts
├─ scripts/test-heuristics.ts
└─ src/
   ├─ global.css
   ├─ app/                  # Expo Router-schermen
   │  ├─ _layout.tsx        # root: SafeArea, ScanProvider, Stack
   │  ├─ index.tsx          # stuurt door naar onboarding of dashboard
   │  ├─ onboarding.tsx     # 1. vertrouwen + "Start gratis veiligheidscheck"
   │  ├─ module/[id].tsx    # details module A/B/C
   │  └─ (tabs)/
   │     ├─ dashboard.tsx   # 2. score + 4 modules + uitleg labels
   │     ├─ check.tsx       # module D: link/sms-check + e-mail (demo)
   │     ├─ acties.tsx      # 3. "Los nu op"
   │     └─ pro.tsx         # 4. Pro (voorgesteld, geen betaling)
   ├─ components/           # ui.tsx, CheckCard, ScoreCard, SourceBadge
   ├─ scan/                 # scanlogica (los van de UI)
   │  ├─ system.ts  network.ts  apps.ts  runScan.ts
   │  ├─ heuristics.ts      # lokale link/sms-analyse (pure TS, getest)
   │  ├─ osVersion.ts  score.ts  actions.ts  settings.ts  types.ts
   ├─ data/                 # voorbeelddata + referentietabel
   │  ├─ demoApps.ts  osReference.ts
   ├─ state/                # ScanContext + AsyncStorage
   └─ theme/colors.ts
```

## Wat echt werkt op het toestel

| Controle | iOS | Android | Hoe |
|---|---|---|---|
| OS-naam en -versie | ✅ echt | ✅ echt | `expo-device`. Beoordeling via een ingebouwde tabel (`src/data/osReference.ts`) |
| Schermvergrendeling (geen / pincode / biometrie) | ✅ echt | ✅ echt | `LocalAuthentication.getEnrolledLevelAsync()` |
| Verbinding + type (wifi/mobiel/…) | ✅ echt | ✅ echt (ook VPN-type) | `expo-network`. Telt niet mee in de score |
| Systeeminstellingen openen | alleen de eigen app-instellingen | ✅ wifi, beveiliging, privacy, algemeen | `expo-intent-launcher` / `Linking.openSettings()` |

De **score** (0–100) telt alleen de echt gemeten controles mee met een gewicht: OS-versie (50) en schermvergrendeling (50).
Afgevinkte acties die bij een bevinding horen, tellen apart mee als "zelf bevestigd". Ze worden niet opnieuw gemeten en
de app past niets aan op het toestel.

## Wat voorbeelddata, heuristiek of placeholder is

- **App-toestemmingen van andere apps**: *beperkt*. iOS laat dit niet toe. Android vraagt `QUERY_ALL_PACKAGES` (strenge Play-regels) plus een native module. Daarom toont de app **voorbeeldgegevens** (`src/data/demoApps.ts`), duidelijk gelabeld.
- **Beveiligingspatchdatum**: *niet beschikbaar*. iOS heeft dit niet. Op Android bestaat het, maar Expo heeft geen API ervoor.
- **Root/jailbreak**: *niet gecontroleerd*. `isRootedExperimentalAsync` is experimenteel en niet betrouwbaar, dus we tonen geen resultaat.
- **Wifi-versleuteling (WPA2/3), DNS, MITM**: *niet gecontroleerd*. Je krijgt uitleg en (op Android) een knop naar de wifi-instellingen.
- **E-mail-datalekcheck**: *demo*. De app valideert het adres lokaal en verstuurt niets. De knop naar haveibeenpwned.com opent alleen de website in je browser.
- **Link/sms-check**: *lokale heuristiek*. Kijkt naar verkorte links, IP-adressen, punycode, "@" in de URL, ongebruikelijke TLD's, nagebootste merkdomeinen (bpost, PostNL, KBC, ING, Belfius, itsme, DigiD…), urgent taalgebruik, vragen om codes, pakket/betaal-trucs en "Hoi mam"-fraude. Opent links nooit.
- **Pro**: prijzen en voorgestelde functies. Geen betaling, geen abonnement.

## Privacy

- De app doet geen netwerkverzoeken voor scans. AsyncStorage bewaart alleen "onboarding gezien" en de afgevinkte acties.
- Gevoelige Android-rechten (locatie, contacten, camera, microfoon, sms, opslag, telefoonstatus, QUERY_ALL_PACKAGES) staan in `app.json` als `blockedPermissions`.
- `faceIDPermission: false`: de app vraagt nooit Face ID (hij leest alleen het type vergrendeling).

## Onderhoud

- Werk `src/data/osReference.ts` bij als er nieuwe OS-hoofdversies uitkomen.
- Merken en domeinen voor de link-check staan in `src/scan/heuristics.ts` (`BRANDS`). Draai na elke aanpassing `npm run test:heuristics`.

# 🕌 Salaat — Islamitische Gebedstijden

Een volledig native React Native / Expo app voor Android en iOS.

## Features
- 📍 Automatische locatiedetectie (GPS)
- 🕐 Alle 6 gebedstijden: Fajr, Zonsopgang, Dhuhr, Asr, Maghrib, Isha
- ⏱  Live afteltimer naar het volgende gebed
- 📅 Hijri + Gregoriaanse datum
- ⚙️  12 berekenings­methoden (MWL, Egyptisch, Umm Al-Qura, Qatar, Diyanet…)
- 🕛 12-uurs / 24-uurs formaat
- 🌙 Dark mode design
- 💾 Instellingen worden opgeslagen

## Snel starten (Expo Go — scan QR)

```bash
npm install
npx expo start
```
Scan de QR-code met de **Expo Go** app op je telefoon.

## Productie build (Play Store / App Store)

### Vereisten
1. Maak een gratis account op [expo.dev](https://expo.dev)
2. Installeer EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Configureer je project:
   ```bash
   eas build:configure
   ```

### Android (.aab voor Play Store)
```bash
eas build --platform android
```

### iOS (.ipa voor App Store)
```bash
eas build --platform ios
```

### Direct APK (intern testen)
```bash
eas build --platform android --profile preview
```

## Projectstructuur

```
salaat-app/
├── App.tsx                        # Entry point
├── app.json                       # Expo config (bundle ID, permissions)
├── eas.json                       # EAS Build config
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Hoofdscherm
│   │   └── SettingsScreen.tsx     # Instellingen
│   ├── components/
│   │   ├── PrayerCard.tsx         # Gebedsrij card
│   │   ├── CountdownHero.tsx      # Hero countdown widget
│   │   └── DateHeader.tsx         # Datum header
│   ├── hooks/
│   │   └── usePrayerTimes.ts      # State + locatie hook
│   ├── utils/
│   │   └── prayerTimes.ts         # Berekeningen + Hijri datum
│   ├── constants/
│   │   └── prayers.ts             # Gebeds­namen + methodes
│   ├── navigation/
│   │   └── AppNavigator.tsx       # Stack navigator
│   └── theme/
│       └── index.ts               # Kleuren + spacing
```

## Publiceren naar stores

### Google Play Store
1. Maak een developer account op [play.google.com/console](https://play.google.com/console)
2. Run `eas build --platform android` → je krijgt een .aab bestand
3. Upload het .aab via de Play Console

### Apple App Store
1. Maak een Apple Developer account ($99/jaar)
2. Run `eas build --platform ios` → Expo bouwt de .ipa
3. Upload via App Store Connect

## Aanpassen

- **Bundle ID wijzigen**: Pas `android.package` en `ios.bundleIdentifier` aan in `app.json`
- **App naam**: Pas `name` aan in `app.json`
- **Standaard methode**: Pas `'MuslimWorldLeague'` aan in `usePrayerTimes.ts`

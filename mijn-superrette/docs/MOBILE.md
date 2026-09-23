# Mobile app

The same app also ships as a responsive **web version**; see [WEB.md](WEB.md).

`apps/mobile`: Expo SDK 57, React Native 0.86, React 19.2, expo-router, TanStack Query, Socket.IO client.

## Navigation

```
/ (gate) → /welcome → /login | /register → /onboarding (country + language) → /onboarding/retailers (+ loyalty cards)
Tabs: /home · /search · /promotions · /lists · /profile
/product/[id] · /alert/[variantId] (modal) · /add-to-list/[variantId] (modal) · /scan (full screen)
/list/[id] · /list/[id]/compare · /list/[id]/choose (modal, "Wijzig product") · /list/[id]/smart · /list/[id]/share
/invite/[token] (deep link mijnsuperrette://invite/…) · /alerts · /notifications · /favorites
/settings/retailers · /settings/language · /settings/plan · /settings/privacy · /settings/sources
```

## Design system (`packages/ui`)

The visual identity is **receipt paper & ink**, and it is original:

- **Colours:** warm paper backgrounds, a deep petrol ink for text and primary actions, **apricot** for promotions, **basil green** for "cheapest".
- **Logo:** an ink tile with an apricot basket, with an "S" rising from it.
- **Receipt cards:** comparison results are drawn as receipts ("bonnetjes") with torn zigzag edges.
- **Prices:** tabular figures so receipt columns align.
- **Retailers:** shown as neutral name pills in their brand colour. No third-party logos are shipped.

Tokens (`@superrette/ui/tokens`) are platform-independent and also style the admin. Light and dark schemes are included.

Components: Text, Button, IconButton, Card, Row, Divider, SectionHeader, Badge, Chip, RetailerBadge, PriceTag, ReceiptCard, TextField, SearchField, ToggleRow, ListRow, SampleDataBanner, EmptyState, ConfidenceMeter, Skeleton, Stepper, PriceChart (a step chart, because prices hold until the next observation), Icon (original line icon set), Logo/LogoMark.

## Principles

- **No pricing or matching logic in the UI.** The app renders API DTOs and formats them with `@superrette/i18n`. ESLint blocks imports of the engines and infrastructure.
- **Honest data labels.** `DataNotice` shows the _VOORBEELDDATA_ banner whenever any shown price is `DEVELOPMENT_SEED`, and names crowdsourced prices.
- **i18n.** NL/FR/EN catalogues (the compiler enforces identical keys). The locale is the profile language, then the device language, then Dutch. Currency, decimals, units and dates use `Intl` with nl-BE, fr-BE, nl-NL and so on.
- **Security.** Tokens live in the Keychain/Keystore (`expo-secure-store`). There is a single-flight refresh with rotation. No API credentials ship in the app; only `EXPO_PUBLIC_API_URL`.
- **Realtime lists.** `useListRealtime` joins the list room and patches the query cache from server events without regressing versions. Stale edits get `409 VERSION_CONFLICT`, and the app shows _"Dit product werd intussen door iemand anders gewijzigd"_ and reloads.
- **Barcode scanner.** `expo-camera` `CameraView` reads EAN-13/EAN-8/UPC-A/UPC-E, then calls `/v1/barcodes/:code`. It opens the product, or shows _"Dit product kennen we nog niet."_ It never invents a product.
- **Push.** `expo-notifications` with `getExpoPushTokenAsync({ projectId })` and an Android channel `price-alerts`. Tapping a notification opens the product. Remote push needs a development or production build and an EAS project id (`EAS_PROJECT_ID`).

## Running

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 pnpm dev:mobile
pnpm --filter @superrette/mobile web        # quick UI check in a browser
```

## Builds

- `pnpm --filter @superrette/mobile build` exports the production Hermes bundles for Android and iOS (verified in CI).
- Store binaries are built with EAS (`eas.json` profiles: development, preview, production). This needs an Expo account, an Apple Developer account (APNs) and FCM credentials. **It has not been run in this repository.**

## Verified in this repository

- `tsc` typecheck and API-client unit tests (token refresh single-flight, sign-out on refresh failure, error mapping).
- Android and iOS Hermes bundle export.
- A Playwright walkthrough of the web build against a running API: welcome, login, home, search, product detail with history, lists, basket comparison, choose product, Smart Basket, promotions.
- **Not verified:** runs on physical devices or simulators, camera scanning on a device, and real push delivery.

# Mijn Superrette: data source and platform research

Date of research: 2026-09-23. Sources were checked live with WebSearch, WebFetch and curl. "Not verified" means I could not confirm the point from an official or primary source.

---

## 1. Retailer data access (BE / NL)

### Summary

- **None of the listed retailers publishes an official public developer API** for products, prices or promotions. My searches found no developer portal for AH, Jumbo, Delhaize, Carrefour, Colruyt or the others. Everything that currently offers "Colruyt API" or "Albert Heijn API" is a third-party scraper or reseller (Apify actors, Pepesto, RetailScrape, RealDataAPI, ProductDataScrape), or it is a reverse-engineered mobile or web API on GitHub (e.g. `bartmachielsen/SupermarktConnector` for the AH and Jumbo mobile APIs, `BelgianNoise/colruyt-products-scraper`, `SimonGulix/colruyt_scraper`, which describes itself as using "the hidden API of www.colruyt.be"). **These are NOT permitted sources and must not be used**, whether directly or through a reseller. The resellers do not show any licence from the retailer.
  - https://github.com/bartmachielsen/SupermarktConnector
  - https://github.com/BelgianNoise/colruyt-products-scraper
  - https://github.com/SimonGulix/colruyt_scraper
  - https://apify.com/harvestedge/albert-heijn-api ; https://www.pepesto.com/supermarkets/colruyt/
- **Affiliate programs are the only legitimate retailer-provided feeds I found.** They are Partnerize for AH, TradeTracker/Daisycon for Lidl's non-food webshop, and Awin for PLUS. Affiliate feeds are licensed for promoting the retailer, and their use is governed by each network's and advertiser's publisher terms. Those terms usually bind use to tracked links and often exclude or restrict price comparison use. **Before using any feed, get written confirmation from the program manager** that the feed may be shown in a comparison app. (The exact feed-use clauses of each program were not verified, because they sit behind publisher login.)
- **Apple App Review Guideline 5.2.2 applies directly.** An app that "displays content from a third-party service" must be "specifically permitted to do so under the service's terms of use. Authorization must be provided upon request." Scraped retailer prices would therefore risk App Store rejection as well as legal claims. https://developer.apple.com/app-store/review/guidelines/
- **EU database law (legal background).** This is from my own knowledge and was not re-verified against primary sources today. The EU Database Directive 96/9/EC gives a sui generis right against extracting or re-using a substantial part of a database. The CJEU case *Ryanair v PR Aviation* (C-30/14, 2015) held that website terms can contractually restrict re-use even of databases that the Directive does not protect. The Jumbo and Picnic terms quoted below mirror the wording of the Directive.

### Per-retailer table

| Retailer | Official API / feed / partner program | Terms on automated access / reuse |
|---|---|---|
| **Colruyt (BE)** | No public API found. Colruyt Group bought price-data firm Daltix to get "real-time" price insight, which is internal use and not a public feed (https://www.retaildetail.eu/news/food/colruyt-group-acquires-data-supplier-daltix/). No affiliate program found. Only route: ask Colruyt Group directly for a data licence. | MyColruyt app terms, as reported in a search snippet (full text not fetched): reproduction or use of the app content "in whatever form ... is strictly prohibited"; storing any information "in an (electronic) database ... is not permitted". Source: https://www.colruyt.be/content/experience-fragments/clp/nl/algemene-voorwaarden/master (the page fetch returned only navigation, so the exact wording is **not verified**). |
| **Delhaize (BE)** | No public API or affiliate program confirmed. A VigLink/Sovrn listing exists, but no network was confirmed (http://www.viglink.com/merchants/94608/delhaize.be-affiliate-program). | Terms (search snippet): website information "may not be made public, reproduced, or edited without permission from Delhaize, except for personal use." PDF: https://www.delhaize.be/medias/sys_master/h01/hb3/9804657033246.pdf (the direct fetch returned 403, so the exact wording is **not verified**). |
| **Carrefour Belgium** | No public API or BE affiliate program found. The Awin and Tradedoubler Carrefour programs found are for France (Carrefour Banque, Drive): https://ui.awin.com/merchant-profile/31381 | Not verified. |
| **Albert Heijn (BE)** | **Partnerize affiliate program exists** ("Albert Heijn Belgium", listed as open). It includes a weekly-updated **"bonus feed" of the 15 best bonus offers**. https://affi.io/m/albert-heijn-belgium ; signup https://signup.partnerize.com/signup/nl/albertheijn | Same as AH NL (below). |
| **Lidl (BE)** | No grocery API or feed found. | lidl.be terms (search snippet): IP content "may not be copied or reproduced without prior and explicit written permission from Lidl". Lidl uses Friendly Captcha against bots. https://www.lidl.be/c/nl-BE/algemene-voorwaarden/s10007210 (exact wording **not verified**). |
| **ALDI (BE)** | None found. | Not verified. |
| **Intermarché (BE)** | None found. | Not verified. |
| **Okay (BE, Colruyt Group)** | None found; see Colruyt. | Not verified. |
| **Albert Heijn (NL)** | **Partnerize affiliate program**, formerly Affiliate4You and then a white-label Performance Horizon setup. Per LinkPizza/affi.io it offers banners, text links, **a product feed and a weekly "Bonus" feed**. There is a separate AH Voordeelshop program for non-food. https://signup.partnerize.com/signup/nl/albertheijn ; https://linkpizza.com/nl/blog/affiliate-commissie-albert-heijn-loopt-gewoon-door ; https://affi.io/m/ah-ticketservice | https://www.ah.nl/algemene-voorwaarden : "het niet is toegestaan om zonder voorafgaande uitdrukkelijke toestemming de op de websites vermelde informatie openbaar te maken, te verveelvoudigen en/of te bewerken, behalve voor persoonlijk gebruik." App terms: "U mag de AH app niet deassembleren, decompileren of onderwerpen aan reverse engineering." This rules out the unofficial AH mobile API. |
| **Jumbo (NL)** | Affiliate program: TradeTracker since 2019 (https://tradetracker.com/nl/jumbo-aan-het-woord/). affi.io also lists "Jumbo NL on Sale Gains", status open (https://affi.io/m/jumbo). **Product feed not verified.** | https://www.jumbo.com/service/algemene-voorwaarden : forbids "een substantieel gedeelte van de inhoud van de Website en/of Applicaties op te vragen en her te gebruiken", and forbids "herhaald en systematisch" reuse. Also bans tools and "robots" used "te spideren, scrapen". This explicitly bans scraping and rules out the unofficial Jumbo API. |
| **PLUS (NL)** | **Awin affiliate program** via agency FamilyBlend: "Ga naar https://ui.awin.com/merchant-profile/12479 en meld je aan" (https://www.plus.nl/organisatie/affiliate). The page mentions ad material; **a product feed is not confirmed**. | Not verified. |
| **Lidl (NL)** | **TradeTracker campaign "Lidl-shop.nl"** with an "actuele datafeed". It covers the **non-food webshop only** (">5.000 artikelen"), not supermarket grocery prices. https://tradetracker.com/nl/campaigns/warenhuizen-36/lidl-shop-nl-24118/ | Lidl NL terms not fetched. Lidl uses bot protection (Friendly Captcha) per its privacy statement. https://www.lidl.nl/c/privacy-cookie-verklaring/s10004059 |
| **ALDI (NL)** | None found. | Not verified. |
| **Dirk (NL)** | None found. | Not verified. |
| **SPAR (NL)** | None found. | Not verified. |
| **Picnic (NL)** | No confirmed NL affiliate program. The VigLink and PaidOnResults "Picnic" listings appear to be unrelated merchants. No API. | https://picnic.app/nl/algemene-voorwaarden/ (art. 14): forbids content being "openbaar te maken, te verveelvoudigen en/of te bewerken" without permission, and forbids tools "die erop gericht zijn door Picnic toegankelijk gemaakte informatie over te nemen, te spideren, te scrapen". This explicitly bans scraping. |
| **DekaMarkt (NL)** | None found. | Not verified. |
| **Vomar (NL)** | None found. | Not verified. |
| **Hoogvliet (NL)** | None found. | Not verified. |
| **Ekoplaza (NL)** | No affiliate program found. It has only a loyalty scheme ("Ekovriend") and franchising. https://www.ekoplaza.nl/nl/klantenservice/ekovriend/ekovriend-worden | Not verified. |
| **Kruidvat** | Kruidvat BE ran a program on **Kwanko/NetAffiliation** (weekly folder distribution), now listed as **"Closed"** (https://affi.io/m/kruidvat). For Kruidvat NL, blogs mention an affiliate program with feeds, but **the network and feed were not verified**. | Not verified (robots.txt returned 403). |
| **Etos** | No independent affiliate program found. One blog claims Etos is reachable via the AH Partnerize program (https://onlinegeldformule.nl/de-grootste-affiliate-netwerken-en-partnerprogrammas-van-nederland/), which is **not verified**. | Not verified. |

**Recommended legal data strategy:**
1. Use crowdsourced prices from Open Prices (ODbL) plus the app's own user contributions (receipt or price-tag photos, submitted back to Open Prices).
2. Where the program terms permit it in writing, use affiliate feeds (AH Partnerize bonus feed, PLUS on Awin, Jumbo on TradeTracker).
3. Approach retailers directly for data licences.
4. Show promotional folders only via links, or with permission.

---

## 2. Open Food Facts and Open Prices

### Open Food Facts (product metadata)
Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
- **Base URL:** `https://world.openfoodfacts.org`. Staging is `https://world.openfoodfacts.net`, which uses basic auth `off:off`.
- **Product by barcode:** `GET /api/v3/product/{barcode}.json`. v3 (latest v3.6) is "recommended for all new integrations". v2 (`/api/v2/product/{barcode}.json`) is "Deprecated — still supported".
- **Rate limits (verified from the docs text):**
  - "15 req/min/IP address for all read product queries"
  - "10 req/min/IP address for all search queries". The docs add: "don't use it for a search-as-you-type feature".
  - If requests come from users' devices (a mobile app), the limits apply per user.
  - Global limits return HTTP 503.
  - For more than a few hundred products, use the CSV/JSONL exports or host a local instance.
- **User-Agent:** "always use a custom User-Agent ... in the form of `AppName/Version (ContactEmail)`", for example `MyApp/1.0 (myapp@example.com)`. Reads need no authentication; writes need an account.
- The docs also ask developers to fill in the API usage form.
- **Licence:** Terms at https://world.openfoodfacts.org/terms-of-use
  - The database is ODbL, and its contents fall under the Database Contents License.
  - Images are CC BY-SA.
  - Reusers must "mention the licence and to attribute the authorship to Open Food Facts with a link".
  - "Derivative works must be shared under the same conditions."
  - The data comes with no accuracy guarantee.
  - Packaging images may carry third-party trademarks or copyright.

### Open Prices
Swagger: https://prices.openfoodfacts.org/api/docs. OpenAPI YAML: `https://prices.openfoodfacts.org/api/schema` (fetched). Guide: https://github.com/openfoodfacts/open-prices/blob/main/API.md
- **Base URL:** `https://prices.openfoodfacts.org/api/v1`. Pre-production is `https://prices.openfoodfacts.net`.
- **Auth:** Reads are public; a live GET worked without a token. Writes need a Bearer token from an Open Food Facts account.
- **Key GET endpoints (from the live OpenAPI spec):**
  - `/api/v1/prices`. Filters include `product_code`, `product_code__in`, `location_osm_id`, `location_osm_type`, `location_id`, `date`, `date__gte`, `date__lte`, `date__gt`, `date__lt`, `date__year`, `date__month`, `currency`, `price_is_discounted`, `discount_type`, `price__gte`, `price__lte`, `proof__type`, `type`, `kind`, `lat`, `lon`, `radius_km`, `owner`, `created__gte`, `order_by`, `page`, `size`.
  - `/api/v1/prices/{id}`
  - `/api/v1/prices/stats`, which accepts the same filters.
  - `/api/v1/products/code/{code}`
  - `/api/v1/locations`, `/api/v1/locations/nearby?lat&lon&radius_km`, `/api/v1/locations/osm/{osm_type}/{osm_id}` and `/api/v1/locations/compare?location_id_a&location_id_b`
  - `/api/v1/proofs`
- **Response shape (verified with a live call):**
  - The envelope is `{items:[...], page, pages, size, total}`.
  - Each price item has: `id`, `type` ("PRODUCT"), `product_code`, `product_name`, `category_tag`, `price`, `price_is_discounted`, `price_without_discount`, `discount_type`, `price_per`, `currency`, `date`, `location_osm_id`, `location_osm_type`, `location_id`, `proof_id`, `receipt_quantity`, `owner`, `source`, `tags`, `created`, `updated` and `duplicate_of`.
  - Each item also embeds `product` (code, product_name, image_url, brands, quantity...), `location` (osm_name, osm_brand, osm_address_city/country_code, osm_lat/lon...) and `proof` (type such as PRICE_TAG or RECEIPT, file_path, date, currency...).
  - Example call: `GET /api/v1/prices?product_code=5410041001204&size=1`.
- **Rate limits:** No documented limit, and no rate-limit headers were seen (**not verified**). Use the OFF-style User-Agent anyway.
- **Licence:** Data is ODbL: "it can be used for any purpose, as long as you credit Open Prices and share any modifications". Proof images are CC BY-SA 4.0. A daily Parquet dump is on Hugging Face (https://huggingface.co/datasets/openfoodfacts/open-prices). API.md adds: "comply with the OdBL licence, mentioning the source of your data, and ensuring to avoid combining non free data you can't release legally as open data." The code licence in the OpenAPI info is AGPL-3.0, which covers the server software, not the data.
- **Coverage caveat:** Open Prices is crowdsourced, so BE/NL coverage is patchy. The sample result was a French Intermarché store.

---

## 3. Expo (current SDK 57)

### Push send
Docs: https://docs.expo.dev/push-notifications/sending-notifications/
- **Send:** `POST https://exp.host/--/api/v2/push/send` with headers `Content-Type: application/json` and `accept: application/json`. Add `Authorization: Bearer <token>` if enhanced push security is on.
  - The body is one message or an array of **up to 100** messages.
  - Fields: `to` (required, token or array), `title`, `body`, `data`, `sound`, `badge`, `channelId`, `priority` (`default`/`normal`/`high`), `ttl`, among others.
  - The total payload must be at most 4096 bytes.
  - The response returns tickets `{status:"ok", id}` or an error. "ok" means Expo accepted the message, not that it was delivered.
- **Receipts:** `POST https://exp.host/--/api/v2/push/getReceipts` with body `{"ids":[...]}`, **max 1000 ids** per request. Check about 15 minutes after sending; receipts expire after 24 hours.
- **Errors:** `DeviceNotRegistered` (stop sending to that token), `MessageTooBig`, `MismatchSenderId`, `InvalidCredentials`.
- **Rate limit:** 600 notifications/second per project.

### Client setup
Docs: https://docs.expo.dev/push-notifications/push-notifications-setup/ and https://docs.expo.dev/versions/latest/sdk/notifications/ (v57.0.0)
- **Packages:** `expo-notifications` and `expo-constants`. The setup page also uses `expo-device` in its example; I did not re-confirm that on this fetch.
- **Notification handler:** `setNotificationHandler` with `shouldPlaySound`, `shouldSetBadge`, `shouldShowBanner` and `shouldShowList`. These are the current fields and replace the older `shouldShowAlert`.
- **Android:** call `setNotificationChannelAsync('default', {name, importance: AndroidImportance.MAX})` before asking for permission.
- **Token:** `requestPermissionsAsync()`, then `getExpoPushTokenAsync({ projectId })`, where `projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId`.
  - Other options: `devicePushToken`, `applicationId`, `development`, `baseUrl`/`url`/`type`.
- **Build requirements:**
  - Remote push needs a **development build**. Push is not available in Expo Go on Android since SDK 53; local notifications still work there.
  - Android needs FCM v1 credentials.
  - iOS needs a paid Apple developer account with APNs.
- **Config plugin options:** `icon`, `color`, `defaultChannel`, `sounds`, `enableBackgroundRemoteNotifications`.
- **Deprecations:** the sync `getLastNotificationResponse` and `clearLastNotificationResponse` are deprecated; use their async versions.

### expo-camera barcode scanning
Docs: https://docs.expo.dev/versions/latest/sdk/camera/ (v57.0.0)
- **Component:** `<CameraView barcodeScannerSettings={{ barcodeTypes: ['ean13','ean8','upc_a','upc_e'] }} onBarcodeScanned={handler} />`
- **Supported types:** `aztec, ean13, ean8, qr, pdf417, upc_e, datamatrix, code39, code93, itf14, codabar, code128, upc_a`.
- **Callback result:** `BarcodeScanningResult` with `{ type, data, bounds, cornerPoints, extra (Android) }`.
- **Permissions:** `useCameraPermissions()` returns `[status, request, get]`.
- **Config plugin:** `cameraPermission` and `barcodeScannerEnabled`. You can disable the barcode scanner to shrink the app.

---

## 4. In-app subscriptions

### Apple
- **App Store Server API:** https://developer.apple.com/documentation/appstoreserverapi
  - Production base URL: `https://api.storekit.itunes.apple.com`. Sandbox: `https://api.storekit-sandbox.itunes.apple.com`. The page summary gave "storekit-preview" for sandbox; "sandbox" is the documented value from my prior knowledge, so double-check this.
  - Auth: a JWT signed with ES256, with the Issuer ID, Key ID (from App Store Connect) and `bid` (bundle ID).
  - Endpoints:
    - `GET /inApps/v1/transactions/{transactionId}` (Get Transaction Info). It supports all IAP types, accepts original transaction IDs and returns a JWS `signedTransactionInfo`.
    - `GET /inApps/v1/subscriptions/{transactionId}` (Get All Subscription Statuses)
    - `GET /inApps/v2/history/{transactionId}` (Get Transaction History v2)
  - `verifyReceipt` is deprecated.
- **App Store Server Notifications V2:** https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2
  - The POST body is `{signedPayload}`, a JWS. Decode it to get `notificationType`, `subtype` and `data`. `data.signedTransactionInfo` and `data.signedRenewalInfo` are also JWS objects.
  - Validate each JWS signature, using the header's `alg` and the x5c chain up to the Apple Root CA.
  - Types include SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW (subtype GRACE_PERIOD), EXPIRED, REFUND, REVOKE, CONSUMPTION_REQUEST and others (https://developer.apple.com/documentation/appstoreservernotifications/notificationtype).
  - "The verifyReceipt endpoint and version 1 notifications are deprecated" (https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-v1).
  - Respond with HTTP 200. A non-200 response causes a retry.
- **Recommended flow:**
  1. The app buys with StoreKit 2 and sends the `transactionId` (or the JWS) to the backend.
  2. The backend verifies it via Get Transaction Info or the Subscription Status endpoint and stores `originalTransactionId` mapped to the user. Setting `appAccountToken` at purchase helps with this mapping.
  3. The backend keeps entitlement current from V2 notifications.
- Apple's official App Store Server Library (Node, Python, Java, Swift) handles JWT creation and JWS verification. That is from my prior knowledge; I did not re-fetch it.

### Google Play
- **Verify:** `GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptionsv2/tokens/{token}`. The RTDN page shows it as `.../purchases/subscriptionsv2/{token}`; the documented REST path includes `/tokens/`. https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
- **Security guidance** (https://developer.android.com/google/play/billing/security):
  - Check that `purchaseToken` is unique and store it.
  - Check the purchase state is PURCHASED and not PENDING.
  - Match `obfuscatedExternalAccountId` to the user.
  - Handle `linkedPurchaseToken` by revoking the old token's entitlement.
  - **Acknowledge within 3 days** or the purchase is auto-refunded. Server-side acknowledgement is preferred.
  - For fraud, use `orders.refund` with `revoke=true`.
- **RTDN** (https://developer.android.com/google/play/billing/rtdn-reference):
  - Delivered by Cloud Pub/Sub. The message `data` is base64 of a `DeveloperNotification` with `{version, packageName, eventTimeMillis, subscriptionNotification{version, notificationType, purchaseToken} | oneTimeProductNotification | voidedPurchaseNotification | testNotification}`.
  - Types: 1 RECOVERED, 2 RENEWED, 3 CANCELED, 4 PURCHASED, 5 ON_HOLD, 6 IN_GRACE_PERIOD, 7 RESTARTED, 9 DEFERRED, 10 PAUSED, 11 PAUSE_SCHEDULE_CHANGED, 12 REVOKED, 13 EXPIRED, 17 ITEMS_CHANGED, 18 CANCELLATION_SCHEDULED, 19 PRICE_CHANGE_UPDATED, 20 PENDING_PURCHASE_CANCELED, 22 PRICE_STEP_UP_CONSENT_UPDATED.
  - "RTDNs only indicate that a purchase state changed". After each one, call subscriptionsv2.get.
  - Deduplicate on `messageId`.

### Store rules relevant to this app
- **Apple 3.1.1** (https://developer.apple.com/app-store/review/guidelines/, last updated June 8, 2026): "If you want to unlock features or functionality within your app, (by way of example: subscriptions ...), you must use in-app purchase." A premium subscription (alerts, history, ad-free) therefore needs IAP. 3.1.1(a) and the StoreKit External Purchase Link entitlements allow extra link-outs in specific regions, including EU programs; US storefront apps need no entitlement for links.
- **Apple 3.1.2:** auto-renewable subscriptions must provide ongoing value and last at least 7 days.
- **Apple 5.2.2:** any display of third-party content (retailer prices, product images, logos) must be "specifically permitted ... under the service's terms of use. Authorization must be provided upon request." Apple 5.2.1 says not to use third-party trademarks without permission, which covers retailer logos.
- **Google Play Payments policy** (https://support.google.com/googleplay/android-developer/answer/9858738):
  - Google Play Billing is required for digital subscriptions and features.
  - It is not required for physical goods, and the policy names groceries. This matters only if the app ever sells groceries directly.
  - Alternative billing and external offers programs exist for eligible regions, including the EEA.
- **Google Play intellectual property / impersonation policies:** the same caution applies to retailer logos and content. The specific policy text was not fetched (**not verified**).

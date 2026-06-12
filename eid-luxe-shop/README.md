# Noor·Luxe — Eid al-Adha luxury e-commerce

Een volledige, professionele e-commerce frontend webapp voor een internationale
webshop in het teken van Eid al-Adha. Gebouwd in Next.js 14 (App Router) met
TypeScript, Tailwind CSS en Zustand voor state management.

> Mock-data alleen, klaar om gekoppeld te worden aan een echte backend
> (Shopify, WooCommerce, Stripe, Mollie, of eigen Prisma + REST API).

---

## ✨ Features

### Pagina's (15)
1. **Home** (`/`) — premium hero, featured categories, best sellers, Eid gift boxes,
   new arrivals, why-shop section, customer reviews, Instagram lifestyle grid,
   newsletter, footer.
2. **Shop** (`/shop`) — product grid met filters (categorie, doelgroep, prijs,
   beschikbaarheid), sortering, zoekfunctie, mobiele filter-drawer, URL
   query params (`?category=…`, `?audience=…`, `?sort=…`).
3. **Productdetail** (`/product/[slug]`) — gallery, badges, prijs, rating,
   beschrijving, what's inside, shipping/returns tabs, qty selector,
   add-to-cart, wishlist, trust badges, customer reviews, related products,
   breadcrumbs.
4. **Eid Gift Boxes** (`/gift-boxes`) — speciale landing met value props en
   alle gift boxes + family bundles.
5. **Collections** (`/collections`) — alle collections + categorieën.
6. **About** (`/about`) — brand story, values, stats.
7. **Contact** (`/contact`) — formulier + contact info.
8. **FAQ** (`/faq`) — accordion met 5 secties (ordering, shipping, tracking,
   returns, products).
9. **Wishlist** (`/wishlist`) — verlanglijst met empty state.
10. **Cart** (`/cart`) — winkelmand met qty controls, subtotaal, shipping,
    upsell suggesties.
11. **Checkout** (`/checkout`) — volledige mockup checkout flow met contact,
    shipping, payment method, order summary.
12. **Order confirmation** (`/order-confirmation`) — celebratory success page.
13. **Account** (`/account`) — login/register tabs (mockup).
14. **Privacy policy** (`/privacy`).
15. **Terms & conditions** (`/terms`).
16. **404** (`/not-found`).

### E-commerce functionaliteit
- 🛒 **Cart drawer + cart pagina** met persistent state (localStorage)
- ❤️ **Wishlist** met persistent state
- 🔍 **Zoekfunctie** in header (live preview) + op shop pagina
- 🎚️ **Filters** per categorie, doelgroep (hem/haar/kinderen/familie), prijs,
  voorraad
- 📊 **Sortering** (populariteit, best sellers, nieuw, prijs op/af)
- 🌍 **Currency selector** (EUR / USD / GBP) met live conversie
- 🗣️ **Language selector** (Nederlands / Engels / Frans) met i18n dictionary
- 🎁 **Badges**: Best Seller, Limited Eid Edition, Gift Ready, New, Premium
- 🔔 **Toast notifications** bij toevoegen aan cart/wishlist
- 📱 **Mobile-first**: hamburger menu, filter drawer, sticky cart icon
- 🛡️ **Trust elementen**: worldwide shipping, secure checkout, gift packaging,
  14-day returns, customer support

### Conversie-elementen
- Limited Eid Edition badges
- Save-XX% pricing badges
- "Only a few left" stock indicator
- Newsletter met 10% incentive
- Gift-ready packaging benadrukt
- Trust badges bij product en checkout
- Cross-sell in cart
- Related products op product pagina

### Mock data
- **24 producten** in `src/data/products.ts` met volledige metadata
- **12 categorieën** in `src/data/categories.ts`
- **8 verified reviews** in `src/data/reviews.ts`
- **3 talen** in `src/data/translations.ts`

---

## 🚀 Lokaal starten

```bash
cd eid-luxe-shop
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

### Build & production

```bash
npm run build
npm start
```

Het build-proces is succesvol getest — alle 17 routes compileren zonder fouten.

---

## 📁 Projectstructuur

```
eid-luxe-shop/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout met providers
│   │   ├── globals.css               # Tailwind + custom utilities
│   │   ├── page.tsx                  # Home
│   │   ├── shop/page.tsx
│   │   ├── product/[slug]/page.tsx   # Dynamic product page
│   │   ├── gift-boxes/page.tsx
│   │   ├── collections/page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── wishlist/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── order-confirmation/page.tsx
│   │   ├── account/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── MobileMenu.tsx
│   │   ├── product/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── FilterSidebar.tsx
│   │   │   ├── ReviewCard.tsx
│   │   │   └── TrustBadges.tsx
│   │   ├── cart/
│   │   │   └── CartDrawer.tsx
│   │   ├── home/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── CategoryCard.tsx
│   │   │   ├── EidGiftBoxesSection.tsx
│   │   │   ├── WhyShopSection.tsx
│   │   │   ├── NewsletterSection.tsx
│   │   │   ├── InstagramSection.tsx
│   │   │   └── SectionHeader.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Stars.tsx
│   │   │   ├── Price.tsx
│   │   │   ├── ProductImage.tsx       # Custom SVG product mocks
│   │   │   ├── LanguageCurrencySelector.tsx
│   │   │   └── Toast.tsx
│   │   └── providers/
│   │       └── Providers.tsx          # Wraps cart drawer + toast
│   ├── data/                          # Mock data — swap with API later
│   │   ├── products.ts                # 24 products
│   │   ├── categories.ts              # 12 categories
│   │   ├── reviews.ts
│   │   └── translations.ts            # 3 languages
│   ├── lib/
│   │   ├── store.ts                   # Zustand stores
│   │   ├── currency.ts                # FX conversion
│   │   ├── i18n.ts                    # Translation hook
│   │   ├── useMounted.ts              # SSR-safe hydration
│   │   └── utils.ts                   # cn(), slugify
│   └── types/
│       └── index.ts                   # TypeScript types
└── public/
```

---

## 🎨 Design system

| Token              | Waarde                                      |
| ------------------ | ------------------------------------------- |
| Primary            | Forest green `#2d5a3d` → `#11291a`          |
| Accent             | Gold `#d4af37` → `#f9e8b8`                  |
| Backgrounds        | Cream `#fdfbf6` → Sand `#e8d7ad`            |
| Text/CTA           | Warm brown `#553f29`                        |
| Display font       | Playfair Display                            |
| Body font          | Inter                                       |
| Radius             | Afgeronde hoeken (`rounded-2xl`/`3xl`)      |
| Shadows            | `shadow-soft`, `shadow-card`, `shadow-luxe` |
| Patterns           | Subtiele Arabische geometrische SVG overlays |

---

## 🔌 Klaar voor backend-integratie

De code is gestructureerd zodat je de mock-laag kunt vervangen zonder
componenten te herschrijven:

| Onderdeel              | Vervang met                                                |
| ---------------------- | ---------------------------------------------------------- |
| `src/data/products.ts` | API-call naar Shopify Storefront API / WooCommerce REST    |
| `src/data/categories.ts` | Categorie-endpoint                                        |
| `src/data/reviews.ts`  | Reviews via Yotpo, Trustpilot of eigen DB                  |
| `src/lib/currency.ts`  | Live rates via openexchangerates.org / ExchangeRate-API    |
| `src/lib/store.ts` (cart) | Server cart sync met Shopify cart API of eigen `/api/cart` |
| `/checkout` form       | Stripe Checkout / Mollie / Adyen sessions                  |
| `/account` form        | NextAuth.js / Auth.js / Clerk                              |
| `/contact` form        | API route → SendGrid, Resend, of CRM                       |
| Newsletter             | Mailchimp / Klaviyo / ConvertKit API                       |

**Volgende stappen voor productie:**
1. Maak Next.js API routes (`src/app/api/...`) of vervang door externe service.
2. Voeg betalingsprovider toe — Stripe (`@stripe/stripe-js`) of Mollie.
3. Voorraadbeheer via Shopify Admin API of eigen Prisma + Postgres.
4. Authenticatie met NextAuth.js (Google, email magic link).
5. Image hosting via Cloudinary / Shopify CDN — vervang `<ProductImage>` SVG
   mocks door echte productfotografie via `next/image`.
6. SEO: `generateMetadata` per product/categorie + sitemap.xml.
7. Analytics: Google Analytics 4 + Meta Pixel + Klaviyo.
8. Cookie consent banner (Cookiebot / Termly).

---

## 🧱 Tech stack

- **Next.js 14** — App Router, server components, static generation
- **React 18** — stable, with hooks
- **TypeScript** — fully typed
- **Tailwind CSS 3** — utility-first met custom theme
- **Zustand 4** — state management met persist middleware
- **Lucide React** — icon set
- **Google Fonts** (next/font) — Inter + Playfair Display + Cormorant Garamond

Alle externe assets zijn local-first: geen externe API calls op de eerste load,
behalve Google Fonts (cached door next/font op build).

---

## ✅ Build status

Geverifieerd: `npm run build` compileert succesvol alle 17 routes.

```
Route (app)                              Size     First Load JS
○ /                                      5.37 kB         106 kB
○ /shop                                  5.40 kB         111 kB
ƒ /product/[slug]                        7.03 kB         113 kB
○ /cart                                  4.48 kB         110 kB
... (17 total)
+ First Load JS shared by all            87.1 kB
```

---

## 📝 Notes

- Alle producten gebruiken een custom SVG-component (`ProductImage`) dat een
  unieke decoratieve mock-illustratie tekent op basis van slug + accent kleur.
  Vervang door echte fotografie wanneer beschikbaar.
- De `useMounted` hook voorkomt hydration-mismatch bij persistent stores.
- Alle teksten zijn in het Engels gezet als baseline (commercieel
  internationaal), met Nederlandse en Franse vertalingen klaar in
  `translations.ts`.
- Currency selector converteert prijzen live via mock rates — vervang door
  live FX API in productie.

Eid Mubarak ✦

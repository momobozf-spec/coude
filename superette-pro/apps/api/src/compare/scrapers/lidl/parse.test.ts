import { describe, expect, it } from 'vitest';
import { feedFileSchema } from '../../adapters/feed-schema';
import { buildLidlFeed } from './feed';
import { parseLidlTile, parsePack, splitBasePrice } from './parse';

/*
 * Fixtures: letterlijke waarden uit `data-grid-data` op
 * https://www.lidl.be/c/nl-BE/voeding-drank/s10068374 (6 oktober 2026).
 * Alleen de velden die de parser leest zijn behouden; afbeeldingen,
 * scores en tracking zijn weggelaten.
 */
const DATES = { storeStartDate: 1791496800, storeEndDate: 1791669599 };
const BADGE = {
  availabilityIndicator: 0,
  badgeInfo: { badges: [{ text: 'Enkel in de winkel van 09/10 - 10/10', type: 'IN_STORE_FROM_FUTURE_DATE_RANGE' }] },
  onlineAvailable: false,
};

const KIP = {
  brand: { showBrand: false },
  canonicalPath: '/p/nl-BE/kippenborstfilet/p10031380',
  canonicalUrl: '/p/nl-BE/kippenborstfilet/p10031380',
  category: 'Superweekend',
  keyfacts: {
    title: 'Kippenborstfilet',
    wonCategoryPrimary: 'Werelden van nood/Eten en dichtbij voedsel/Vlees & gevogelte/Gevogelte',
    wonCategoryPrimaryPath: '0/17/1738/173810',
  },
  lidlPlus: [],
  price: {
    basePrice: { prefix: false, text: '600 g - 8,32 EUR/kg' },
    currencyCode: 'EUR',
    discount: {
      absoluteDiscount: 2.5,
      deletedPrice: 7.49,
      bargainHintText: 'Megadeal',
      percentageDiscount: 33,
      showDiscount: true,
      showFrom: false,
      showPercentage: true,
      showUpTo: false,
    },
    oldPrice: 7.49,
    price: 4.99,
    variantsHaveDifferentPrices: false,
  },
  productId: 10031380,
  productType: 'RETAIL',
  stockAvailability: BADGE,
  ...DATES,
  title: 'Kippenborstfilet',
};

const FREEWAY = {
  brand: { name: 'FREEWAY', url: '/q/search?q=freeway', showBrand: true },
  canonicalPath: '/p/nl-BE/freeway-iced-tea-bruisend/p10031378',
  canonicalUrl: '/p/nl-BE/freeway-iced-tea-bruisend/p10031378',
  category: 'Superweekend',
  fullTitle: 'FREEWAY Iced tea bruisend',
  ians: ['165141'],
  lidlPlus: [],
  price: {
    basePrice: { prefix: false, text: '2 x 6 x 33 cl - 1,02 EUR/l' },
    currencyCode: 'EUR',
    discount: {
      absoluteDiscount: 1.34,
      deletedPrice: 5.38,
      discountText: '2E AAN -50%',
      percentageDiscount: 24,
      showDiscount: true,
      showFrom: false,
      showPercentage: true,
      showUpTo: false,
    },
    oldPrice: 5.38,
    price: 4.04,
    variantsHaveDifferentPrices: false,
  },
  productId: 10031378,
  stockAvailability: BADGE,
  ...DATES,
  title: 'Iced tea bruisend',
};

const PROSECCO_PLUS = {
  price: {
    basePrice: { prefix: false, text: '75 cl - 7,99 EUR/l' },
    discount: { absoluteDiscount: 2.5, deletedPrice: 8.49, discountText: '', discountTitle: '' },
    oldPrice: 8.49,
    packaging: { text: '' },
    price: 5.99,
    priceTheme: 'white_yellow',
  },
  regions: [''],
  stores: [''],
  lidlPlusText: 'Met je Lidl Plus-app',
  highlightText: '-29%',
};

const PROSECCO = {
  brand: { showBrand: false },
  canonicalPath: '/p/nl-BE/prosecco-docg-valdobbiadene-superiore/p10031388',
  canonicalUrl: '/p/nl-BE/prosecco-docg-valdobbiadene-superiore/p10031388',
  erpNumber: '10031388',
  fullTitle: 'Prosecco DOCG Valdobbiadene superiore*',
  lidlPlus: [PROSECCO_PLUS],
  // Geen gewone prijs: alleen de app-prijs staat op de tegel.
  price: { currencyCode: 'EUR', hasStar: false, hasVat: false, specialTaxes: [], variantsHaveDifferentPrices: false },
  productId: 10031388,
  stockAvailability: BADGE,
  ...DATES,
  title: 'Prosecco DOCG Valdobbiadene superiore*',
};

const parse = (tile: unknown) => parseLidlTile(JSON.stringify(tile));

describe('parseLidlTile', () => {
  // Kunstmatige grensgevallen op de echte fixture; geen nieuwe bronprijzen.
  it.each(['ca. 600 g', 'ca.600 g', 'circa 600 g', '+/- 600 g', '± 600 g', 'per kg', 'per liter', '8,32 EUR/kg', 'prijs/kg', '1 KGM', '1 LTR'])(
    'weigert wisselend gewicht of eenheidsprijs in het inhoudslabel: %s', (label) => {
      const tile = { ...KIP, price: { ...KIP.price, basePrice: { prefix: false, text: label } } };
      expect(parse(tile)).toMatchObject({ ok: false });
    },
  );

  it('weigert wisselend gewicht in de productnaam', () => {
    expect(parse({ ...KIP, fullTitle: 'Kippenborstfilet ca. 600 g' })).toMatchObject({ ok: false });
  });

  it.each(['KGM', 'LTR'])('weigert een broncode buiten het prijsblok: %s', (code) => {
    expect(parse({ ...KIP, keyfacts: { ...KIP.keyfacts, title: code } })).toMatchObject({ ok: false });
  });

  it('weigert een eenheidsprijs in de verpakkingsomschrijving', () => {
    expect(parse({ ...KIP, price: { ...KIP.price, packaging: { text: 'per kg' } } })).toMatchObject({ ok: false });
  });

  it('weigert ook wisselend gewicht in een Lidl Plus-prijs', () => {
    const plus = { ...PROSECCO_PLUS, price: { ...PROSECCO_PLUS.price, basePrice: { text: 'ca. 75 cl' } } };
    expect(parse({ ...PROSECCO, lidlPlus: [plus] })).toMatchObject({ ok: false });
  });

  it('kippenborstfilet: tijdelijke prijs met oude prijs, inhoud en actieperiode', () => {
    expect(parse(KIP)).toEqual({
      ok: true,
      product: {
        externalId: '10031380',
        name: 'Kippenborstfilet',
        brand: null,
        productUrl: 'https://www.lidl.be/p/nl-BE/kippenborstfilet/p10031380',
        categoryPath: 'Vlees & gevogelte / Gevogelte',
        packageQuantity: 600,
        packageUnit: 'G',
        packCount: 1,
        startsAt: '2026-10-08T22:00:00.000Z',
        endsAt: '2026-10-10T21:59:59.000Z',
      },
      offers: [
        {
          kind: 'STORE',
          priceCents: 499,
          originalPriceCents: 749,
          promotionType: 'TEMPORARY',
          promotionText: '-33%',
          promotionRule: null,
          requiresLoyaltyCard: false,
          conditions: 'Enkel in de winkel van 09/10 - 10/10',
        },
      ],
      skipped: [],
    });
  });

  it('Freeway "2E AAN -50%": één sixpack van € 2,69, twee samen € 4,04', () => {
    const result = parse(FREEWAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({ brand: 'FREEWAY', name: 'FREEWAY Iced tea bruisend', packageQuantity: 33, packageUnit: 'CL', packCount: 6 });
    expect(result.offers).toEqual([
      {
        kind: 'STORE',
        priceCents: 269,
        originalPriceCents: null,
        promotionType: 'MULTIBUY',
        promotionText: '2E AAN -50%',
        promotionRule: { kind: 'MULTIBUY', quantity: 2, totalCents: 404 },
        requiresLoyaltyCard: false,
        conditions: 'Enkel in de winkel van 09/10 - 10/10',
      },
    ]);
  });

  it('Prosecco: alleen een Lidl Plus-prijs, apart en met klantenkaart', () => {
    const result = parse(PROSECCO);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({ externalId: '10031388', name: 'Prosecco DOCG Valdobbiadene superiore', packageQuantity: 75, packageUnit: 'CL' });
    expect(result.offers).toEqual([
      {
        kind: 'LIDL_PLUS',
        priceCents: 599,
        originalPriceCents: 849,
        promotionType: 'LOYALTY_CARD',
        promotionText: '-29%',
        promotionRule: null,
        requiresLoyaltyCard: true,
        conditions: 'Met je Lidl Plus-app · Enkel in de winkel van 09/10 - 10/10',
      },
    ]);
  });

  it('Lidl Plus "3 + 2 GRATIS" zonder inhoud: prijs per stuk + regel, geen verzonnen inhoud', () => {
    // Echt Lidl Plus-blok van een andere tegel (€ 3,87 i.p.v. € 6,45), in de Prosecco-omhulling.
    const plus = { price: { basePrice: { prefix: false, text: '' }, discount: { deletedPrice: 6.45, discountText: '3 + 2 GRATIS' }, oldPrice: 6.45, price: 3.87 }, lidlPlusText: 'Met je Lidl Plus-app' };
    const result = parse({ ...PROSECCO, lidlPlus: [plus] });
    expect(result.ok && result.product.packageQuantity).toBeNull();
    expect(result.ok && result.offers[0]).toMatchObject({
      priceCents: 129,
      promotionType: 'LOYALTY_CARD',
      promotionText: '3 + 2 GRATIS',
      promotionRule: { kind: 'MULTIBUY', quantity: 5, totalCents: 387 },
    });
  });

  it('neemt geen inhoud over die niet klopt met Lidl’s eigen eenheidsprijs', () => {
    const wrong = { ...KIP, price: { ...KIP.price, basePrice: { prefix: false, text: '500 g - 8,32 EUR/kg' } } };
    const result = parse(wrong);
    expect(result.ok && result.product.packageQuantity).toBeNull();
    expect(result.ok && result.offers[0]?.priceCents).toBe(499);
  });

  it('weigert meervoudsacties waarvan inhoud en actie niet bij elkaar passen', () => {
    const mismatch = { ...FREEWAY, price: { ...FREEWAY.price, basePrice: { prefix: false, text: '6 x 33 cl - 1,02 EUR/l' } } };
    expect(parse(mismatch)).toMatchObject({ ok: false });
  });

  it('weigert "vanaf"-prijzen, varianten met verschillende prijzen en onbekende actieteksten', () => {
    expect(parse({ ...KIP, price: { ...KIP.price, discount: { ...KIP.price.discount, showFrom: true } } })).toMatchObject({ ok: false });
    expect(parse({ ...KIP, price: { ...KIP.price, variantsHaveDifferentPrices: true } })).toMatchObject({ ok: false });
    expect(parse({ ...FREEWAY, price: { ...FREEWAY.price, discount: { ...FREEWAY.price.discount, discountText: 'SUPERDEAL' } } })).toMatchObject({ ok: false });
  });

  it('ruimt een herhaalde categorienaam op, zoals in de echte pizzategel', () => {
    const pizza = { ...KIP, keyfacts: { wonCategoryPrimary: "Werelden van nood/Eten en dichtbij voedsel/Diepvriesvoeding (Diepvriesvoeding)/Diepvriespizza's & snacks" } };
    expect(parse(pizza).ok && (parse(pizza) as { product: { categoryPath: string } }).product.categoryPath).toBe("Diepvriesvoeding / Diepvriespizza's & snacks");
  });

  it('weigert tegels zonder geldige productlink of met tegenstrijdige id', () => {
    expect(parse({ ...KIP, canonicalUrl: '/c/nl-BE/voeding-drank/s10068374', canonicalPath: undefined })).toMatchObject({ ok: false });
    expect(parse({ ...KIP, productId: 1 })).toMatchObject({ ok: false });
    expect(parseLidlTile('{kapot')).toMatchObject({ ok: false });
  });
});

describe('hulpfuncties', () => {
  it('splitBasePrice en parsePack', () => {
    expect(splitBasePrice('2 x 6 x 33 cl - 1,02 EUR/l')).toEqual({ label: '2 x 6 x 33 cl', unitPriceCents: 102, per: 'L' });
    expect(splitBasePrice('2 x 2 l')).toEqual({ label: '2 x 2 l', unitPriceCents: null, per: null });
    expect(parsePack('2 x 6 x 33 cl')).toEqual({ quantity: 33, unit: 'CL', packCount: 12 });
    expect(parsePack('600 g')).toEqual({ quantity: 600, unit: 'G', packCount: 1 });
  });
});

describe('buildLidlFeed', () => {
  it('maakt een geldig importbestand met winkelkanaal en actieperiode', () => {
    const tiles = [KIP, FREEWAY, PROSECCO].map(parse).flatMap((r) => (r.ok ? [r] : []));
    const feed = buildLidlFeed(tiles, new Date('2026-10-06T09:00:00Z'));
    expect(feedFileSchema.safeParse(feed).success).toBe(true);
    expect(feed.source.termsReviewed).toBe(false);
    expect(feed.products).toHaveLength(3);
    expect(feed.offers.map((o) => o.sourceReference)).toEqual(['10031380:winkel', '10031378:winkel', '10031388:lidlplus']);
    expect(feed.offers.every((o) => o.channel === 'IN_STORE' && o.endsAt === '2026-10-10T21:59:59.000Z')).toBe(true);
  });
});

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LogPushSender } from '@superrette/ingestion';
import type {
  BasketComparisonDto,
  EquivalentDto,
  NotificationDto,
  PriceAlertDto,
  ProductDetailDto,
  SearchResponse,
  ShoppingListDetailDto,
  ShoppingListDto,
} from '@superrette/validation';
import { PUSH } from '../src/common/tokens.js';
import { bootApp, Client, login, registerUser, retailerIds } from './helpers.js';

let app: INestApplication;

beforeAll(async () => {
  app = await bootApp();
});

afterAll(async () => {
  await app.close();
});

describe('Vertical slice 1: search → compare → favourite → shopping list', () => {
  it('works end to end for a newly onboarded user', async () => {
    // Account creation + onboarding (country, language, retailer preferences, loyalty card).
    const { client } = await registerUser(app, 'Mohamed');
    const countries = await client.get('/v1/countries').expect(200);
    expect(countries.body.map((c: { code: string }) => c.code)).toEqual(['BE', 'NL']);
    const ids = await retailerIds(app, ['colruyt', 'delhaize', 'albert-heijn', 'lidl']);
    expect(Object.keys(ids)).toHaveLength(4);
    await client
      .put('/v1/me/retailers', {
        retailers: Object.values(ids).map((retailerId) => ({ retailerId, hasLoyaltyCard: false })),
      })
      .expect(200);
    const me = await client.patch('/v1/me', { onboardingCompleted: true, locale: 'nl', countryCode: 'BE' }).expect(200);
    expect(me.body.onboardingCompleted).toBe(true);

    // Search "halfvolle melk".
    const search = await client.get('/v1/search?q=halfvolle%20melk').expect(200);
    const result = search.body as SearchResponse;
    expect(result.interpretedTokens.sort()).toEqual(['halfvol', 'melk']);
    const names = result.items.map((i) => i.name);
    expect(names).toEqual(
      expect.arrayContaining(['Boni Halfvolle Melk 1 l', 'AH Halfvolle melk 1 l', 'Milbona Halfvolle melk 1 l']),
    );
    for (const item of result.items.filter((i) => i.cheapest)) {
      expect(item.cheapest!.unitPrice?.per).toBe('l');
      expect(item.dataOrigin).toBe('DEVELOPMENT_SEED'); // sample data is always labelled
    }
    // Cheapest €/L among the four retailers is Lidl's Milbona at €0,99.
    const byUnit = await client.get('/v1/search?q=halfvolle%20melk&sort=lowest_unit_price').expect(200);
    expect(byUnit.body.items[0]).toMatchObject({
      name: 'Milbona Halfvolle melk 1 l',
      cheapest: { retailerName: 'Lidl', priceCents: 99, unitPrice: { cents: 99, per: 'l' } },
    });

    // Open Boni milk; compare with equivalents at Delhaize, AH and Lidl.
    const boni = result.items.find((i) => i.name === 'Boni Halfvolle Melk 1 l')!;
    const detail = (await client.get(`/v1/products/${boni.variantId}`).expect(200)).body as ProductDetailDto;
    expect(detail.offers).toHaveLength(1);
    expect(detail.cheapest).toMatchObject({
      retailer: { slug: 'colruyt' },
      priceCents: 105,
      unitPrice: { cents: 105, per: 'l' },
      isCheapest: true,
    });
    const equivalents = (await client.get(`/v1/products/${boni.variantId}/equivalents`).expect(200))
      .body as EquivalentDto[];
    expect(equivalents.map((e) => e.name)).toEqual(
      expect.arrayContaining([
        'AH Halfvolle melk 1 l',
        'Milbona Halfvolle melk 1 l',
        'Delhaize Lait demi-écrémé / Halfvolle melk 1 l',
      ]),
    );
    expect(equivalents.every((e) => e.confidence >= 0.6)).toBe(true);
    expect(equivalents.map((e) => e.name)).not.toContain('Boni Volle Melk 1 l');

    // A-brand product sold everywhere: highlight the cheapest and €/L.
    const cola = (await client.get('/v1/search?q=coca%20cola%20zero%201.5L').expect(200)).body as SearchResponse;
    const colaDetail = (await client.get(`/v1/products/${cola.items[0]!.variantId}?scope=all`).expect(200))
      .body as ProductDetailDto;
    expect(colaDetail.name).toBe('Coca-Cola Zero Sugar 1,5 l');
    expect(colaDetail.offers.length).toBe(7);
    expect(colaDetail.cheapest).toMatchObject({
      retailer: { slug: 'dirk' },
      priceCents: 199,
      isPromotion: true,
      unitPrice: { cents: 133, per: 'l' },
    });
    const ah = colaDetail.offers.find((o) => o.retailer.slug === 'albert-heijn')!;
    expect(ah.priceCents).toBe(249); // "2 voor €4" does not make a single bottle €2
    expect(ah.missedPromotions[0]).toMatchObject({
      label: '2 voor €4',
      reason: 'NO_BENEFIT_AT_QUANTITY',
      minimumQuantity: 2,
    });

    // Favourite + add to shopping list.
    await client.put(`/v1/favorites/${boni.variantId}`).expect(204);
    const favs = await client.get('/v1/favorites').expect(200);
    expect(favs.body[0].product.variantId).toBe(boni.variantId);
    const list = (await client.post('/v1/lists', { name: 'Weekboodschappen', kind: 'weekly' }).expect(201))
      .body as ShoppingListDto;
    await client
      .post(`/v1/lists/${list.id}/items`, { title: detail.name, preferredVariantId: boni.variantId, quantity: 2 })
      .expect(201);
    const listDetail = (await client.get(`/v1/lists/${list.id}`).expect(200)).body as ShoppingListDetailDto;
    expect(listDetail.items[0]).toMatchObject({
      preferredVariantId: boni.variantId,
      quantity: 2,
      preferredVariantName: 'Boni Halfvolle Melk 1 l',
    });
    const detailAfter = (await client.get(`/v1/products/${boni.variantId}`).expect(200)).body as ProductDetailDto;
    expect(detailAfter.isFavorite).toBe(true);
  });
});

describe('Vertical slice 2: compare a list, review matches, change an equivalent', () => {
  it('recalculates totals when the user changes a product', async () => {
    const { client } = await registerUser(app, 'Sara');
    const ids = await retailerIds(app, ['colruyt', 'delhaize', 'albert-heijn']);
    await client
      .put('/v1/me/retailers', {
        retailers: Object.values(ids).map((retailerId) => ({ retailerId, hasLoyaltyCard: false })),
      })
      .expect(200);
    const list = (await client.post('/v1/lists', { name: 'Deze week', kind: 'thisWeek' }).expect(201))
      .body as ShoppingListDto;
    for (const title of ['Melk', 'Brood', 'Eieren'])
      await client.post(`/v1/lists/${list.id}/items`, { title }).expect(201);

    const compare = (await client.post(`/v1/lists/${list.id}/compare`).expect(200)).body as BasketComparisonDto;
    expect(compare.retailers.map((r) => r.retailer.name).sort()).toEqual(['Albert Heijn', 'Colruyt', 'Delhaize']);
    for (const r of compare.retailers) {
      expect(r).toMatchObject({ foundCount: 3, itemCount: 3, isComplete: true });
      expect(r.lines.every((l) => l.status === 'GENERIC' && (l.confidence ?? 0) >= 0.6)).toBe(true);
    }
    const colruyt = compare.retailers.find((r) => r.retailer.name === 'Colruyt')!;
    // Colruyt: Boni milk 1,05 + Boni bread 1,89 + Boni eggs 3,29 − €0,50 promo = 5,73
    expect(colruyt.totalCents).toBe(105 + 189 + 329 - 50);
    expect(colruyt.savingsCents).toBe(50);
    expect(compare.cheapestCompleteRetailerId).toBe(colruyt.retailer.id);

    // Review the milk match at Colruyt and choose another product.
    const milk = colruyt.lines.find((l) => l.title === 'Melk')!;
    expect(milk.selected?.name).toBe('Boni Halfvolle Melk 1 l');
    const arla = milk.alternatives.find((a) => a.name.startsWith('Arla'))!;
    expect(arla).toBeDefined();
    await client
      .put(`/v1/lists/${list.id}/items/${milk.itemId}/selection`, {
        retailerId: colruyt.retailer.id,
        retailerProductId: arla.retailerProductId,
      })
      .expect(204);

    const after = (await client.post(`/v1/lists/${list.id}/compare`).expect(200)).body as BasketComparisonDto;
    const colruytAfter = after.retailers.find((r) => r.retailer.name === 'Colruyt')!;
    const milkAfter = colruytAfter.lines.find((l) => l.title === 'Melk')!;
    expect(milkAfter.status).toBe('USER_SELECTED');
    expect(colruytAfter.totalCents).toBe(colruyt.totalCents - milk.selected!.totalCents + arla.totalCents);

    // Reset the choice.
    await client
      .put(`/v1/lists/${list.id}/items/${milk.itemId}/selection`, {
        retailerId: colruyt.retailer.id,
        retailerProductId: null,
      })
      .expect(204);
    const reset = (await client.post(`/v1/lists/${list.id}/compare`).expect(200)).body as BasketComparisonDto;
    expect(reset.retailers.find((r) => r.retailer.name === 'Colruyt')!.totalCents).toBe(colruyt.totalCents);
  });

  it('never hides missing products', async () => {
    const { client } = await registerUser(app);
    const ids = await retailerIds(app, ['lidl']);
    await client.put('/v1/me/retailers', { retailers: [{ retailerId: ids.lidl, hasLoyaltyCard: false }] }).expect(200);
    const list = (await client.post('/v1/lists', { name: 'Test' }).expect(201)).body as ShoppingListDto;
    await client.post(`/v1/lists/${list.id}/items`, { title: 'Tandpasta' }).expect(201);
    await client.post(`/v1/lists/${list.id}/items`, { title: 'Melk' }).expect(201);
    const compare = (await client.post(`/v1/lists/${list.id}/compare`).expect(200)).body as BasketComparisonDto;
    const lidl = compare.retailers[0]!;
    expect(lidl).toMatchObject({ foundCount: 1, itemCount: 2, isComplete: false });
    expect(lidl.lines.find((l) => l.title === 'Tandpasta')).toMatchObject({ status: 'MISSING', selected: null });
    expect(compare.cheapestCompleteRetailerId).toBeNull();
  });

  it('prefers the exact product and offers confirmed equivalents elsewhere', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const search = (await demo.get('/v1/search?q=boni%20halfvolle%20melk').expect(200)).body as SearchResponse;
    const boni = search.items.find((i) => i.name === 'Boni Halfvolle Melk 1 l')!;
    const list = (await demo.post('/v1/lists', { name: 'Exact' }).expect(201)).body as ShoppingListDto;
    await demo.post(`/v1/lists/${list.id}/items`, { title: 'Melk', preferredVariantId: boni.variantId }).expect(201);
    const compare = (await demo.post(`/v1/lists/${list.id}/compare`).expect(200)).body as BasketComparisonDto;
    const colruyt = compare.retailers.find((r) => r.retailer.name === 'Colruyt')!;
    expect(colruyt.lines[0]).toMatchObject({ status: 'EXACT', confidence: 1 });
    const ah = compare.retailers.find((r) => r.retailer.name === 'Albert Heijn')!;
    expect(ah.lines[0]?.status).toBe('EQUIVALENT');
    expect(ah.lines[0]?.selected?.name).toBe('AH Halfvolle melk 1 l');
  });
});

describe('Vertical slice 3: price alert → new observation → push notification', () => {
  it('triggers once and never duplicates', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const admin = await login(app, 'admin@superrette.local');
    await demo.post('/v1/push-tokens', { token: 'ExponentPushToken[test-device-demo]', platform: 'ios' }).expect(204);

    const cola = (await demo.get('/v1/search?q=coca%20cola%20zero%201,5').expect(200)).body as SearchResponse;
    const variantId = cola.items[0]!.variantId;
    const detail = (await demo.get(`/v1/products/${variantId}`).expect(200)).body as ProductDetailDto;
    // Demo follows Colruyt, Delhaize, AH, Lidl and Jumbo: cheapest is Colruyt €2,19 (not below €2).
    expect(detail.cheapest).toMatchObject({ retailer: { slug: 'colruyt' }, priceCents: 219 });

    const alert = (await demo.post('/v1/alerts', { variantId, targetPriceCents: 200 }).expect(201))
      .body as PriceAlertDto;
    expect(alert).toMatchObject({ targetPriceCents: 200, enabled: true, currentBestPriceCents: 219 });

    const colruytOffer = detail.offers.find((o) => o.retailer.slug === 'colruyt')!;
    const imported = await admin
      .post('/v1/admin/dev/price-observations', {
        retailerProductId: colruytOffer.retailerProductId,
        regularPriceCents: 219,
        promoPriceCents: 189,
      })
      .expect(201);
    expect(imported.body.stored).toBe(true);
    expect(imported.body.alerts.triggered).toBeGreaterThanOrEqual(1);

    const notifications = (await demo.get('/v1/notifications').expect(200)).body as {
      items: NotificationDto[];
      unread: number;
    };
    const n = notifications.items.find((x) => x.type === 'PRICE_ALERT' && x.data.alertId === alert.id)!;
    expect(n.title).toBe('Prijsalarm!');
    expect(n.body.replace(/\u00a0/g, ' ')).toBe('Coca-Cola Zero Sugar 1,5 l is nu € 1,89 bij Colruyt.');

    const push = app.get<LogPushSender>(PUSH);
    expect(push.sent.some((m) => m.to === 'ExponentPushToken[test-device-demo]' && m.title === 'Prijsalarm!')).toBe(
      true,
    );

    // The same observation again: no duplicate notification.
    const again = await admin
      .post('/v1/admin/dev/price-observations', {
        retailerProductId: colruytOffer.retailerProductId,
        regularPriceCents: 219,
        promoPriceCents: 189,
      })
      .expect(201);
    expect(again.body.alerts?.triggered ?? 0).toBe(0);
    const after = (await demo.get('/v1/notifications').expect(200)).body as { items: NotificationDto[] };
    expect(after.items.filter((x) => x.data.alertId === alert.id)).toHaveLength(1);

    // Price back up re-arms the alert; a new drop within the 24h cooldown stays silent (no spam).
    await admin
      .post('/v1/admin/dev/price-observations', {
        retailerProductId: colruytOffer.retailerProductId,
        regularPriceCents: 219,
        promoPriceCents: null,
      })
      .expect(201);
    const alerts = (await demo.get('/v1/alerts').expect(200)).body as PriceAlertDto[];
    expect(alerts.find((a) => a.id === alert.id)?.currentBestPriceCents).toBe(219);
    await new Client(app, admin.token)
      .post('/v1/admin/dev/price-observations', {
        retailerProductId: colruytOffer.retailerProductId,
        regularPriceCents: 219,
        promoPriceCents: 179,
      })
      .expect(201);
    const final = (await demo.get('/v1/notifications').expect(200)).body as { items: NotificationDto[] };
    expect(final.items.filter((x) => x.data.alertId === alert.id)).toHaveLength(1);
  });
});

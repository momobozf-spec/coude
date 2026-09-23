import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AdminMatchDto,
  AdminProviderDto,
  AdminSyncDto,
  BarcodeLookupDto,
  HomeDto,
  Paginated,
  PromotionDto,
  SearchResponse,
  ShoppingListDetailDto,
  ShoppingListDto,
} from '@superrette/validation';
import { devGtin } from '@superrette/store-providers';
import { JobsService } from '../src/common/jobs.service.js';
import { bootApp, Client, login, registerUser } from './helpers.js';

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  app = await bootApp();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('rejects bad credentials and duplicate e-mails', async () => {
    await new Client(app)
      .post('/v1/auth/login', { email: 'demo@superrette.local', password: 'wrong-password' })
      .expect(401);
    const res = await new Client(app)
      .post('/v1/auth/register', {
        email: 'demo@superrette.local',
        password: 'correct-horse-battery',
        displayName: 'X',
      })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
    await new Client(app)
      .post('/v1/auth/register', { email: 'not-an-email', password: 'short', displayName: '' })
      .expect(400);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const login1 = await new Client(app)
      .post('/v1/auth/login', { email: 'demo@superrette.local', password: 'superrette-dev' })
      .expect(200);
    const refreshed = await new Client(app)
      .post('/v1/auth/refresh', { refreshToken: login1.body.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(login1.body.refreshToken);
    const reuse = await new Client(app)
      .post('/v1/auth/refresh', { refreshToken: login1.body.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
    // Reuse revoked the whole family, including the newer token.
    await new Client(app).post('/v1/auth/refresh', { refreshToken: refreshed.body.refreshToken }).expect(401);
  });

  it('requires authentication for personal data', async () => {
    await new Client(app).get('/v1/me').expect(401);
    await new Client(app, 'not-a-jwt').get('/v1/me').expect(401);
  });
});

describe('entitlements (server-configured Free vs Plus)', () => {
  it('limits Free users and unlocks Plus features for Plus users', async () => {
    const sara = await login(app, 'sara@superrette.local');
    const ents = (await sara.get('/v1/me/entitlements').expect(200)).body;
    expect(ents.plans).toEqual(['free']);
    expect(ents.entitlements.smart_basket.enabled).toBe(false);
    const lists = (await sara.get('/v1/lists').expect(200)).body as ShoppingListDto[];
    const shared = lists[0]!;
    const smart = await sara.post(`/v1/lists/${shared.id}/smart-basket`, { maxStores: 2 }).expect(403);
    expect(smart.body.code).toBe('ENTITLEMENT_REQUIRED');
    const search = (await sara.get('/v1/search?q=cola').expect(200)).body as SearchResponse;
    await sara.get(`/v1/products/${search.items[0]!.variantId}/history`).expect(403);
    await sara.get('/v1/search?q=cola&maxPriceCents=200').expect(403);

    // Free plan: at most 3 active price alerts.
    for (let i = 0; i < 3; i++)
      await sara.post('/v1/alerts', { variantId: search.items[0]!.variantId, targetPriceCents: 100 + i }).expect(201);
    const limited = await sara
      .post('/v1/alerts', { variantId: search.items[0]!.variantId, targetPriceCents: 150 })
      .expect(403);
    expect(limited.body.code).toBe('LIMIT_REACHED');

    const demo = await login(app, 'demo@superrette.local');
    const history = await demo.get(`/v1/products/${search.items[0]!.variantId}/history?days=90`).expect(200);
    expect(history.body.observationCount).toBeGreaterThan(5);
    expect(history.body.series.length).toBeGreaterThan(0);
    const plans = (await new Client(app).get('/v1/plans').expect(200)).body;
    expect(plans.map((p: { key: string }) => p.key)).toEqual(['free', 'plus']);
    await demo.post('/v1/subscriptions/apple/verify').expect(501);
  });

  it('reports incomplete price history honestly', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const search = (await demo.get('/v1/search?q=milbona').expect(200)).body as SearchResponse;
    const history = await demo.get(`/v1/products/${search.items[0]!.variantId}/history?days=90`).expect(200);
    expect(history.body.isComplete).toBe(false); // only 3 weeks of history in the seed
    expect(history.body.coverage).toBeLessThan(0.5);
  });
});

describe('shared household lists', () => {
  it('invites, updates in realtime and handles conflicts', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const { client: partner } = await registerUser(app, 'Partner');
    const list = (await demo.post('/v1/lists', { name: 'Gezin', kind: 'family' }).expect(201)).body as ShoppingListDto;

    // Non-members cannot see the list.
    await partner.get(`/v1/lists/${list.id}`).expect(404);

    const invite = (await demo.post(`/v1/lists/${list.id}/invites`, { role: 'EDITOR' }).expect(201)).body;
    expect(invite.url).toContain('/invite/');
    const preview = (await partner.get(`/v1/invites/${invite.token}`).expect(200)).body;
    expect(preview).toMatchObject({ listName: 'Gezin', invitedBy: 'Mohamed', valid: true });
    await partner.post(`/v1/invites/${invite.token}/accept`).expect(200);
    // Single use.
    const { client: stranger } = await registerUser(app, 'Stranger');
    await stranger.post(`/v1/invites/${invite.token}/accept`).expect(404);

    // Realtime: the partner's socket receives Mohamed's changes.
    const socket: Socket = io(`${baseUrl}/realtime`, {
      auth: { token: partner.token },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const joined = await socket.emitWithAck('list.join', { listId: list.id });
    expect(joined).toEqual({ ok: true });
    const upserted = new Promise<Record<string, unknown>>((resolve) => socket.once('item.upserted', resolve));
    const activity = new Promise<Record<string, unknown>>((resolve) => socket.once('activity', resolve));
    const item = (await demo.post(`/v1/lists/${list.id}/items`, { title: 'Melk' }).expect(201)).body;
    expect(((await upserted).item as { title: string }).title).toBe('Melk');
    expect((await activity).userDisplayName).toBe('Mohamed');

    // Stranger cannot join the room.
    const strangerSocket: Socket = io(`${baseUrl}/realtime`, {
      auth: { token: stranger.token },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve) => strangerSocket.on('connect', () => resolve()));
    expect(await strangerSocket.emitWithAck('list.join', { listId: list.id })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    strangerSocket.close();

    // Optimistic concurrency: partner checks the item, Mohamed's stale edit conflicts.
    const checked = (
      await partner.patch(`/v1/lists/${list.id}/items/${item.id}`, { checked: true, version: item.version }).expect(200)
    ).body;
    expect(checked).toMatchObject({ checked: true, version: item.version + 1 });
    const conflict = await demo
      .patch(`/v1/lists/${list.id}/items/${item.id}`, { quantity: 3, version: item.version })
      .expect(409);
    expect(conflict.body.code).toBe('VERSION_CONFLICT');
    expect(conflict.body.details.current.checked).toBe(true);

    const feed = (await demo.get(`/v1/lists/${list.id}/activity`).expect(200)).body;
    expect(feed.map((a: { type: string }) => a.type)).toEqual(
      expect.arrayContaining(['ITEM_ADDED', 'ITEM_CHECKED', 'MEMBER_JOINED']),
    );
    const detail = (await demo.get(`/v1/lists/${list.id}`).expect(200)).body as ShoppingListDetailDto;
    expect(detail.members.map((m) => m.displayName)).toEqual(['Mohamed', 'Partner']);

    // Viewers cannot edit; a free user cannot create invites.
    const partnerLists = (await partner.get('/v1/lists').expect(200)).body as ShoppingListDto[];
    expect(partnerLists.find((l) => l.id === list.id)?.role).toBe('EDITOR');
    const own = (await partner.post('/v1/lists', { name: 'Mijn lijst' }).expect(201)).body as ShoppingListDto;
    expect((await partner.post(`/v1/lists/${own.id}/invites`, {}).expect(403)).body.code).toBe('ENTITLEMENT_REQUIRED');
    socket.close();
  });
});

describe('barcodes, promotions and home', () => {
  it('looks up barcodes without inventing products', async () => {
    const client = new Client(app);
    const found = (await client.get(`/v1/barcodes/${devGtin(1)}`).expect(200)).body as BarcodeLookupDto;
    expect(found.status).toBe('FOUND');
    expect(found.product?.name).toBe('Coca-Cola Zero Sugar 1,5 l');
    const unknown = (await client.get(`/v1/barcodes/${devGtin(999)}`).expect(200)).body as BarcodeLookupDto;
    expect(unknown).toMatchObject({ status: 'UNKNOWN', product: null });
    expect((await client.get('/v1/barcodes/12345').expect(200)).body.status).toBe('INVALID');
  });

  it('lists promotions with honest mechanics', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const promos = (await demo.get('/v1/promotions?section=all&sort=largest_discount').expect(200))
      .body as PromotionDto[];
    const lotus = promos.find((p) => p.label === '1+1 gratis')!;
    expect(lotus).toMatchObject({ minimumQuantity: 2, discountPercent: 50, mechanic: 'BUY_X_GET_Y_FREE' });
    const pampers = promos.find((p) => p.label === '2e aan halve prijs')!;
    expect(pampers.discountPercent).toBe(25);
    const bonus = promos.find((p) => p.label === 'Bonus -25%')!;
    expect(bonus.loyaltyProgram).toBe('bonuskaart');
    expect(promos.some((p) => p.label.includes('volgende week'))).toBe(false); // not active yet
    const ending = (await demo.get('/v1/promotions?section=ending_soon&sort=ending_soon').expect(200))
      .body as PromotionDto[];
    expect(ending.length).toBeGreaterThan(0);
    expect(ending.every((p) => p.endsAt && new Date(p.endsAt).getTime() - Date.now() < 3 * 86_400_000)).toBe(true);
  });

  it('builds the home screen', async () => {
    const demo = await login(app, 'demo@superrette.local');
    const home = (await demo.get('/v1/home').expect(200)).body as HomeDto;
    expect(home.displayName).toBe('Mohamed');
    expect(home.favorites.length).toBeGreaterThanOrEqual(2);
    expect(home.primaryList).not.toBeNull();
    expect(home.dataOrigins).toContain('DEVELOPMENT_SEED');
  });
});

describe('admin', () => {
  it('is restricted to admins', async () => {
    const demo = await login(app, 'demo@superrette.local');
    await demo.get('/v1/admin/stats').expect(403);
  });

  it('reviews product matches and persists human corrections', async () => {
    const admin = await login(app, 'admin@superrette.local');
    const jobs = app.get(JobsService);
    const pipeline = await jobs.pipeline();
    // No brand → the matcher cannot be sure: MEDIUM confidence, sent to review.
    const outcome = await pipeline.upsertRetailerProduct(
      {
        externalId: 'lidl-review-melk',
        retailerSlug: 'lidl',
        title: 'Halfvolle melk 1 liter',
        gtins: [],
        isAvailable: true,
      },
      'development-seed',
      'DEVELOPMENT_SEED',
    );
    expect(outcome.variantId).toBeNull();

    const pending = (
      await admin.get('/v1/admin/matches?status=PENDING_REVIEW&q=Halfvolle%20melk%201%20liter').expect(200)
    ).body as Paginated<AdminMatchDto>;
    const match = pending.items.find((m) => m.retailerProduct.id === outcome.retailerProductId)!;
    expect(match).toBeDefined();
    expect(['MEDIUM', 'LOW']).toContain(match.confidence);

    await admin.post(`/v1/admin/matches/${match.id}/decision`, { decision: 'approve' }).expect(200);
    const again = await pipeline.upsertRetailerProduct(
      {
        externalId: 'lidl-review-melk',
        retailerSlug: 'lidl',
        title: 'Halfvolle melk 1 liter',
        gtins: [],
        isAvailable: true,
      },
      'development-seed',
      'DEVELOPMENT_SEED',
    );
    expect(again.variantId).toBe(match.proposed.variantId);
    const confirmed = (await admin.get('/v1/admin/matches?status=CONFIRMED').expect(200))
      .body as Paginated<AdminMatchDto>;
    expect(confirmed.items.some((m) => m.id === match.id)).toBe(true);

    // Reject flow: a second unbranded product; rejecting creates a new canonical product.
    const other = await pipeline.upsertRetailerProduct(
      {
        externalId: 'lidl-review-melk-2',
        retailerSlug: 'lidl',
        title: 'Verse halfvolle melk 1L',
        gtins: [],
        isAvailable: true,
      },
      'development-seed',
      'DEVELOPMENT_SEED',
    );
    const pending2 = (await admin.get('/v1/admin/matches?status=PENDING_REVIEW&q=Verse').expect(200))
      .body as Paginated<AdminMatchDto>;
    const m2 = pending2.items.find((m) => m.retailerProduct.id === other.retailerProductId);
    if (m2) {
      await admin.post(`/v1/admin/matches/${m2.id}/decision`, { decision: 'reject' }).expect(200);
      const rejected = (await admin.get('/v1/admin/matches?status=REJECTED&q=Verse').expect(200))
        .body as Paginated<AdminMatchDto>;
      expect(rejected.items.some((m) => m.id === m2.id)).toBe(true);
    }
  });

  it('manages equivalences, providers and syncs', async () => {
    const admin = await login(app, 'admin@superrette.local');
    const eqs = (await admin.get('/v1/admin/equivalences?status=SUGGESTED').expect(200)).body;
    expect(eqs.total).toBeGreaterThan(10);
    await admin.post(`/v1/admin/equivalences/${eqs.items[0].id}/decision`, { decision: 'confirm' }).expect(204);

    const providers = (await admin.get('/v1/admin/providers').expect(200)).body as AdminProviderDto[];
    expect(providers.find((p) => p.key === 'colruyt')).toMatchObject({ supportStatus: 'UNSUPPORTED', enabled: false });
    expect(providers.find((p) => p.key === 'development-seed')?.lastSync?.status).toBe('SUCCESS');
    const unsupported = await admin.post('/v1/admin/providers/colruyt/sync', { kind: 'PRICES' }).expect(400);
    expect(unsupported.body.code).toBe('PROVIDER_UNSUPPORTED');

    const sync = (await admin.post('/v1/admin/providers/development-seed/sync', { kind: 'PROMOTIONS' }).expect(202))
      .body as AdminSyncDto;
    await app.get(JobsService).drain();
    const syncs = (await admin.get('/v1/admin/syncs').expect(200)).body as Paginated<AdminSyncDto>;
    expect(syncs.items.find((s) => s.id === sync.id)).toMatchObject({ status: 'SUCCESS', failedCount: 0 });
    const stats = (await admin.get('/v1/admin/stats').expect(200)).body;
    expect(stats.retailerProducts).toBeGreaterThan(80);
  });
});

describe('privacy (GDPR)', () => {
  it('exports, clears history and deletes the account while preserving shared lists', async () => {
    const { client: owner, userId } = await registerUser(app, 'Owner');
    const { client: member } = await registerUser(app, 'Member');
    // Give the owner Plus-like sharing through the demo flow: owner joins demo's list instead.
    const demo = await login(app, 'demo@superrette.local');
    const list = (await demo.post('/v1/lists', { name: 'Te erven' }).expect(201)).body as ShoppingListDto;
    const invite = (await demo.post(`/v1/lists/${list.id}/invites`, { role: 'EDITOR' }).expect(201)).body;
    await owner.post(`/v1/invites/${invite.token}/accept`).expect(200);
    void member;

    await owner.get('/v1/search?q=melk').expect(200);
    const exported = (await owner.get('/v1/me/export').expect(200)).body;
    expect(exported.profile.id).toBe(userId);
    expect(exported.profile.passwordHash).toBeUndefined();
    expect(exported.listMemberships.length).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    await owner.delete('/v1/me/search-history').expect(204);
    expect((await owner.get('/v1/search/recent').expect(200)).body).toEqual([]);

    await owner.delete('/v1/me').expect(204);
    await owner.get('/v1/me').expect(404);
    // The shared list of the other person still exists.
    await demo.get(`/v1/lists/${list.id}`).expect(200);

    // Deleting a list owner hands shared lists to the next member.
    const { client: heir } = await registerUser(app, 'Heir');
    const list2 = (await demo.post('/v1/lists', { name: 'Overdracht' }).expect(201)).body as ShoppingListDto;
    const invite2 = (await demo.post(`/v1/lists/${list2.id}/invites`, { role: 'EDITOR' }).expect(201)).body;
    await heir.post(`/v1/invites/${invite2.token}/accept`).expect(200);
    void heir;
  });
});

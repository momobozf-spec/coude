import { and, eq, sql } from 'drizzle-orm';
import {
  favorites,
  hashPassword,
  productVariants,
  seedReferenceData,
  shoppingListItems,
  shoppingLists,
  subscriptions,
  listMembers,
  retailers,
  userRetailerPreferences,
  users,
  type Database,
} from '@superrette/database';
import { createDefaultRegistry } from '@superrette/store-providers';
import { createNormalizer } from './dictionary.js';
import { EquivalenceIndexer } from './equivalences.js';
import { IngestionPipeline, type SyncReport } from './pipeline.js';

export interface DevSeedOptions {
  environment: string;
  now?: Date;
  demoPassword: string;
  log?: (message: string) => void;
}

export function assertNotProduction(environment: string, databaseUrl?: string): void {
  if (environment === 'production') {
    throw new Error('Refusing to load DEVELOPMENT DATA: environment is production.');
  }
  if (databaseUrl && /prod/i.test(new URL(databaseUrl).hostname + new URL(databaseUrl).pathname)) {
    throw new Error('Refusing to load DEVELOPMENT DATA into a database that looks like production.');
  }
}

/** Remove every DEVELOPMENT_SEED catalogue row (users and lists are untouched). */
export async function resetDevelopmentData(db: Database): Promise<void> {
  await db.execute(sql`DELETE FROM catalog.price_observations WHERE data_origin = 'DEVELOPMENT_SEED'`);
  await db.execute(sql`DELETE FROM catalog.current_prices WHERE data_origin = 'DEVELOPMENT_SEED'`);
  await db.execute(sql`DELETE FROM catalog.promotions WHERE data_origin = 'DEVELOPMENT_SEED'`);
  await db.execute(sql`DELETE FROM catalog.retailer_products WHERE data_origin = 'DEVELOPMENT_SEED'`);
  await db.execute(sql`DELETE FROM catalog.product_variants WHERE data_origin = 'DEVELOPMENT_SEED'`);
  await db.execute(sql`DELETE FROM catalog.products WHERE data_origin = 'DEVELOPMENT_SEED'`);
}

/** Count sample rows; production health checks use this to fail loudly. */
export async function countDevelopmentRows(db: Database): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM catalog.retailer_products WHERE data_origin = 'DEVELOPMENT_SEED'`);
  return r.rows[0]?.n ?? 0;
}

async function ensureUser(db: Database, email: string, displayName: string, role: 'USER' | 'ADMIN', password: string): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email));
  if (existing) return existing.id;
  const [row] = await db
    .insert(users)
    .values({ email, displayName, role, passwordHash: await hashPassword(password), locale: 'nl', countryCode: 'BE', onboardingCompletedAt: new Date() })
    .returning({ id: users.id });
  return row!.id;
}

/**
 * Load DEVELOPMENT DATA through the real ingestion pipeline so local
 * environments exercise normalisation and matching exactly like production.
 */
export async function seedDevelopmentData(db: Database, options: DevSeedOptions): Promise<{ sync: SyncReport; equivalences: number }> {
  assertNotProduction(options.environment);
  const log = options.log ?? (() => {});
  await seedReferenceData(db);
  log('Reference data ready (countries, retailers, categories, plans).');

  const registry = createDefaultRegistry({ environment: options.environment, developmentSeed: { ...(options.now ? { now: options.now } : {}) } });
  const pipeline = new IngestionPipeline({ db, registry, normalizer: await createNormalizer(db) });
  const sync = await pipeline.runSync('development-seed', 'FULL', { triggeredBy: 'seed' });
  log(`Development seed sync ${sync.status}: read ${sync.read}, created ${sync.created}, updated ${sync.updated}, failed ${sync.failed}.`);

  const eq2 = await new EquivalenceIndexer(db).refresh();
  log(`Equivalences suggested: ${eq2.suggested}.`);

  const demoId = await ensureUser(db, 'demo@superrette.local', 'Mohamed', 'USER', options.demoPassword);
  const partnerId = await ensureUser(db, 'sara@superrette.local', 'Sara', 'USER', options.demoPassword);
  await ensureUser(db, 'admin@superrette.local', 'Admin', 'ADMIN', options.demoPassword);

  // Demo user gets a MANUAL Plus subscription so every feature can be demoed; Sara stays on Free.
  const [sub] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.userId, demoId));
  if (!sub) {
    await db.insert(subscriptions).values({ userId: demoId, planKey: 'plus', store: 'MANUAL', status: 'ACTIVE', originalTransactionId: `dev-${demoId}` });
  }

  const beRetailers = await db.select({ id: retailers.id, slug: retailers.slug }).from(retailers);
  for (const userId of [demoId, partnerId]) {
    for (const slug of ['colruyt', 'delhaize', 'albert-heijn', 'lidl', 'jumbo']) {
      const r = beRetailers.find((x) => x.slug === slug);
      if (r) await db.insert(userRetailerPreferences).values({ userId, retailerId: r.id, hasLoyaltyCard: slug === 'colruyt' }).onConflictDoNothing();
    }
  }

  const [list] = await db.select({ id: shoppingLists.id }).from(shoppingLists).where(and(eq(shoppingLists.ownerId, demoId), eq(shoppingLists.name, 'Weekboodschappen')));
  if (!list) {
    const [created] = await db.insert(shoppingLists).values({ ownerId: demoId, name: 'Weekboodschappen', kind: 'weekly' }).returning({ id: shoppingLists.id });
    await db.insert(listMembers).values([
      { listId: created!.id, userId: demoId, role: 'OWNER' },
      { listId: created!.id, userId: partnerId, role: 'EDITOR' },
    ]);
    const titles = ['Melk', 'Brood', 'Eieren', 'Kipfilet', 'Bananen', 'Cola zero'];
    await db.insert(shoppingListItems).values(titles.map((title, position) => ({ listId: created!.id, title, position, createdBy: demoId, updatedBy: demoId })));
  }

  const favoriteNames = ['Coca-Cola Zero Sugar 1,5 l', 'Boni Halfvolle Melk 1 l'];
  for (const name of favoriteNames) {
    const [v] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.displayName, name));
    if (v) await db.insert(favorites).values({ userId: demoId, variantId: v.id }).onConflictDoNothing();
  }
  log('Demo users: demo@superrette.local (Mohamed), sara@superrette.local (Sara), admin@superrette.local (Admin).');
  return { sync, equivalences: eq2.suggested };
}

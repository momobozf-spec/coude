import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { productVariants, retailerProducts, retailers } from './catalog.js';
import {
  app,
  listMemberRole,
  notificationType,
  pushPlatform,
  subscriptionStatus,
  subscriptionStore,
  userRole,
} from './enums.js';

// Everything in the `app` schema is personal data: covered by export/delete.

export const users = app.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: userRole('role').notNull().default('USER'),
    locale: text('locale').notNull().default('nl'),
    countryCode: char('country_code', { length: 2 }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(sql`lower(${t.email})`)],
);

export const sessions = app.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const userRetailerPreferences = app.table(
  'user_retailer_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    hasLoyaltyCard: boolean('has_loyalty_card').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.retailerId] })],
);

export const favorites = app.table(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.variantId] })],
);

export const shoppingLists = app.table(
  'shopping_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Preset key (weekly, weekend, ramadan, family) or "custom". */
    kind: text('kind').notNull().default('custom'),
    icon: text('icon'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shopping_lists_owner_idx').on(t.ownerId)],
);

/** SharedList membership: who can see/edit a list besides the owner. */
export const listMembers = app.table(
  'list_members',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: listMemberRole('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index('list_members_user_idx').on(t.userId)],
);

export const listInvites = app.table('list_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  /** Only the SHA-256 of the invite token is stored. */
  tokenHash: text('token_hash').notNull().unique(),
  role: listMemberRole('role').notNull().default('EDITOR'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItems = app.table(
  'shopping_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    quantity: integer('quantity').notNull().default(1),
    preferredVariantId: uuid('preferred_variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    preferredBrand: text('preferred_brand'),
    notes: text('notes'),
    categorySlug: text('category_slug'),
    checked: boolean('checked').notNull().default(false),
    checkedBy: uuid('checked_by').references(() => users.id, { onDelete: 'set null' }),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
    /** Optimistic concurrency version, incremented on every change. */
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shopping_list_items_list_idx').on(t.listId, t.position)],
);

/** "Wijzig product": the user's chosen retailer product for a list item at one retailer. */
export const listItemSelections = app.table(
  'list_item_selections',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => shoppingListItems.id, { onDelete: 'cascade' }),
    retailerId: uuid('retailer_id')
      .notNull()
      .references(() => retailers.id, { onDelete: 'cascade' }),
    retailerProductId: uuid('retailer_product_id')
      .notNull()
      .references(() => retailerProducts.id, { onDelete: 'cascade' }),
    selectedBy: uuid('selected_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.retailerId] })],
);

export const listActivity = app.table(
  'list_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('list_activity_list_idx').on(t.listId, t.createdAt.desc())],
);

export const priceAlerts = app.table(
  'price_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    retailerId: uuid('retailer_id').references(() => retailers.id, { onDelete: 'cascade' }),
    targetPriceCents: integer('target_price_cents'),
    promotionOnly: boolean('promotion_only').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    armed: boolean('armed').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    lastTriggeredPriceCents: integer('last_triggered_price_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_alerts_variant_idx').on(t.variantId, t.enabled), index('price_alerts_user_idx').on(t.userId)],
);

export const priceAlertTriggers = app.table(
  'price_alert_triggers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    alertId: uuid('alert_id')
      .notNull()
      .references(() => priceAlerts.id, { onDelete: 'cascade' }),
    /** Unique: the database itself guarantees a trigger is never recorded twice. */
    dedupeKey: text('dedupe_key').notNull().unique(),
    retailerProductId: uuid('retailer_product_id').references(() => retailerProducts.id, { onDelete: 'set null' }),
    priceCents: integer('price_cents').notNull(),
    reason: text('reason').notNull(),
    notificationId: uuid('notification_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_alert_triggers_alert_idx').on(t.alertId)],
);

export const notifications = app.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt.desc())],
);

export const pushTokens = app.table(
  'push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    platform: pushPlatform('platform').notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

export const searchHistory = app.table(
  'search_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('search_history_user_idx').on(t.userId, t.createdAt.desc())],
);

// ─── Plans & subscriptions (server-configurable entitlements) ────────────────

export const plans = app.table('plans', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  /** Store product identifiers that grant this plan. */
  appleProductIds: text('apple_product_ids')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  googleProductIds: text('google_product_ids')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const planEntitlements = app.table(
  'plan_entitlements',
  {
    planKey: text('plan_key')
      .notNull()
      .references(() => plans.key, { onDelete: 'cascade' }),
    entitlementKey: text('entitlement_key').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** null = unlimited */
    limitValue: integer('limit_value'),
  },
  (t) => [primaryKey({ columns: [t.planKey, t.entitlementKey] })],
);

export const subscriptions = app.table(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planKey: text('plan_key')
      .notNull()
      .references(() => plans.key),
    store: subscriptionStore('store').notNull(),
    status: subscriptionStatus('status').notNull(),
    storeProductId: text('store_product_id'),
    originalTransactionId: text('original_transaction_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_user_idx').on(t.userId),
    uniqueIndex('subscriptions_store_tx_idx').on(t.store, t.originalTransactionId),
  ],
);

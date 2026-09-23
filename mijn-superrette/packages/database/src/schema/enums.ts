import { pgSchema } from 'drizzle-orm/pg-core';
import {
  DATA_ORIGINS,
  EQUIVALENCE_STATUSES,
  LIST_MEMBER_ROLES,
  MATCH_CONFIDENCES,
  MATCH_METHODS,
  MATCH_STATUSES,
  NOTIFICATION_TYPES,
  PROMOTION_MECHANICS,
  RETAILER_TYPES,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STORES,
  SYNC_KINDS,
  SYNC_STATUSES,
  USER_ROLES,
} from '@superrette/domain';

/**
 * Three PostgreSQL schemas keep concerns (and GDPR scope) separate:
 *   catalog — retailer/product/price data, contains no personal data
 *   ingest  — provider sync bookkeeping and raw import errors
 *   app     — personal user data (accounts, lists, favourites, alerts)
 */
export const catalog = pgSchema('catalog');
export const ingest = pgSchema('ingest');
export const app = pgSchema('app');

export const retailerType = catalog.enum('retailer_type', RETAILER_TYPES);
export const dataOrigin = catalog.enum('data_origin', DATA_ORIGINS);
export const unitEnum = catalog.enum('unit', ['g', 'kg', 'ml', 'l', 'piece']);
export const baseUnitEnum = catalog.enum('base_unit', ['g', 'ml', 'piece']);
export const matchConfidence = catalog.enum('match_confidence', MATCH_CONFIDENCES);
export const matchMethod = catalog.enum('match_method', MATCH_METHODS);
export const matchStatus = catalog.enum('match_status', MATCH_STATUSES);
export const equivalenceStatus = catalog.enum('equivalence_status', EQUIVALENCE_STATUSES);
export const promotionMechanic = catalog.enum('promotion_mechanic', PROMOTION_MECHANICS);

export const syncStatus = ingest.enum('sync_status', SYNC_STATUSES);
export const syncKind = ingest.enum('sync_kind', SYNC_KINDS);
export const ingestStage = ingest.enum('ingest_stage', ['FETCH', 'VALIDATION', 'NORMALIZATION', 'MATCHING', 'PERSIST', 'ALERTS']);

export const userRole = app.enum('user_role', USER_ROLES);
export const listMemberRole = app.enum('list_member_role', LIST_MEMBER_ROLES);
export const notificationType = app.enum('notification_type', NOTIFICATION_TYPES);
export const subscriptionStore = app.enum('subscription_store', SUBSCRIPTION_STORES);
export const subscriptionStatus = app.enum('subscription_status', SUBSCRIPTION_STATUSES);
export const pushPlatform = app.enum('push_platform', ['ios', 'android', 'web']);

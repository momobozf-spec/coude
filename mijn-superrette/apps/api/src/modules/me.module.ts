import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Patch, Put } from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  favorites,
  listMembers,
  notifications,
  priceAlerts,
  priceAlertTriggers,
  pushTokens,
  searchHistory,
  sessions,
  shoppingListItems,
  shoppingLists,
  subscriptions,
  userRetailerPreferences,
  users,
  type Database,
} from '@superrette/database';
import {
  retailerPreferencesSchema,
  updateProfileSchema,
  type EntitlementsDto,
  type RetailerPreferenceDto,
  type RetailerPreferencesInput,
  type UpdateProfileInput,
  type UserDto,
} from '@superrette/validation';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { EntitlementsService } from '../common/core.services.js';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { userDto } from './auth.module.js';

/**
 * Profile, retailer preferences and GDPR rights (access/export, erasure).
 * Only data in the `app` schema is personal; catalogue data is not.
 */
@Injectable()
export class MeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async profile(userId: string): Promise<UserDto> {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw notFound('User');
    return userDto(u);
  }

  async update(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    await this.db
      .update(users)
      .set({
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.onboardingCompleted ? { onboardingCompletedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return this.profile(userId);
  }

  async retailers(userId: string): Promise<RetailerPreferenceDto[]> {
    return this.db
      .select({ retailerId: userRetailerPreferences.retailerId, hasLoyaltyCard: userRetailerPreferences.hasLoyaltyCard })
      .from(userRetailerPreferences)
      .where(eq(userRetailerPreferences.userId, userId));
  }

  async setRetailers(userId: string, input: RetailerPreferencesInput): Promise<RetailerPreferenceDto[]> {
    await this.db.transaction(async (tx) => {
      await tx.delete(userRetailerPreferences).where(eq(userRetailerPreferences.userId, userId));
      await tx.insert(userRetailerPreferences).values(input.retailers.map((r) => ({ userId, retailerId: r.retailerId, hasLoyaltyCard: r.hasLoyaltyCard })));
    });
    return this.retailers(userId);
  }

  /** GDPR Art. 15/20: everything we store about the user, machine-readable. */
  async export(userId: string): Promise<Record<string, unknown>> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw notFound('User');
    const { passwordHash: _omit, ...profile } = user;
    const memberships = await this.db.select().from(listMembers).where(eq(listMembers.userId, userId));
    const listIds = memberships.map((m) => m.listId);
    const alerts = await this.db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId));
    return {
      exportedAt: new Date().toISOString(),
      profile,
      retailerPreferences: await this.db.select().from(userRetailerPreferences).where(eq(userRetailerPreferences.userId, userId)),
      favorites: await this.db.select().from(favorites).where(eq(favorites.userId, userId)),
      shoppingLists: listIds.length ? await this.db.select().from(shoppingLists).where(inArray(shoppingLists.id, listIds)) : [],
      shoppingListItems: listIds.length ? await this.db.select().from(shoppingListItems).where(inArray(shoppingListItems.listId, listIds)) : [],
      listMemberships: memberships,
      priceAlerts: alerts,
      priceAlertTriggers: alerts.length ? await this.db.select().from(priceAlertTriggers).where(inArray(priceAlertTriggers.alertId, alerts.map((a) => a.id))) : [],
      notifications: await this.db.select().from(notifications).where(eq(notifications.userId, userId)),
      searchHistory: await this.db.select().from(searchHistory).where(eq(searchHistory.userId, userId)),
      subscriptions: await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      pushDevices: (await this.db.select({ platform: pushTokens.platform, createdAt: pushTokens.createdAt }).from(pushTokens).where(eq(pushTokens.userId, userId))),
      sessions: await this.db.select({ createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.userId, userId)),
    };
  }

  async deleteSearchHistory(userId: string): Promise<void> {
    await this.db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  /**
   * GDPR Art. 17: delete the account. Lists shared with others are handed to
   * the longest-standing member so their data is not destroyed; everything
   * else owned by the user cascades away.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const owned = await tx.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.ownerId, userId));
      for (const list of owned) {
        const [heir] = await tx
          .select({ userId: listMembers.userId })
          .from(listMembers)
          .where(and(eq(listMembers.listId, list.id), ne(listMembers.userId, userId), ne(listMembers.role, 'VIEWER')))
          .orderBy(asc(listMembers.joinedAt))
          .limit(1);
        if (heir) {
          await tx.update(shoppingLists).set({ ownerId: heir.userId }).where(eq(shoppingLists.id, list.id));
          await tx.update(listMembers).set({ role: 'OWNER' }).where(and(eq(listMembers.listId, list.id), eq(listMembers.userId, heir.userId)));
        }
      }
      // Activity mentioning the user keeps the event but loses the identity (FK set null).
      await tx.execute(sql`UPDATE app.list_activity SET payload = payload - 'actorName' WHERE user_id = ${userId}`);
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
}

@Controller('v1/me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  profile(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.me.profile(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput): Promise<UserDto> {
    return this.me.update(user.id, body);
  }

  @Get('retailers')
  retailers(@CurrentUser() user: AuthUser): Promise<RetailerPreferenceDto[]> {
    return this.me.retailers(user.id);
  }

  @Put('retailers')
  setRetailers(@CurrentUser() user: AuthUser, @Body(new ZodPipe(retailerPreferencesSchema)) body: RetailerPreferencesInput): Promise<RetailerPreferenceDto[]> {
    return this.me.setRetailers(user.id, body);
  }

  @Get('entitlements')
  getEntitlements(@CurrentUser() user: AuthUser): Promise<EntitlementsDto> {
    return this.entitlements.get(user.id);
  }

  @Get('export')
  export(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.me.export(user.id);
  }

  @Delete('search-history')
  @HttpCode(204)
  async deleteHistory(@CurrentUser() user: AuthUser): Promise<void> {
    await this.me.deleteSearchHistory(user.id);
  }

  @Delete()
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AuthUser): Promise<void> {
    await this.me.deleteAccount(user.id);
  }
}

@Module({ controllers: [MeController], providers: [MeService] })
export class MeModule {}

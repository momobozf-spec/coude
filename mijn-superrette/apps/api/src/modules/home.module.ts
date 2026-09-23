import { Controller, Get, Inject, Module } from '@nestjs/common';
import { and, count, eq, isNull } from 'drizzle-orm';
import { notifications, users, type Database } from '@superrette/database';
import type { HomeDto } from '@superrette/validation';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { ShopperContextService } from '../common/core.services.js';
import { DB } from '../common/tokens.js';
import { FavoritesModule, FavoritesService } from './favorites.module.js';
import { ListsModule } from './lists/lists.module.js';
import { ListsService } from './lists/lists.service.js';
import { PromotionsModule, PromotionsService } from './promotions.module.js';

/** One round-trip for the Home screen. */
@Controller('v1/home')
export class HomeController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly shoppers: ShopperContextService,
    private readonly favorites: FavoritesService,
    private readonly promotions: PromotionsService,
    private readonly lists: ListsService,
  ) {}

  @Get()
  async home(@CurrentUser() user: AuthUser): Promise<HomeDto> {
    const shopper = await this.shoppers.get(user.id);
    const [[profile], favorites, promotionsForYou, lists, [unread]] = await Promise.all([
      this.db.select({ displayName: users.displayName }).from(users).where(eq(users.id, user.id)),
      this.favorites.list(shopper, 10),
      this.promotions.list({ section: 'for_you', sort: 'largest_discount', limit: 10 }, shopper),
      this.lists.lists(user.id),
      this.db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    ]);
    return {
      displayName: profile?.displayName ?? '',
      favorites,
      promotionsForYou,
      primaryList: lists[0] ?? null,
      unreadNotifications: unread?.value ?? 0,
      dataOrigins: [...new Set([...favorites.map((f) => f.product.dataOrigin), ...promotionsForYou.map((p) => p.dataOrigin)].filter((o): o is NonNullable<typeof o> => o != null))],
    };
  }
}

@Module({ imports: [FavoritesModule, PromotionsModule, ListsModule], controllers: [HomeController] })
export class HomeModule {}

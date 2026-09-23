import { Body, Controller, Delete, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { notifications, pushTokens, type Database } from '@superrette/database';
import { pushTokenSchema, type NotificationDto } from '@superrette/validation';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

@Controller('v1')
export class NotificationsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('notifications')
  async list(@CurrentUser() user: AuthUser): Promise<{ items: NotificationDto[]; unread: number }> {
    const rows = await this.db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
    const [{ value } = { value: 0 }] = await this.db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return {
      unread: value,
      items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })),
    };
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id), isNull(notifications.readAt)));
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  }

  /** Register an Expo push token for this device. A token moves to the latest user who registers it. */
  @Post('push-tokens')
  @HttpCode(204)
  async register(@CurrentUser() user: AuthUser, @Body(new ZodPipe(pushTokenSchema)) body: { token: string; platform: 'ios' | 'android' | 'web' }): Promise<void> {
    await this.db
      .insert(pushTokens)
      .values({ userId: user.id, token: body.token, platform: body.platform, lastUsedAt: new Date() })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId: user.id, platform: body.platform, disabledAt: null, lastUsedAt: new Date() } });
  }

  @Delete('push-tokens/:token')
  @HttpCode(204)
  async unregister(@CurrentUser() user: AuthUser, @Param('token') token: string): Promise<void> {
    await this.db.delete(pushTokens).where(and(eq(pushTokens.token, token), eq(pushTokens.userId, user.id)));
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}

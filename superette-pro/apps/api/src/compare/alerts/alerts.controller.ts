import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  alertListQuerySchema,
  createPriceAlertSchema,
  updatePriceAlertSchema,
  type AlertListQuery,
  type AlertNotification,
  type AlertPreview,
  type CreatePriceAlertInput,
  type PriceAlert,
  type SessionUser,
  type UpdatePriceAlertInput,
} from '@superette/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AlertsService } from './alerts.service';

const idPipe = new ZodValidationPipe(z.string().regex(/^[a-z0-9]{10,40}$/i, 'Ongeldig id'));

/** Prijsalerts en meldingen. Alleen de eigenaar ziet en beheert zijn alerts. */
@Controller('compare')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts')
  list(@CurrentUser() user: SessionUser, @Query(new ZodValidationPipe(alertListQuerySchema)) query: AlertListQuery): Promise<PriceAlert[]> {
    return this.alerts.list(user.id, query);
  }

  /** Wat de gebruiker te zien krijgt vóór het opslaan: huidige laagste prijs, verschil, zin. */
  @Post('alerts/preview')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createPriceAlertSchema)) input: CreatePriceAlertInput): Promise<AlertPreview> {
    return this.alerts.preview(user.id, input);
  }

  @Post('alerts')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createPriceAlertSchema)) input: CreatePriceAlertInput): Promise<PriceAlert> {
    return this.alerts.create(user.id, input);
  }

  @Get('alerts/:alertId')
  get(@CurrentUser() user: SessionUser, @Param('alertId', idPipe) alertId: string): Promise<PriceAlert> {
    return this.alerts.get(user.id, alertId);
  }

  @Patch('alerts/:alertId')
  update(
    @CurrentUser() user: SessionUser,
    @Param('alertId', idPipe) alertId: string,
    @Body(new ZodValidationPipe(updatePriceAlertSchema)) input: UpdatePriceAlertInput,
  ): Promise<PriceAlert> {
    return this.alerts.update(user.id, alertId, input);
  }

  @Post('alerts/:alertId/pause')
  pause(@CurrentUser() user: SessionUser, @Param('alertId', idPipe) alertId: string): Promise<PriceAlert> {
    return this.alerts.pause(user.id, alertId);
  }

  @Post('alerts/:alertId/resume')
  resume(@CurrentUser() user: SessionUser, @Param('alertId', idPipe) alertId: string): Promise<PriceAlert> {
    return this.alerts.resume(user.id, alertId);
  }

  @Delete('alerts/:alertId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: SessionUser, @Param('alertId', idPipe) alertId: string): Promise<void> {
    return this.alerts.remove(user.id, alertId);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: SessionUser): Promise<AlertNotification[]> {
    return this.alerts.notifications(user.id);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@CurrentUser() user: SessionUser, @Param('notificationId', idPipe) notificationId: string): Promise<void> {
    return this.alerts.markRead(user.id, notificationId);
  }
}

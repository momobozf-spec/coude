import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { checkoutSchema, type CheckoutInput, type CheckoutResponse, type Receipt, type SessionUser } from '@superette/contracts';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CheckoutService } from './checkout.service';
import { ReceiptService } from '../receipt/receipt.service';

const webhookSchema = z.object({ id: z.string().min(1).max(64) });

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  start(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(checkoutSchema)) input: CheckoutInput,
  ): Promise<CheckoutResponse> {
    return this.checkout.start(user.id, input.basketId, input.method);
  }
}

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  /** De historiek in de app: alle eerdere aankopen met hun BTW-bon. */
  @Get()
  list(@CurrentUser() user: SessionUser): Promise<Receipt[]> {
    return this.receipts.listForUser(user.id);
  }

  @Get(':orderId')
  one(@CurrentUser() user: SessionUser, @Param('orderId') orderId: string): Promise<Receipt> {
    return this.receipts.findForUser(user.id, orderId);
  }
}

/**
 * Het webhook-endpoint van de betaalprovider.
 *
 * Géén `JwtAuthGuard`: Mollie heeft geen sessie. De beveiliging zit erin dat de
 * body niets bewijst — we bellen terug naar Mollie voor de echte status. Zie
 * `CheckoutService.handleWebhook`.
 *
 * Antwoordt altijd `204`, ook bij een onbekende betaling. Een `404` zou
 * bevestigen welke payment-ids bij ons bestaan, en zou Mollie eindeloos laten
 * herhalen.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('mollie')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Mollie herhaalt bij twijfel; ruim bemeten zodat een storm van herhalingen
  // niet op onze eigen rate limiter stukloopt.
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async mollie(@Body(new ZodValidationPipe(webhookSchema)) input: z.infer<typeof webhookSchema>): Promise<void> {
    await this.checkout.handleWebhook(input.id);
  }
}

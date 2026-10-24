import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { basketSchema, scanItemSchema, type Basket, type ScanItemInput, type SessionUser } from '@superette/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BasketService } from './basket.service';

const setQuantitySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});

@Controller('baskets')
@UseGuards(JwtAuthGuard)
export class BasketController {
  constructor(private readonly baskets: BasketService) {}

  /** Het openstaande mandje in deze winkel, of `null` als de klant niet binnen is. */
  @Get('open')
  openBasket(@CurrentUser() user: SessionUser, @Query('storeId') storeId: string): Promise<Basket | null> {
    return this.baskets.findOpenBasket(user.id, storeId);
  }

  @Get(':basketId')
  load(@CurrentUser() user: SessionUser, @Param('basketId') basketId: string): Promise<Basket> {
    return this.baskets.load(user.id, basketId);
  }

  /** Self-scanning: de klant houdt zijn camera op een streepjescode. */
  @Post('scan')
  scan(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(scanItemSchema)) input: ScanItemInput,
  ): Promise<Basket> {
    return this.baskets.scan(user.id, input.basketId, input.barcode, input.quantity);
  }

  @Patch(':basketId/items')
  setQuantity(
    @CurrentUser() user: SessionUser,
    @Param('basketId') basketId: string,
    @Body(new ZodValidationPipe(setQuantitySchema)) input: z.infer<typeof setQuantitySchema>,
  ): Promise<Basket> {
    return this.baskets.setQuantity(user.id, basketId, input.productId, input.quantity);
  }
}

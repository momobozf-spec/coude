import { Module } from '@nestjs/common';
import { BasketModule } from '../basket/basket.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReceiptService } from '../receipt/receipt.service';
import { CheckoutController, ReceiptController, WebhookController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [BasketModule, PaymentsModule],
  controllers: [CheckoutController, ReceiptController, WebhookController],
  providers: [CheckoutService, ReceiptService],
})
export class CheckoutModule {}

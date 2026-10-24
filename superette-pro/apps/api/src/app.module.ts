import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { BasketModule } from './basket/basket.module';
import { CatalogModule } from './catalog/catalog.module';
import { AccountModule } from './account/account.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CompareModule } from './compare/compare.module';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { ConsentModule } from './consent/consent.module';
import { GateModule } from './gate/gate.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Eén `.env` in de monorepo-root, gedeeld door API en PWA. Het tweede pad
      // laat een app-specifieke override toe zonder de root te vervuilen.
      // Paden zijn relatief aan de working directory (apps/api).
      envFilePath: ['../../.env', '.env'],
      // Valideert bij het opstarten. Een ontbrekende ondertekensleutel moet de
      // server laten weigeren te starten, niet pas falen wanneer een klant in
      // de regen voor de deur staat.
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    PaymentsModule,
    ConsentModule,
    AuthModule,
    AccessModule,
    GateModule,
    CatalogModule,
    BasketModule,
    CheckoutModule,
    StoresModule,
    // Supermarktvergelijker: eigen bounded context, deelt alleen auth en database.
    CompareModule,
    // Gezondheid (live/ready/status) en accountbeheer (export, verwijdering).
    HealthModule,
    AccountModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

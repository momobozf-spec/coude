import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { BasketModule } from './basket/basket.module';
import { CatalogModule } from './catalog/catalog.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CompareModule } from './compare/compare.module';
import { isBoutiqueEnabled } from './config/boutique';
import { validateEnv } from './config/env';
import { ConsentModule } from './consent/consent.module';
import { GateModule } from './gate/gate.module';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoresModule } from './stores/stores.module';

/**
 * De onbemande boetiek "Jamal & Jamila": toegang (QR), deur (MQTT), catalogus,
 * mandje, kassa, kasbonnen, betalingen (Mollie) en winkels. Alleen geladen met
 * `BOUTIQUE_ENABLED=true`; anders bestaan deze routes niet (404) en start MQTT
 * niet. De code blijft in de repository.
 */
export const BOUTIQUE_MODULES: readonly Type[] = [PaymentsModule, AccessModule, GateModule, CatalogModule, BasketModule, CheckoutModule, StoresModule];

/** Altijd geladen: gezondheid, accounts, toestemmingen en de vergelijker. */
export const CORE_MODULES: readonly Type[] = [
  PrismaModule,
  ConsentModule,
  AuthModule,
  // Supermarktvergelijker: eigen bounded context, deelt alleen auth en database.
  CompareModule,
  // Gezondheid (live/ready/status) en accountbeheer (export, verwijdering).
  HealthModule,
  AccountModule,
];

@Module({})
export class AppModule {
  /**
   * Bouwt de applicatiemodule. Async omdat `ConfigModule.forRoot` eerst `.env`
   * inleest en valideert; pas daarna is `BOUTIQUE_ENABLED` betrouwbaar bekend.
   */
  static async forRoot(): Promise<DynamicModule> {
    const config = await ConfigModule.forRoot({
      isGlobal: true,
      // Eén `.env` in de monorepo-root, gedeeld door API en PWA. Het tweede pad
      // laat een app-specifieke override toe zonder de root te vervuilen.
      // Paden zijn relatief aan de working directory (apps/api).
      envFilePath: ['../../.env', '.env'],
      // Valideert bij het opstarten. Een ontbrekende of zwakke instelling moet
      // de server laten weigeren te starten, niet pas falen bij de eerste gebruiker.
      validate: validateEnv,
    });

    const boutique = isBoutiqueEnabled();

    return {
      module: AppModule,
      imports: [
        config,
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
        ...CORE_MODULES,
        ...(boutique ? BOUTIQUE_MODULES : []),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}

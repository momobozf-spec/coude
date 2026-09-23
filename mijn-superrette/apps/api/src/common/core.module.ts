import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Redis } from 'ioredis';
import { createDatabase, type DatabaseHandle } from '@superrette/database';
import { ExpoPushSender, LogPushSender, type PushSender } from '@superrette/ingestion';
import { createDefaultRegistry, OpenFoodFactsClient } from '@superrette/store-providers';
import { loadConfig, type AppConfig } from '../config/config.js';
import { AuthGuard, TokenService } from './auth.js';
import { CacheService, MemoryCacheStore, RedisCacheStore } from './cache.service.js';
import {
  CatalogService,
  EntitlementsService,
  NormalizerService,
  ShopperContextService,
  ShutdownService,
} from './core.services.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { JobsService } from './jobs.service.js';
import { ListEventsService } from './list-events.service.js';
import { CACHE, CONFIG, DB, DB_HANDLE, PROVIDERS, PUSH, REDIS } from './tokens.js';

export const OFF_CLIENT = Symbol('OFF_CLIENT');

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: (): AppConfig => loadConfig() },
    {
      provide: DB_HANDLE,
      inject: [CONFIG, ShutdownService],
      useFactory: (config: AppConfig, shutdown: ShutdownService): DatabaseHandle => {
        const handle = createDatabase(config.databaseUrl, { max: 20, applicationName: 'superrette-api' });
        shutdown.register(() => handle.close());
        return handle;
      },
    },
    { provide: DB, inject: [DB_HANDLE], useFactory: (h: DatabaseHandle) => h.db },
    {
      provide: REDIS,
      inject: [CONFIG, ShutdownService],
      useFactory: (config: AppConfig, shutdown: ShutdownService): Redis | null => {
        if (!config.redisUrl) return null;
        const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
        shutdown.register(() => redis.quit());
        return redis;
      },
    },
    {
      provide: CACHE,
      inject: [REDIS],
      useFactory: (redis: Redis | null) =>
        new CacheService(redis ? new RedisCacheStore(redis) : new MemoryCacheStore()),
    },
    {
      provide: PUSH,
      inject: [CONFIG],
      useFactory: (config: AppConfig): PushSender =>
        config.pushMode === 'expo'
          ? new ExpoPushSender({ accessToken: config.expoAccessToken })
          : new LogPushSender((m) => console.info(m)),
    },
    {
      provide: PROVIDERS,
      inject: [CONFIG],
      useFactory: (config: AppConfig) =>
        createDefaultRegistry({
          environment: config.env,
          openPrices: config.openPricesEnabled ? { enabled: true, userAgent: config.userAgent } : null,
          developmentSeed: config.allowDevelopmentData ? {} : null,
        }),
    },
    {
      provide: OFF_CLIENT,
      inject: [CONFIG],
      useFactory: (config: AppConfig) =>
        config.openFoodFactsEnabled ? new OpenFoodFactsClient({ userAgent: config.userAgent }) : null,
    },
    ShutdownService,
    TokenService,
    NormalizerService,
    EntitlementsService,
    ShopperContextService,
    CatalogService,
    JobsService,
    ListEventsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [
    CONFIG,
    DB,
    DB_HANDLE,
    REDIS,
    CACHE,
    PUSH,
    PROVIDERS,
    OFF_CLIENT,
    TokenService,
    NormalizerService,
    EntitlementsService,
    ShopperContextService,
    CatalogService,
    JobsService,
    ListEventsService,
  ],
})
export class CoreModule {}

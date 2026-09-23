import 'reflect-metadata';
import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/config.js';
import { CONFIG } from './common/tokens.js';

/** Socket.IO adapter that fans out over Redis when several API instances run. */
class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private clients: Redis[] = [];

  async connect(url: string): Promise<void> {
    const pub = new Redis(url);
    const sub = pub.duplicate();
    this.clients = [pub, sub];
    this.adapterConstructor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(this.clients.map((c) => c.quit().catch(() => undefined)));
  }
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    logger: process.env.APP_ENV === 'test' ? ['error', 'warn'] : undefined,
  });
  const config = app.get<AppConfig>(CONFIG);
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.enableShutdownHooks();
  const expressApp = app.getHttpAdapter().getInstance() as {
    set(k: string, v: unknown): void;
    disable(k: string): void;
  };
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  if (config.redisUrl) {
    const adapter = new RedisIoAdapter(app);
    await adapter.connect(config.redisUrl);
    app.useWebSocketAdapter(adapter);
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }
  if (config.allowDevelopmentData) {
    Logger.warn('DEVELOPMENT DATA is visible in this environment (never in production).', 'Bootstrap');
  }
  return app;
}

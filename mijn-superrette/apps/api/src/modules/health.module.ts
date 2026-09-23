import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Database } from '@superrette/database';
import { countDevelopmentRows } from '@superrette/ingestion';
import type { AppConfig } from '../config/config.js';
import { Public } from '../common/auth.js';
import { CONFIG, DB, REDIS } from '../common/tokens.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis | null,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  async health(): Promise<Record<string, unknown>> {
    const checks: Record<string, string> = {};
    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
    }
    if (this.redis) checks.redis = (await this.redis.ping().catch(() => 'down')) === 'PONG' ? 'ok' : 'down';
    // Production must never contain sample data.
    if (this.config.isProduction && checks.database === 'ok') {
      checks.developmentData = (await countDevelopmentRows(this.db)) === 0 ? 'none' : 'PRESENT';
    }
    const healthy = Object.values(checks).every((v) => v === 'ok' || v === 'none');
    const body = {
      status: healthy ? 'ok' : 'degraded',
      env: this.config.env,
      sampleDataVisible: this.config.allowDevelopmentData,
      checks,
    };
    if (!healthy) throw new ServiceUnavailableException(body);
    return body;
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { requestIdOf } from '../../common/request-id.middleware';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { feedFileSchema, type FeedFile } from '../adapters/feed-schema';
import { JobKeyGuard } from '../jobs/job-key.guard';
import { FeedPushService, type FeedPushResult, type StoredFeedInfo } from './feed-push.service';

const chainParamSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Ongeldige adaptersleutel');

/**
 * Intern: feeds aanleveren vanaf de laptop (`npm run feeds:push`).
 *
 * - `JobKeyGuard`: `x-job-key` (ook `COMPARE_JOB_KEY_PREVIOUS` tijdens een
 *   rotatie), constante tijd, browserverzoeken geweigerd, 404 zonder sleutel.
 * - Grote body alleen ná een geldige sleutel (`createFeedPushBodyParser` in
 *   `main.ts`); zonder geldige sleutel geldt de gewone grens van 64 kB.
 * - Validatie met `feedFileSchema` — hetzelfde schema als de importbestanden.
 */
@Controller('compare/internal/feeds')
@UseGuards(JobKeyGuard)
export class FeedPushController {
  constructor(private readonly feeds: FeedPushService) {}

  @Post(':chain')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  push(
    @Param('chain', new ZodValidationPipe(chainParamSchema)) chain: string,
    @Body(new ZodValidationPipe(feedFileSchema)) feed: FeedFile,
    @Req() request: Request,
  ): Promise<FeedPushResult> {
    return this.feeds.receive(chain, feed, requestIdOf(request));
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  list(): Promise<StoredFeedInfo[]> {
    return this.feeds.list();
  }
}

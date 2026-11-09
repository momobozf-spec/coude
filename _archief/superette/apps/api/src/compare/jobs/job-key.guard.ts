import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { requestIdOf } from '../../common/request-id.middleware';
import { CompareConfig } from '../compare-config';

const JOB_KEY_HEADER = 'x-job-key';

/**
 * Beschermt interne endpoints (synchronisatie, status) met een gedeelde sleutel.
 *
 * - Geen sleutel geconfigureerd → het endpoint bestaat niet (404).
 * - Vergelijking in constante tijd over SHA-256-digests.
 * - Rotatie: `COMPARE_JOB_KEY_PREVIOUS` blijft geldig tot de wissel klaar is.
 * - Uitsluitend server-side: een browser stuurt bij elke cross-site request
 *   `Origin` en `Sec-Fetch-Site` mee, een cron of server nooit. Dat is een
 *   extra signaal bovenop de sleutel, geen vervanging; de sleutel wordt ook
 *   niet door CORS toegelaten als header.
 * - Elke weigering wordt gelogd met request-id en reden — nooit met de sleutel.
 */
@Injectable()
export class JobKeyGuard implements CanActivate {
  private readonly logger = new Logger(JobKeyGuard.name);

  constructor(private readonly config: CompareConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const keys = this.config.jobKeys;
    if (keys.length === 0) throw new NotFoundException();

    const request = context.switchToHttp().getRequest<Request>();
    const requestId = requestIdOf(request);

    if (request.header('origin') || request.header('sec-fetch-site')) {
      this.logger.warn(`intern endpoint geweigerd: browser-signaal requestId=${requestId} path=${request.path}`);
      throw new ForbiddenException({ message: 'Dit endpoint is alleen server-side bereikbaar', code: 'INTERNAL_ONLY' });
    }

    const presented = request.header(JOB_KEY_HEADER);
    if (typeof presented !== 'string' || presented.length === 0) {
      this.logger.warn(`intern endpoint geweigerd: sleutel ontbreekt requestId=${requestId} path=${request.path}`);
      throw new UnauthorizedException({ message: 'Ongeldige jobsleutel', code: 'JOB_KEY_INVALID' });
    }

    const presentedDigest = createHash('sha256').update(presented, 'utf8').digest();
    const valid = keys.some((key) => timingSafeEqual(presentedDigest, createHash('sha256').update(key, 'utf8').digest()));
    if (!valid) {
      this.logger.warn(`intern endpoint geweigerd: sleutel onjuist requestId=${requestId} path=${request.path}`);
      throw new UnauthorizedException({ message: 'Ongeldige jobsleutel', code: 'JOB_KEY_INVALID' });
    }

    return true;
  }
}

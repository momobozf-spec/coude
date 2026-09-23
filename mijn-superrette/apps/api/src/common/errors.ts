import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntitlementKey } from '@superrette/domain';

export const notFound = (what: string): NotFoundException =>
  new NotFoundException({ code: 'NOT_FOUND', message: `${what} not found` });

export const entitlementRequired = (entitlement: EntitlementKey): ForbiddenException =>
  new ForbiddenException({
    code: 'ENTITLEMENT_REQUIRED',
    message: `This feature requires the "${entitlement}" entitlement`,
    details: { entitlement },
  });

export const limitReached = (entitlement: EntitlementKey, limit: number): ForbiddenException =>
  new ForbiddenException({
    code: 'LIMIT_REACHED',
    message: `Limit of ${limit} reached for "${entitlement}"`,
    details: { entitlement, limit },
  });

export const versionConflict = (current: unknown): ConflictException =>
  new ConflictException({
    code: 'VERSION_CONFLICT',
    message: 'The item was changed by someone else',
    details: { current },
  });

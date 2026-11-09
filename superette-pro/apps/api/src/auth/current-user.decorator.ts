import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@superette/contracts';
import type { Request } from 'express';

/** Haalt de door `JwtStrategy.validate` gevalideerde gebruiker uit de request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user: SessionUser }>();
  return request.user;
});

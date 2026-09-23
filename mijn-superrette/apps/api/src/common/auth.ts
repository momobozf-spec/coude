import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { UserRole } from '@superrette/domain';
import type { AppConfig } from '../config/config.js';
import { CacheService } from './cache.service.js';
import { CACHE, CONFIG } from './tokens.js';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const IS_PUBLIC = 'superrette:public';
const ROLES = 'superrette:roles';
const RATE_LIMIT = 'superrette:rate-limit';

/** Endpoint does not require authentication. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES, roles);
/** Limit requests per client IP: `limit` per `windowSeconds`. */
export const RateLimit = (limit: number, windowSeconds: number): MethodDecorator =>
  SetMetadata(RATE_LIMIT, { limit, windowSeconds });

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new UnauthorizedException();
  return req.user;
});

/** Optional user (for public endpoints that personalise when logged in). */
export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user ?? null;
});

@Injectable()
export class TokenService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async signAccessToken(user: AuthUser): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('mijn-superrette')
      .setAudience('mijn-superrette-app')
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTokenTtlSeconds}s`)
      .sign(this.config.jwtSecret);
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.config.jwtSecret, {
      issuer: 'mijn-superrette',
      audience: 'mijn-superrette-app',
      algorithms: ['HS256'],
    });
    if (!payload.sub) throw new UnauthorizedException();
    return { id: payload.sub, role: payload.role === 'ADMIN' ? 'ADMIN' : 'USER' };
  }
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Global guard: authentication (unless @Public), roles and rate limits. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(CACHE) private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket gateways authenticate the connection handshake themselves.
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const targets = [context.getHandler(), context.getClass()];

    const rate = this.reflector.getAllAndOverride<{ limit: number; windowSeconds: number } | undefined>(
      RATE_LIMIT,
      targets,
    );
    if (rate) {
      const key = `superrette:rl:${context.getClass().name}.${context.getHandler().name}:${req.ip ?? 'unknown'}`;
      if ((await this.cache.hit(key, rate.windowSeconds)) > rate.limit) {
        throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many requests' }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const token = bearerToken(req.headers.authorization);
    if (token) {
      try {
        req.user = await this.tokens.verifyAccessToken(token);
      } catch {
        throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Invalid or expired access token' });
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets);
    if (!isPublic && !req.user)
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required' });

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && (!req.user || !roles.includes(req.user.role))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient role' });
    }
    return true;
  }
}

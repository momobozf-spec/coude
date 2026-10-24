import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AUTH_CLIENT_HEADER, type SessionUser } from '@superette/contracts';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { readCookie } from '../common/cookies';
import { ACCESS_COOKIE } from './auth-cookies';
import { AuthService, type JwtPayload } from './auth.service';

/**
 * Waar het access-token vandaan komt:
 *
 *  - `Authorization: Bearer …` — boetiek-app, rooktests, apparaten;
 *  - de HttpOnly-cookie `sup_access` — alleen als de request zich met de header
 *    `x-superette-client: web` als Superette-app meldt. Zonder die header wordt
 *    de cookie genegeerd, zodat een toevallig meegestuurde cookie nooit
 *    stilzwijgend een andere client authenticeert.
 */
function fromWebCookie(request: Request): string | null {
  if (request.header(AUTH_CLIENT_HEADER) !== 'web') return null;
  return readCookie(request, ACCESS_COOKIE);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), fromWebCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** De teruggegeven waarde landt op `request.user`. */
  validate(payload: JwtPayload): Promise<SessionUser> {
    return this.auth.validateJwtUser(payload);
  }
}

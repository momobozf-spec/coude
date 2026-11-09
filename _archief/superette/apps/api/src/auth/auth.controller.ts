import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH_CLIENT_HEADER,
  loginSchema,
  registerSchema,
  registerSuperetteSchema,
  type AuthResponse,
  type SessionUser,
  type WebSessionResponse,
} from '@superette/contracts';
import type { Request, Response } from 'express';
import { readCookie } from '../common/cookies';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ACCESS_COOKIE, clearAuthCookies, REFRESH_COOKIE, setAuthCookies, type CookieSettings } from './auth-cookies';
import { AuthService, type WebSessionTokens } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const AUTH_LIMIT = { default: { limit: 5, ttl: 60_000 } };

/**
 * Twee soorten clients, één controller.
 *
 *  - Zonder `x-superette-client`: Bearer-tokens in de JSON (boetiek-app,
 *    scanners, rooktests). Gedrag ongewijzigd.
 *  - Met `x-superette-client: web`: tokens in HttpOnly-cookies, nooit in de
 *    JSON. Vernieuwen via `/auth/refresh`, beëindigen via `/auth/logout`.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private get cookieSettings(): CookieSettings {
    return {
      secure: this.config.get<boolean>('COOKIE_SECURE') ?? this.config.get<string>('NODE_ENV') === 'production',
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
    };
  }

  private isWebClient(request: Request): boolean {
    return request.header(AUTH_CLIENT_HEADER) === 'web';
  }

  private issue(response: Response, tokens: WebSessionTokens): WebSessionResponse {
    setAuthCookies(response, this.cookieSettings, {
      accessToken: tokens.accessToken,
      accessMaxAgeSeconds: tokens.accessTtlSeconds,
      refreshToken: tokens.refreshToken,
      refreshMaxAgeSeconds: tokens.refreshTtlSeconds,
    });
    return tokens.response;
  }

  @Post('register')
  @Throttle(AUTH_LIMIT)
  register(
    @Body(new ZodValidationPipe(registerSchema)) input: ReturnType<typeof registerSchema.parse>,
    @Ip() ip: string,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.auth.register(input, { ipAddress: ip, userAgent: request.get('user-agent') });
  }

  /** Registratie vanuit de supermarktvergelijker: geen winkeltoestemmingen, altijd een cookie-sessie. */
  @Post('register-superette')
  @Throttle(AUTH_LIMIT)
  async registerSuperette(
    @Body(new ZodValidationPipe(registerSuperetteSchema)) input: ReturnType<typeof registerSuperetteSchema.parse>,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebSessionResponse | AuthResponse> {
    const user = await this.auth.registerForSuperette(input, { ipAddress: ip, userAgent: request.get('user-agent') });

    if (this.isWebClient(request)) {
      return this.issue(response, await this.auth.openWebSession(user, { client: 'web', userAgent: request.get('user-agent') }));
    }
    // Zonder clientheader (rooktests): Bearer, zoals de boetiek.
    return this.auth.login({ email: input.email, password: input.password });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Vijf pogingen per minuut per IP. Traag genoeg om brute-force onbruikbaar te
  // maken, ruim genoeg voor iemand die zich vertypt.
  @Throttle(AUTH_LIMIT)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: ReturnType<typeof loginSchema.parse>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebSessionResponse | AuthResponse> {
    if (this.isWebClient(request)) {
      const user = await this.auth.authenticate(input);
      return this.issue(response, await this.auth.openWebSession(user, { client: 'web', userAgent: request.get('user-agent') }));
    }
    return this.auth.login(input);
  }

  /** Vernieuwt de cookie-sessie. Alleen voor de Superette-app; roteert het refresh-token. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<WebSessionResponse> {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    if (!this.isWebClient(request) || !refreshToken) {
      clearAuthCookies(response, this.cookieSettings);
      throw new UnauthorizedException({ message: 'Geen sessie om te vernieuwen.', code: 'SESSION_EXPIRED' });
    }

    try {
      return this.issue(response, await this.auth.refreshWebSession(refreshToken, 'web'));
    } catch (error) {
      clearAuthCookies(response, this.cookieSettings);
      throw error;
    }
  }

  /** Beëindigt de sessie aan beide kanten. Werkt ook met een al verlopen access-token. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    // Geen guard: ook met een al verlopen access-token moet uitloggen lukken.
    const accessToken = this.isWebClient(request) ? readCookie(request, ACCESS_COOKIE) : null;
    const sessionId = accessToken ? await this.auth.sessionIdFromToken(accessToken) : null;
    await this.auth.logout(sessionId, refreshToken);
    clearAuthCookies(response, this.cookieSettings);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    const { sessionId: _omit, ...publicUser } = user as SessionUser & { sessionId?: string | null };
    return publicUser;
  }
}

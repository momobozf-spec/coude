import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthClient, AuthResponse, LoginInput, RegisterInput, RegisterSuperetteInput, SessionUser, WebSessionResponse } from '@superette/contracts';
import { Prisma } from '@prisma/client';
import { ConsentService, type ConsentContext } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity-provider';
import { LocalIdentityProvider } from './local-identity.provider';
import { SessionsService } from './sessions.service';

/**
 * Wat er in het access-token zit. Bewust minimaal: geen e-mailadres, geen naam.
 *
 * `sid` en `client` staan er alleen in bij cookie-sessies; zo'n token is pas
 * geldig als de sessie in de database nog actief is. Een Bearer-token zonder
 * `sid` (boetiek-app) werkt zoals voorheen tot het verloopt.
 */
export interface JwtPayload {
  sub: string;
  sid?: string;
  client?: AuthClient;
  /** Uniek per uitgifte: twee tokens voor dezelfde sessie in dezelfde seconde zijn nooit identiek. */
  jti?: string;
}

/** Wat de controller nodig heeft om cookies te zetten. Verlaat de API nooit als JSON. */
export interface WebSessionTokens {
  readonly response: WebSessionResponse;
  readonly accessToken: string;
  readonly accessTtlSeconds: number;
  readonly refreshToken: string;
  readonly refreshTtlSeconds: number;
}

export interface SessionOptions {
  readonly client: AuthClient;
  readonly userAgent?: string | undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly consents: ConsentService,
    private readonly sessions: SessionsService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  /**
   * Registreert een klant en legt in dezelfde transactie zijn toestemmingen vast.
   *
   * Atomair, want een account zonder vastgelegde AVG-toestemming is een account
   * waarmee we niets mogen: hij komt de winkel niet in, en we mogen zijn bezoek
   * niet loggen. Dan liever geen account.
   */
  async register(input: RegisterInput, context: ConsentContext = {}): Promise<AuthResponse> {
    const passwordHash = await LocalIdentityProvider.hashPassword(input.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            password: passwordHash,
            fullName: input.fullName,
            phone: input.phone ?? null,
            locale: input.locale,
            identityProvider: 'LOCAL',
            // Met enkel e-mail + wachtwoord: geen sterke identiteit, geen
            // leeftijdscontrole. Zie identity-provider.ts.
            identityVerified: false,
            ageVerified: false,
          },
        });

        // De twee verplichte toestemmingen zijn `z.literal(true)` in het schema,
        // dus als we hier zijn, heeft de klant beide gegeven.
        await this.consents.record(created.id, 'ACCESS_LOG', true, context, tx);
        await this.consents.record(created.id, 'CAMERA', true, context, tx);
        await this.consents.record(created.id, 'MARKETING', input.acceptsMarketing, context, tx);

        return created;
      });

      return this.issueBearerSession(user);
    } catch (error) {
      // P2002 = unique constraint. Het enige unieke veld hier is `email`.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Er bestaat al een account met dit e-mailadres');
      }
      throw error;
    }
  }

  /**
   * Registreert een gebruiker van de supermarktvergelijker.
   *
   * Zelfde account, zelfde sessie, maar zonder toegangslog- en
   * cameratoestemming: die horen bij de winkel, niet bij prijzen vergelijken.
   * Alleen de (optionele) marketingkeuze wordt als toestemming vastgelegd.
   * Zo'n gebruiker komt de boetiek niet in tot hij die toestemmingen daar geeft.
   */
  async registerForSuperette(input: RegisterSuperetteInput, context: ConsentContext = {}): Promise<{ id: string; email: string }> {
    const passwordHash = await LocalIdentityProvider.hashPassword(input.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            password: passwordHash,
            fullName: input.fullName,
            locale: input.locale,
            identityProvider: 'LOCAL',
            identityVerified: false,
            ageVerified: false,
          },
        });

        await this.consents.record(created.id, 'MARKETING', input.acceptsMarketing, context, tx);

        return { id: created.id, email: created.email };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Er bestaat al een account met dit e-mailadres');
      }
      throw error;
    }
  }

  /** Controleert e-mail en wachtwoord. Eén boodschap voor elke mislukking. */
  async authenticate(input: LoginInput): Promise<{ id: string; email: string }> {
    const identity = await this.identity.authenticate(input);

    if (!identity) {
      // Eén boodschap voor "onbekend adres" én "fout wachtwoord". Alles anders
      // is een gratis check of iemand klant bij ons is.
      throw new UnauthorizedException('E-mailadres of wachtwoord is onjuist');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { email: identity.email }, select: { id: true, email: true } });
    return user;
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    return this.issueBearerSession(await this.authenticate(input));
  }

  /** Herauthenticatie voor gevoelige acties (accountverwijdering): klopt dit wachtwoord voor deze gebruiker? */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return false;
    const identity = await this.identity.authenticate({ email: user.email, password });
    return identity !== null;
  }

  // ── Cookie-sessies (Superette-app) ──────────────────────────────────────

  /** Opent een server-side sessie en maakt het eerste access-token. */
  async openWebSession(user: { id: string }, options: SessionOptions): Promise<WebSessionTokens> {
    const issued = await this.sessions.create(user.id, options.client, options.userAgent);
    return this.webTokens(user.id, issued.session.id, issued.session.expiresAt, issued.refreshToken, options.client);
  }

  /** Vernieuwt access- en refresh-token. Hergebruik van een oud refresh-token trekt de sessie in. */
  async refreshWebSession(refreshToken: string, client: AuthClient): Promise<WebSessionTokens> {
    const result = await this.sessions.rotate(refreshToken);

    if (result.kind === 'reused') {
      throw new UnauthorizedException({ message: 'Deze sessie is om veiligheidsredenen beëindigd. Log opnieuw in.', code: 'SESSION_REUSE' });
    }
    if (result.kind === 'invalid') {
      throw new UnauthorizedException({ message: 'Je sessie is verlopen. Log opnieuw in.', code: 'SESSION_EXPIRED' });
    }

    const { session, refreshToken: nextToken } = result.issued;
    const user = await this.prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, status: true, deletedAt: true } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      await this.sessions.revoke(session.id, 'USER_INACTIVE');
      throw new UnauthorizedException({ message: 'Je sessie is niet langer geldig.', code: 'SESSION_EXPIRED' });
    }

    return this.webTokens(user.id, session.id, session.expiresAt, nextToken, client);
  }

  /** Het sessie-id uit een (eventueel verlopen) access-token, of `null` als het token niet van ons is. */
  async sessionIdFromToken(accessToken: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(accessToken, { ignoreExpiration: true });
      return payload.sid ?? null;
    } catch {
      return null;
    }
  }

  /** Beëindigt de sessie achter een access-token (sid) en/of een refresh-token. Altijd succesvol. */
  async logout(sessionId: string | null, refreshToken: string | null): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId, 'LOGOUT');
    if (refreshToken) await this.sessions.revokeByRefreshToken(refreshToken, 'LOGOUT');
  }

  /** Laadt de gebruiker achter een geldig JWT. Gebruikt door `JwtStrategy`. */
  async validateJwtUser(payload: JwtPayload): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    // Een token dat gisteren geldig was, mag vandaag niet meer werken voor een
    // geblokkeerde klant. Daarom elke request opnieuw de status controleren.
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Sessie is niet langer geldig');
    }

    // Cookie-sessies zijn intrekbaar: uitgelogd of verlopen betekent weg, ook
    // als het access-token zelf nog niet verlopen is.
    if (payload.sid && !(await this.sessions.isActive(payload.sid))) {
      throw new UnauthorizedException({ message: 'Je sessie is beëindigd. Log opnieuw in.', code: 'SESSION_EXPIRED' });
    }

    return toSessionUser(user, payload.sid ?? null);
  }

  // ── Intern ───────────────────────────────────────────────────────────────

  private async issueBearerSession(user: { id: string; email: string }): Promise<AuthResponse> {
    const ttlSeconds = this.config.getOrThrow<number>('JWT_TTL_SECONDS');
    const payload: JwtPayload = { sub: user.id };

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: ttlSeconds });
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    return {
      accessToken,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      user: toSessionUser(full, null),
    };
  }

  private async webTokens(userId: string, sessionId: string, sessionExpiresAt: Date, refreshToken: string, client: AuthClient): Promise<WebSessionTokens> {
    const accessTtlSeconds = this.config.get<number>('WEB_ACCESS_TTL_SECONDS') ?? 900;
    const payload: JwtPayload = { sub: userId, sid: sessionId, client, jti: randomUUID() };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtlSeconds });
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      response: {
        user: toSessionUser(full, sessionId),
        expiresAt: new Date(Date.now() + accessTtlSeconds * 1000).toISOString(),
        sessionExpiresAt: sessionExpiresAt.toISOString(),
      },
      accessToken,
      accessTtlSeconds,
      refreshToken,
      refreshTtlSeconds: Math.max(0, Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000)),
    };
  }
}

/** Projecteert een database-gebruiker op wat de client mag zien. */
function toSessionUser(
  user: {
    id: string;
    email: string;
    fullName: string;
    locale: string;
    role: string;
    identityVerified: boolean;
    ageVerified: boolean;
  },
  sessionId: string | null,
): SessionUser & { sessionId: string | null } {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    locale: user.locale === 'fr' ? 'fr' : 'nl',
    role: user.role as SessionUser['role'],
    identityVerified: user.identityVerified,
    ageVerified: user.ageVerified,
    sessionId,
  };
}

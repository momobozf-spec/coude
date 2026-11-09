import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface IssuedSession {
  readonly session: Session;
  /** Het platte refresh-token. Gaat één keer naar de client, in een HttpOnly-cookie, en wordt nooit bewaard. */
  readonly refreshToken: string;
}

export type RotateResult = { readonly kind: 'ok'; readonly issued: IssuedSession } | { readonly kind: 'reused' } | { readonly kind: 'invalid' };

/**
 * Server-side sessies voor cookie-authenticatie.
 *
 * - Het refresh-token is 32 bytes uit de CSPRNG; alleen de SHA-256 staat in de database.
 * - Elke vernieuwing roteert het token. Het vorige token blijft als hash bekend:
 *   wie het nog eens aanbiedt, heeft het gestolen of gelekt — dan trekken we de
 *   hele sessie in.
 * - Intrekken is een tijdstip, geen DELETE: de rij is een audit-spoor tot de
 *   opruimtaak hem na afloop wist.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get refreshTtlMs(): number {
    return (this.config.get<number>('WEB_REFRESH_TTL_DAYS') ?? 30) * 86_400_000;
  }

  static hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private static newToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private static trimUserAgent(userAgent: string | undefined): string | null {
    return userAgent ? userAgent.slice(0, 160) : null;
  }

  async create(userId: string, client: string, userAgent?: string): Promise<IssuedSession> {
    const refreshToken = SessionsService.newToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        client,
        refreshTokenHash: SessionsService.hash(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: SessionsService.trimUserAgent(userAgent),
      },
    });
    return { session, refreshToken };
  }

  /** Roteert het refresh-token. Een hergebruikt (oud) token trekt de sessie in. */
  async rotate(refreshToken: string, now: Date = new Date()): Promise<RotateResult> {
    const hash = SessionsService.hash(refreshToken);

    const current = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
    if (current) {
      if (current.revokedAt || current.expiresAt.getTime() <= now.getTime()) return { kind: 'invalid' };

      const nextToken = SessionsService.newToken();
      const session = await this.prisma.session.update({
        where: { id: current.id },
        data: { refreshTokenHash: SessionsService.hash(nextToken), previousTokenHash: hash, lastUsedAt: now },
      });
      return { kind: 'ok', issued: { session, refreshToken: nextToken } };
    }

    const reused = await this.prisma.session.findUnique({ where: { previousTokenHash: hash } });
    if (reused && !reused.revokedAt) {
      await this.revoke(reused.id, 'REFRESH_TOKEN_REUSE');
      this.logger.warn(`Hergebruik van een geroteerd refresh-token; sessie ${reused.id} ingetrokken`);
      return { kind: 'reused' };
    }

    return { kind: 'invalid' };
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  async revokeByRefreshToken(refreshToken: string, reason: string): Promise<void> {
    const hash = SessionsService.hash(refreshToken);
    await this.prisma.session.updateMany({
      where: { OR: [{ refreshTokenHash: hash }, { previousTokenHash: hash }], revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
    return result.count;
  }

  /** Is deze sessie nog geldig? Wordt bij élke request met een cookie-token gecontroleerd. */
  async isActive(sessionId: string, now: Date = new Date()): Promise<boolean> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { revokedAt: true, expiresAt: true } });
    return !!session && session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
  }

  async listForUser(userId: string, currentSessionId: string | null) {
    const sessions = await this.prisma.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } });
    return sessions.map((session) => ({
      client: session.client,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      userAgent: session.userAgent,
      current: session.id === currentSessionId,
    }));
  }

  /** Opruimtaak: verlopen of ingetrokken sessies ouder dan 30 dagen definitief wissen. */
  async purge(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 30 * 86_400_000);
    const result = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    return result.count;
  }
}

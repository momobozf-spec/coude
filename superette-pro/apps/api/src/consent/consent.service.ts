import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUIRED_CONSENTS, type ConsentState, type ConsentType } from '@superette/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Herkomst van de toestemming, voor de bewijslast onder AVG art. 7.1. */
export interface ConsentContext {
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

/**
 * Toestemmingsbeheer.
 *
 * De `Consent`-tabel is append-only. Intrekken is een nieuwe rij met
 * `granted: false`, geen UPDATE en zeker geen DELETE. Reden: bij een klacht bij
 * de Gegevensbeschermingsautoriteit moet je kunnen aantonen wát gold op wélk
 * moment. Een overschreven rij bewijst niets.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get policyVersion(): string {
    return this.config.getOrThrow<string>('PRIVACY_POLICY_VERSION');
  }

  /**
   * Legt een toestemmingsbeslissing vast. Altijd een nieuwe rij.
   *
   * Accepteert een transactie-client zodat registratie (gebruiker + zijn eerste
   * toestemmingen) atomair is: nooit een account zonder vastgelegde toestemming.
   */
  async record(
    userId: string,
    type: ConsentType,
    granted: boolean,
    context: ConsentContext = {},
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.consent.create({
      data: {
        userId,
        type,
        granted,
        policyVersion: this.policyVersion,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }

  /**
   * De actuele stand per toestemmingstype: de meest recente rij per type.
   *
   * `distinct` in combinatie met `orderBy recordedAt desc` laat Postgres dit in
   * één query doen (DISTINCT ON), zonder alle historische rijen op te halen.
   */
  async currentState(userId: string): Promise<ConsentState[]> {
    const rows = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      distinct: ['type'],
      select: { type: true, granted: true, recordedAt: true, policyVersion: true },
    });

    return rows.map((row) => ({
      type: row.type,
      granted: row.granted,
      since: row.recordedAt.toISOString(),
      policyVersion: row.policyVersion,
    }));
  }

  /**
   * Heeft deze gebruiker alle toestemmingen die de winkel wettelijk nodig heeft?
   *
   * Wordt bij élke deuropening gecontroleerd, niet alleen bij registratie. Wie
   * zijn toestemming intrekt terwijl hij buiten staat, komt er niet meer in — en
   * dat is precies de bedoeling: zonder toegangslog en camerabeelden mogen we de
   * winkel niet onbemand exploiteren.
   */
  async hasRequiredConsents(userId: string): Promise<boolean> {
    const state = await this.currentState(userId);
    const grantedTypes = new Set(state.filter((c) => c.granted).map((c) => c.type));

    return REQUIRED_CONSENTS.every((required) => grantedTypes.has(required));
  }
}

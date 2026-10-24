/**
 * Accountbeheer: gegevensexport en verwijdering.
 *
 * ## Verwijderbeleid
 *
 * Gewist: lijsten en regels, voorkeuren, prijsalerts, meldingen, sessies,
 * QR-toegangstokens. Geanonimiseerd: het profiel zelf (e-mail, naam,
 * telefoon, wachtwoord weg; status ERASED). Losgekoppeld: matchmeldingen.
 *
 * Bewaard, met reden:
 *  - bestellingen, kasbonnen en factuurnummers: fiscale bewaarplicht (7 jaar,
 *    KB nr. 1 en BTW-wetboek) — gekoppeld aan het geanonimiseerde account;
 *  - toestemmingen en toegangslogs van de boetiek: bewijslast onder AVG art.
 *    7.1 en de camerawet, append-only, zonder naam of e-mail (het id is
 *    pseudoniem zodra het profiel geanonimiseerd is).
 *
 * De gebruiker ziet dit beleid vóór hij bevestigt (zie de privacypagina en
 * de verwijderdialoog in de app).
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AccountExport } from '@superette/contracts';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../auth/sessions.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  /** Alles wat aan het account hangt, als één JSON. Alleen eigen gegevens. */
  async export(userId: string, currentSessionId: string | null): Promise<AccountExport> {
    const [user, consents, preferences, chainPrefs, lists, alerts, notifications, receipts, sessions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.consent.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } }),
      this.prisma.comparePreference.findUnique({ where: { userId } }),
      this.prisma.userChainPreference.findMany({ where: { userId }, include: { storeChain: { select: { slug: true } } } }),
      this.prisma.shoppingList.findMany({ where: { userId }, include: { items: { include: { catalogProduct: { select: { name: true, brand: true } } } } } }),
      this.prisma.priceAlert.findMany({ where: { userId }, include: { stores: { include: { storeChain: { select: { slug: true } } } }, catalogProduct: { select: { name: true, brand: true } } } }),
      this.prisma.alertNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.receipt.findMany({ where: { order: { userId } }, select: { snapshot: true, issuedAt: true } }),
      this.sessions.listForUser(userId, currentSessionId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
      },
      consents: consents.map((c) => ({ type: c.type, granted: c.granted, policyVersion: c.policyVersion, recordedAt: c.recordedAt.toISOString() })),
      preferences: preferences
        ? { ...preferences, chains: chainPrefs.map((p) => ({ chain: p.storeChain.slug, enabled: p.enabled, favorite: p.isFavorite, loyaltyCard: p.hasLoyaltyCard })) }
        : null,
      shoppingLists: lists.map((list) => ({
        name: list.name,
        archived: list.archived,
        createdAt: list.createdAt.toISOString(),
        items: list.items.map((item) => ({
          product: item.catalogProduct ? `${item.catalogProduct.brand ?? ''} ${item.catalogProduct.name}`.trim() : null,
          freeText: item.freeText,
          quantity: item.quantity,
          checked: item.checked,
        })),
      })),
      priceAlerts: alerts.map((alert) => ({
        product: alert.catalogProduct ? `${alert.catalogProduct.brand ?? ''} ${alert.catalogProduct.name}`.trim() : null,
        comparisonType: alert.comparisonType,
        targetPriceCents: alert.targetPriceCents,
        minimumDiscountPercentage: alert.minimumDiscountPercentage,
        chains: alert.stores.map((s) => s.storeChain.slug),
        status: alert.status,
        createdAt: alert.createdAt.toISOString(),
      })),
      notifications: notifications.map((n) => ({ createdAt: n.createdAt.toISOString(), status: n.status, channel: n.channel, payload: n.payload })),
      receipts: receipts.map((r) => ({ issuedAt: r.issuedAt.toISOString(), receipt: r.snapshot })),
      sessions,
    };
  }

  /**
   * Verwijdert het account na herauthenticatie. Eén transactie: óf alles, óf niets.
   * Daarna zijn alle sessies ingetrokken; de aanroeper wist de cookies.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    if (!(await this.auth.verifyPassword(userId, password))) {
      throw new UnauthorizedException({ message: 'Wachtwoord is onjuist', code: 'REAUTH_FAILED' });
    }

    const now = new Date();

    // Eén transactie: óf alles weg, óf niets. Ruimer dan de standaard 5 s,
    // want een account met jaren aan meldingen en lijsten is geen uitzondering.
    await this.prisma.$transaction(async (tx) => {
      await tx.shoppingList.deleteMany({ where: { userId } });
      await tx.alertNotification.deleteMany({ where: { userId } });
      await tx.priceAlert.deleteMany({ where: { userId } });
      await tx.userFavoriteLocation.deleteMany({ where: { userId } });
      await tx.userChainPreference.deleteMany({ where: { userId } });
      await tx.comparePreference.deleteMany({ where: { userId } });
      await tx.productMatchReport.updateMany({ where: { userId }, data: { userId: null } });
      await tx.accessToken.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: `verwijderd+${userId}@anoniem.superette.invalid`,
          fullName: 'Verwijderde gebruiker',
          phone: null,
          password: null,
          externalSubject: null,
          status: 'ERASED',
          deletedAt: now,
        },
      });
    }, { timeout: 30_000, maxWait: 10_000 });

    this.logger.log(`account verwijderd userId=${userId}`);
  }
}

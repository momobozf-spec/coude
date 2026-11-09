/**
 * Prijsalerts: aanmaken, beheren, controleren en meldingen klaarzetten.
 *
 * De beslissing "gaat deze alert af?" staat in `alert-evaluator.ts` en is
 * zuiver. Deze service laadt de kandidaten, past voorkeuren toe en schrijft
 * de uitkomst weg — idempotent, met een `idempotencyKey` per
 * (alert, aanbieding, prijs) zodat een retry nooit een tweede melding geeft.
 */
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AlertListQuery,
  AlertNotification,
  AlertPreview,
  CatalogProductSummary,
  CreatePriceAlertInput,
  MatchType,
  PriceAlert,
  ProductOffer,
  StoreChainRef,
  UpdatePriceAlertInput,
} from '@superette/contracts';
import { formatCents, perUnitLabel } from '@superette/pricing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompareCatalogService, productLabel } from '../catalog/compare-catalog.service';
import { CompareConfig } from '../compare-config';
import { PreferencesService } from '../preferences/preferences.service';
import { derivedState, evaluateAlert, meetsThreshold, type AlertCandidate, type AlertEvaluation, type AlertRule } from './alert-evaluator';

const ALERT_INCLUDE = {
  catalogProduct: { include: { category: true } },
  category: true,
  stores: { include: { storeChain: true, storeLocation: true } },
} as const satisfies Prisma.PriceAlertInclude;

type AlertRow = Prisma.PriceAlertGetPayload<{ include: typeof ALERT_INCLUDE }>;

const CATEGORY_ALERT_PRODUCT_LIMIT = 500;

export interface AlertCheckSummary {
  readonly checked: number;
  readonly triggered: number;
  readonly rearmed: number;
  readonly errors: number;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} of ${names.at(-1)}`;
}

function toRule(row: AlertRow): AlertRule {
  return {
    status: row.status,
    comparisonType: row.comparisonType,
    targetPriceCents: row.targetPriceCents,
    minimumDiscountPercentage: row.minimumDiscountPercentage,
    matchPreference: row.matchPreference,
    includeLoyaltyOffers: row.includeLoyaltyOffers,
    includePersonalizedOffers: row.includePersonalizedOffers,
    includeOnlineOffers: row.includeOnlineOffers,
    armed: row.armed,
    lastTriggeredPriceCents: row.lastTriggeredPriceCents,
  };
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CompareCatalogService,
    private readonly preferences: PreferencesService,
    private readonly config: CompareConfig,
  ) {}

  // ── Lezen ────────────────────────────────────────────────────────────────

  async list(userId: string, query: AlertListQuery, now: Date = new Date()): Promise<PriceAlert[]> {
    const rows = await this.prisma.priceAlert.findMany({
      where: {
        userId,
        ...(query.comparisonType ? { comparisonType: query.comparisonType } : {}),
        ...(query.category ? { OR: [{ category: { slug: query.category } }, { catalogProduct: { category: { slug: query.category } } }] } : {}),
        ...(query.chain ? { stores: { some: { storeChain: { slug: query.chain } } } } : {}),
      },
      include: ALERT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const dtos: PriceAlert[] = [];
    for (const row of rows) {
      const dto = await this.toDto(row, now);
      if (query.state && dto.derivedState !== query.state) continue;
      dtos.push(dto);
    }

    const closeness = (dto: PriceAlert): number => (dto.differenceCents === null ? Number.MAX_SAFE_INTEGER : Math.abs(dto.differenceCents));
    dtos.sort((a, b) => {
      switch (query.sort) {
        case 'BIGGEST_DROP':
          return (a.differenceCents ?? Number.MAX_SAFE_INTEGER) - (b.differenceCents ?? Number.MAX_SAFE_INTEGER);
        case 'NEWEST':
          return b.createdAt.localeCompare(a.createdAt);
        case 'LAST_CHECKED':
          return (b.lastCheckedAt ?? '').localeCompare(a.lastCheckedAt ?? '');
        case 'ALPHABETICAL':
          return (a.product?.name ?? a.categoryName ?? '').localeCompare(b.product?.name ?? b.categoryName ?? '');
        case 'CLOSEST':
        default:
          return closeness(a) - closeness(b);
      }
    });

    return dtos;
  }

  async get(userId: string, alertId: string, now: Date = new Date()): Promise<PriceAlert> {
    return this.toDto(await this.requireOwned(userId, alertId), now);
  }

  // ── Schrijven ────────────────────────────────────────────────────────────

  async preview(userId: string, input: CreatePriceAlertInput, now: Date = new Date()): Promise<AlertPreview> {
    const target = await this.resolveTarget(input);
    const chains = await this.resolveChains(userId, input.chainSlugs);
    const chainRefs = chains.map((chain) => ({ id: chain.id, slug: chain.slug, name: chain.name, logoUrl: chain.logoUrl }));

    const comparable = this.comparableReason(input, target.product);
    // "Al mijn supermarkten" wordt zonder PriceAlertStore-rijen bewaard; vergelijk dus met een lege set.
    const duplicate = await this.findDuplicate(userId, input, input.chainSlugs.length > 0 ? chains.map((chain) => chain.id) : [], null);

    let currentLowest: AlertPreview['currentLowest'] = null;
    if (comparable === null) {
      const candidates = await this.loadCandidates(
        {
          matchPreference: input.matchPreference,
          includePersonalizedOffers: input.includePersonalizedOffers,
          includeOnlineOffers: input.includeOnlineOffers,
          includeLoyaltyOffers: input.includeLoyaltyOffers,
        },
        target.product?.id ?? null,
        target.categoryId,
        chains.map((chain) => chain.slug),
        [],
        now,
      );
      const evaluation = evaluateAlert(
        {
          status: 'ACTIVE',
          comparisonType: input.comparisonType,
          targetPriceCents: input.targetPriceCents ?? null,
          minimumDiscountPercentage: input.minimumDiscountPercentage ?? null,
          matchPreference: input.matchPreference,
          includeLoyaltyOffers: input.includeLoyaltyOffers,
          includePersonalizedOffers: input.includePersonalizedOffers,
          includeOnlineOffers: input.includeOnlineOffers,
          armed: true,
          lastTriggeredPriceCents: null,
        },
        candidates.allowed,
        { allowDemo: this.config.allowDemo },
      );
      currentLowest = evaluation.best ? { offer: evaluation.best.candidate.offer, comparedValue: evaluation.best.comparedValue } : null;
    }

    const { differenceCents, differencePercentage } = this.difference(input.comparisonType, input.targetPriceCents ?? null, input.minimumDiscountPercentage ?? null, currentLowest?.comparedValue ?? null);

    return {
      product: target.product,
      categoryName: target.categoryName,
      chains: chainRefs,
      comparisonType: input.comparisonType,
      targetPriceCents: input.targetPriceCents ?? null,
      minimumDiscountPercentage: input.minimumDiscountPercentage ?? null,
      currentLowest,
      differenceCents,
      differencePercentage,
      sentence: this.sentence(input, target.product, target.categoryName, chainRefs),
      duplicateOfAlertId: duplicate,
      comparable: comparable === null,
      notComparableReason: comparable,
    };
  }

  async create(userId: string, input: CreatePriceAlertInput, now: Date = new Date()): Promise<PriceAlert> {
    const target = await this.resolveTarget(input);
    const chains = await this.resolveChains(userId, input.chainSlugs);

    const notComparable = this.comparableReason(input, target.product);
    if (notComparable) throw new ConflictException({ message: notComparable, code: 'NOT_COMPARABLE' });

    const duplicate = await this.findDuplicate(userId, input, input.chainSlugs.length > 0 ? chains.map((chain) => chain.id) : [], null);
    if (duplicate) {
      throw new ConflictException({
        message: 'Je hebt al een prijsalert met deze instellingen. Werk die bij in plaats van een nieuwe te maken.',
        code: 'DUPLICATE_ALERT',
        existingAlertId: duplicate,
      });
    }

    const row = await this.prisma.priceAlert.create({
      data: {
        userId,
        catalogProductId: target.product?.id ?? null,
        categoryId: target.categoryId,
        targetPriceCents: input.targetPriceCents ?? null,
        minimumDiscountPercentage: input.minimumDiscountPercentage ?? null,
        comparisonType: input.comparisonType,
        matchPreference: input.matchPreference,
        notificationChannel: input.notificationChannel,
        includeLoyaltyOffers: input.includeLoyaltyOffers,
        includePersonalizedOffers: input.includePersonalizedOffers,
        includeOnlineOffers: input.includeOnlineOffers,
        // Alleen expliciet gekozen ketens bewaren; leeg = "mijn voorkeuren", die kunnen veranderen.
        stores: input.chainSlugs.length > 0 ? { create: chains.map((chain) => ({ storeChainId: chain.id })) } : undefined,
      },
      include: ALERT_INCLUDE,
    });

    return this.toDto(row, now);
  }

  async update(userId: string, alertId: string, input: UpdatePriceAlertInput, now: Date = new Date()): Promise<PriceAlert> {
    const row = await this.requireOwned(userId, alertId);

    const comparisonType = input.comparisonType ?? row.comparisonType;
    const targetPriceCents = input.targetPriceCents ?? row.targetPriceCents;
    const minimumDiscountPercentage = input.minimumDiscountPercentage ?? row.minimumDiscountPercentage;
    if (comparisonType === 'DISCOUNT_PERCENTAGE' && minimumDiscountPercentage === null) {
      throw new ConflictException({ message: 'Geef een minimaal kortingspercentage op', code: 'INVALID_TARGET' });
    }
    if (comparisonType !== 'DISCOUNT_PERCENTAGE' && (targetPriceCents === null || targetPriceCents <= 0)) {
      throw new ConflictException({ message: 'Geef een doelprijs groter dan nul op', code: 'INVALID_TARGET' });
    }
    if (comparisonType === 'UNIT_PRICE' && row.catalogProduct && row.catalogProduct.normalizedUnit === null) {
      throw new ConflictException({ message: 'Dit product heeft geen bekende inhoud; een alert per kg/l/stuk is niet mogelijk', code: 'NOT_COMPARABLE' });
    }

    let chainIds: string[] | undefined;
    if (input.chainSlugs !== undefined) {
      chainIds = input.chainSlugs.length > 0 ? (await this.resolveChains(userId, input.chainSlugs)).map((chain) => chain.id) : [];
      const duplicate = await this.findDuplicate(
        userId,
        { catalogProductId: row.catalogProductId ?? undefined, categoryId: row.categoryId ?? undefined, comparisonType, matchPreference: input.matchPreference ?? row.matchPreference },
        chainIds,
        row.id,
      );
      if (duplicate) throw new ConflictException({ message: 'Er bestaat al een alert met deze instellingen', code: 'DUPLICATE_ALERT', existingAlertId: duplicate });
    }

    // Een gewijzigde grens zet de alert opnieuw op scherp: de vorige melding gold voor een andere grens.
    const thresholdChanged = input.targetPriceCents !== undefined || input.minimumDiscountPercentage !== undefined || input.comparisonType !== undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (chainIds !== undefined) {
        await tx.priceAlertStore.deleteMany({ where: { priceAlertId: row.id } });
        if (chainIds.length > 0) {
          await tx.priceAlertStore.createMany({ data: chainIds.map((storeChainId) => ({ priceAlertId: row.id, storeChainId })) });
        }
      }

      return tx.priceAlert.update({
        where: { id: row.id },
        data: {
          ...(input.comparisonType !== undefined ? { comparisonType: input.comparisonType } : {}),
          ...(input.targetPriceCents !== undefined ? { targetPriceCents: input.targetPriceCents } : {}),
          ...(input.minimumDiscountPercentage !== undefined ? { minimumDiscountPercentage: input.minimumDiscountPercentage } : {}),
          ...(input.matchPreference !== undefined ? { matchPreference: input.matchPreference } : {}),
          ...(input.notificationChannel !== undefined ? { notificationChannel: input.notificationChannel } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.includeLoyaltyOffers !== undefined ? { includeLoyaltyOffers: input.includeLoyaltyOffers } : {}),
          ...(input.includePersonalizedOffers !== undefined ? { includePersonalizedOffers: input.includePersonalizedOffers } : {}),
          ...(input.includeOnlineOffers !== undefined ? { includeOnlineOffers: input.includeOnlineOffers } : {}),
          ...(thresholdChanged ? { armed: true } : {}),
        },
        include: ALERT_INCLUDE,
      });
    });

    return this.toDto(updated, now);
  }

  async pause(userId: string, alertId: string): Promise<PriceAlert> {
    await this.requireOwned(userId, alertId);
    return this.toDto(await this.prisma.priceAlert.update({ where: { id: alertId }, data: { status: 'PAUSED' }, include: ALERT_INCLUDE }));
  }

  async resume(userId: string, alertId: string): Promise<PriceAlert> {
    await this.requireOwned(userId, alertId);
    return this.toDto(await this.prisma.priceAlert.update({ where: { id: alertId }, data: { status: 'ACTIVE', armed: true }, include: ALERT_INCLUDE }));
  }

  async remove(userId: string, alertId: string): Promise<void> {
    await this.requireOwned(userId, alertId);
    await this.prisma.priceAlert.delete({ where: { id: alertId } });
  }

  /** Alles van een gebruiker wissen: alerts én meldingen (AVG). */
  async eraseAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.alertNotification.deleteMany({ where: { userId } }),
      this.prisma.priceAlert.deleteMany({ where: { userId } }),
    ]);
  }

  // ── Meldingen ────────────────────────────────────────────────────────────

  async notifications(userId: string, limit = 50): Promise<AlertNotification[]> {
    const rows = await this.prisma.alertNotification.findMany({
      where: { userId, status: { in: ['SENT', 'PENDING', 'SKIPPED'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      ...(row.payload as unknown as AlertNotification),
      id: row.id,
      status: row.status,
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.prisma.alertNotification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.alertNotification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Melding niet gevonden');
    }
  }

  // ── Periodieke controle ──────────────────────────────────────────────────

  /**
   * Controleert alle actieve alerts en zet meldingen klaar. Opnieuw uitvoerbaar:
   * dezelfde prijs levert dankzij `armed` en de idempotency-sleutel geen tweede
   * melding op.
   */
  async checkAll(now: Date = new Date()): Promise<AlertCheckSummary> {
    const summary = { checked: 0, triggered: 0, rearmed: 0, errors: 0 };
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.prisma.priceAlert.findMany({
        where: { status: 'ACTIVE' },
        include: ALERT_INCLUDE,
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) break;
      cursor = batch.at(-1)!.id;

      for (const row of batch) {
        summary.checked++;
        try {
          const { evaluation, candidates } = await this.evaluate(row, now);

          if (evaluation.triggered && evaluation.best) {
            const created = await this.queueNotification(row, evaluation, candidates.hints, now);
            await this.prisma.priceAlert.update({
              where: { id: row.id },
              data: {
                armed: false,
                lastCheckedAt: now,
                lastTriggeredAt: now,
                lastTriggeredPriceCents: evaluation.best.comparedValue,
                lastTriggeredOfferId: evaluation.best.candidate.offer.id,
              },
            });
            if (created) summary.triggered++;
          } else {
            await this.prisma.priceAlert.update({
              where: { id: row.id },
              data: { lastCheckedAt: now, ...(evaluation.rearm ? { armed: true } : {}) },
            });
            if (evaluation.rearm) summary.rearmed++;
          }
        } catch (error) {
          summary.errors++;
          this.logger.error(`alert ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    this.logger.log(`Alerts: ${summary.checked} gecontroleerd, ${summary.triggered} geactiveerd, ${summary.rearmed} opnieuw op scherp, ${summary.errors} fouten`);
    return summary;
  }

  // ── Intern ───────────────────────────────────────────────────────────────

  private async requireOwned(userId: string, alertId: string): Promise<AlertRow> {
    const row = await this.prisma.priceAlert.findUnique({ where: { id: alertId }, include: ALERT_INCLUDE });
    if (!row || row.userId !== userId) throw new NotFoundException('Prijsalert niet gevonden');
    return row;
  }

  private async resolveTarget(input: {
    catalogProductId?: string | undefined;
    categoryId?: string | undefined;
  }): Promise<{ product: CatalogProductSummary | null; categoryId: string | null; categoryName: string | null }> {
    if (input.catalogProductId) {
      const row = await this.prisma.catalogProduct.findUnique({ where: { id: input.catalogProductId }, include: { category: true } });
      if (!row || !row.active) throw new NotFoundException('Product niet gevonden');
      return { product: this.catalog.productSummary(row), categoryId: null, categoryName: null };
    }

    const category = await this.prisma.catalogCategory.findUnique({ where: { id: input.categoryId ?? '' } });
    if (!category) throw new NotFoundException('Categorie niet gevonden');
    return { product: null, categoryId: category.id, categoryName: category.nameNl };
  }

  /** De ketens van de alert, of — bij een lege keuze — de ingeschakelde ketens uit de voorkeuren. */
  private async resolveChains(userId: string, slugs: readonly string[]) {
    const chosen = slugs.length > 0 ? slugs : (await this.preferences.get(userId)).enabledChainSlugs;
    const chains = await this.catalog.chains(chosen);
    if (slugs.length > 0 && chains.length !== new Set(slugs).size) {
      throw new NotFoundException('Eén of meer gekozen supermarkten bestaan niet');
    }
    return chains;
  }

  private comparableReason(input: { comparisonType: CreatePriceAlertInput['comparisonType'] }, product: CatalogProductSummary | null): string | null {
    if (input.comparisonType === 'UNIT_PRICE' && product && product.normalizedUnit === null) {
      return 'Dit product heeft geen bekende inhoud; een alert per kg, liter of stuk is niet mogelijk';
    }
    return null;
  }

  private async findDuplicate(
    userId: string,
    input: { catalogProductId?: string | undefined; categoryId?: string | undefined; comparisonType: AlertRow['comparisonType']; matchPreference: AlertRow['matchPreference'] },
    chainIds: readonly string[],
    excludeId: string | null,
  ): Promise<string | null> {
    const candidates = await this.prisma.priceAlert.findMany({
      where: {
        userId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        catalogProductId: input.catalogProductId ?? null,
        categoryId: input.categoryId ?? null,
        comparisonType: input.comparisonType,
        matchPreference: input.matchPreference,
      },
      select: { id: true, stores: { select: { storeChainId: true } } },
    });

    const wanted = [...new Set(chainIds)].sort().join(',');
    for (const candidate of candidates) {
      const existing = [...new Set(candidate.stores.map((store) => store.storeChainId))].sort().join(',');
      if (existing === wanted) return candidate.id;
    }
    return null;
  }

  private difference(
    type: AlertRow['comparisonType'],
    target: number | null,
    minimumDiscount: number | null,
    value: number | null,
  ): { differenceCents: number | null; differencePercentage: number | null } {
    if (value === null) return { differenceCents: null, differencePercentage: null };

    if (type === 'DISCOUNT_PERCENTAGE') {
      if (minimumDiscount === null) return { differenceCents: null, differencePercentage: null };
      return { differenceCents: null, differencePercentage: minimumDiscount - value };
    }

    if (target === null || target === 0) return { differenceCents: null, differencePercentage: null };
    const differenceCents = value - target;
    return { differenceCents, differencePercentage: Math.round((differenceCents / target) * 100) };
  }

  private sentence(
    input: { comparisonType: AlertRow['comparisonType']; targetPriceCents?: number | undefined; minimumDiscountPercentage?: number | undefined },
    product: CatalogProductSummary | null,
    categoryName: string | null,
    chains: readonly StoreChainRef[],
  ): string {
    const subject = product ? productLabel(product) : `producten uit ${categoryName ?? 'deze categorie'}`;
    const where = chains.length > 0 ? ` bij ${joinNames(chains.map((chain) => chain.name))}` : ' bij je gekozen supermarkten';

    switch (input.comparisonType) {
      case 'PACKAGE_PRICE':
        return `We laten je weten wanneer ${subject}${where} ${formatCents(input.targetPriceCents ?? 0)} of minder kost.`;
      case 'UNIT_PRICE': {
        const unit = product?.normalizedUnit ? perUnitLabel(product.normalizedUnit) : 'eenheid';
        return `We laten je weten wanneer ${subject}${where} ${formatCents(input.targetPriceCents ?? 0)} per ${unit} of minder kost.`;
      }
      case 'DISCOUNT_PERCENTAGE':
        return `We laten je weten wanneer ${subject}${where} minstens ${input.minimumDiscountPercentage ?? 0}% korting heeft.`;
    }
  }

  /**
   * Laadt kandidaten: `allowed` is wat de alert mag laten afgaan, `hints` zijn
   * alle gerelateerde aanbiedingen (ook alternatieven) voor de tip
   * "goedkoper alternatief" in de melding.
   */
  private async loadCandidates(
    rule: Pick<AlertRule, 'matchPreference' | 'includePersonalizedOffers' | 'includeOnlineOffers' | 'includeLoyaltyOffers'>,
    productId: string | null,
    categoryId: string | null,
    chainSlugs: readonly string[],
    locationIds: readonly string[],
    now: Date,
  ): Promise<{ allowed: AlertCandidate[]; hints: AlertCandidate[] }> {
    const productsWithType: Array<{ id: string; matchType: MatchType }> = [];

    if (productId) {
      productsWithType.push({ id: productId, matchType: 'EXACT' });
      const { related } = await this.catalog.related(productId);
      for (const entry of related) {
        if (entry.matchType === 'EQUIVALENT' || entry.matchType === 'ALTERNATIVE') productsWithType.push({ id: entry.product.id, matchType: entry.matchType });
      }
    } else if (categoryId) {
      const rows = await this.prisma.catalogProduct.findMany({ where: { categoryId, active: true }, select: { id: true }, take: CATEGORY_ALERT_PRODUCT_LIMIT });
      for (const row of rows) productsWithType.push({ id: row.id, matchType: 'EXACT' });
    }

    const offersByProduct = await this.catalog.offersByProduct(
      productsWithType.map((entry) => entry.id),
      {
        chainSlugs,
        includePersonalized: rule.includePersonalizedOffers,
        includeOnline: rule.includeOnlineOffers,
        loyalty: rule.includeLoyaltyOffers ? 'ANY' : 'NOT_REQUIRED',
        ...(locationIds.length > 0 ? { locationIds } : {}),
      },
      now,
    );

    const hints: AlertCandidate[] = [];
    for (const entry of productsWithType) {
      for (const offer of offersByProduct.get(entry.id) ?? []) hints.push({ offer, matchType: entry.matchType });
    }

    const allowedTypes: readonly MatchType[] =
      rule.matchPreference === 'EXACT' ? ['EXACT'] : rule.matchPreference === 'EQUIVALENT' ? ['EXACT', 'EQUIVALENT'] : ['EXACT', 'EQUIVALENT', 'ALTERNATIVE'];

    return { allowed: hints.filter((candidate) => allowedTypes.includes(candidate.matchType)), hints };
  }

  private async evaluate(row: AlertRow, now: Date): Promise<{ evaluation: AlertEvaluation; candidates: { allowed: AlertCandidate[]; hints: AlertCandidate[] } }> {
    const chainSlugs = row.stores.length > 0 ? [...new Set(row.stores.map((store) => store.storeChain.slug))] : (await this.preferences.get(row.userId)).enabledChainSlugs;
    const locationIds = row.stores.map((store) => store.storeLocationId).filter((id): id is string => id !== null);

    const candidates = await this.loadCandidates(toRule(row), row.catalogProductId, row.categoryId, chainSlugs, locationIds, now);
    const evaluation = evaluateAlert(toRule(row), candidates.allowed, { allowDemo: this.config.allowDemo });

    return { evaluation, candidates };
  }

  private async toDto(row: AlertRow, now: Date = new Date()): Promise<PriceAlert> {
    const { evaluation } = await this.evaluate(row, now);
    const best = evaluation.best;
    const rule = toRule(row);
    const { differenceCents, differencePercentage } = this.difference(row.comparisonType, row.targetPriceCents, row.minimumDiscountPercentage, best?.comparedValue ?? null);

    const chains: StoreChainRef[] = row.stores.map((store) => ({
      id: store.storeChain.id,
      slug: store.storeChain.slug,
      name: store.storeChain.name,
      logoUrl: store.storeChain.logoUrl,
    }));

    return {
      id: row.id,
      product: row.catalogProduct ? this.catalog.productSummary(row.catalogProduct) : null,
      categoryId: row.categoryId,
      categoryName: row.category?.nameNl ?? null,
      comparisonType: row.comparisonType,
      matchPreference: row.matchPreference,
      chains: chains.filter((chain, index) => chains.findIndex((c) => c.id === chain.id) === index),
      targetPriceCents: row.targetPriceCents,
      minimumDiscountPercentage: row.minimumDiscountPercentage,
      notificationChannel: row.notificationChannel,
      status: row.status,
      derivedState: derivedState(rule, best),
      includeLoyaltyOffers: row.includeLoyaltyOffers,
      includePersonalizedOffers: row.includePersonalizedOffers,
      includeOnlineOffers: row.includeOnlineOffers,
      currentLowest: best ? { offer: best.candidate.offer, comparedValue: best.comparedValue } : null,
      differenceCents,
      differencePercentage,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      lastTriggeredPriceCents: row.lastTriggeredPriceCents,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Zet één melding klaar. Geeft `false` terug als ze (door een retry) al bestond. */
  private async queueNotification(row: AlertRow, evaluation: AlertEvaluation, hints: readonly AlertCandidate[], now: Date): Promise<boolean> {
    const best = evaluation.best!;
    const offer = best.candidate.offer;
    const idempotencyKey = `${row.id}:${offer.id}:${best.comparedValue}`;
    const digestKey = `${row.userId}:${now.toISOString().slice(0, 10)}`;

    const previousPriceCents = await this.previousPrice(offer, now);
    const product = row.catalogProduct ? this.catalog.productSummary(row.catalogProduct) : null;
    const productName = product ? productLabel(product) : offer.storeProductName;

    // Een goedkoper alternatief dat de alert zelf niet mocht gebruiken, is wél een nuttige tip.
    const cheaperAlternative =
      hints
        .filter((hint) => hint.matchType !== 'EXACT' && hint.offer.id !== offer.id && hint.offer.priceCents < offer.priceCents && !hint.offer.provenance.isDemo === !offer.provenance.isDemo)
        .sort((a, b) => a.offer.priceCents - b.offer.priceCents)[0]?.offer ?? null;

    const savingsCents = previousPriceCents !== null && previousPriceCents > offer.priceCents ? previousPriceCents - offer.priceCents : (offer.originalPriceCents ?? 0) > offer.priceCents ? offer.originalPriceCents! - offer.priceCents : null;

    const parts = [`${productName} kost nu ${formatCents(offer.priceCents)} bij ${offer.storeChain.name}${offer.storeLocation ? ` (${offer.storeLocation.name})` : ''}`];
    if (previousPriceCents !== null && previousPriceCents !== offer.priceCents) parts.push(`(was ${formatCents(previousPriceCents)})`);
    if (row.comparisonType === 'PACKAGE_PRICE' && row.targetPriceCents !== null) parts.push(`· jouw grens: ${formatCents(row.targetPriceCents)}`);
    if (row.comparisonType === 'UNIT_PRICE' && offer.unitPrice) parts.push(`· ${formatCents(offer.unitPrice.cents)} per ${perUnitLabel(offer.unitPrice.unit)}`);
    if (row.comparisonType === 'DISCOUNT_PERCENTAGE' && offer.discountPercentage !== null) parts.push(`· ${offer.discountPercentage}% korting`);
    if (offer.conditions) parts.push(`· ${offer.conditions}`);
    if (offer.provenance.validUntil) parts.push(`· geldig tot ${new Date(offer.provenance.validUntil).toLocaleDateString('nl-BE', { timeZone: 'Europe/Brussels' })}`);
    if (offer.provenance.isDemo) parts.push('· demogegevens');

    const payload: AlertNotification = {
      id: '',
      priceAlertId: row.id,
      channel: row.notificationChannel,
      status: 'PENDING',
      productName,
      storeChain: offer.storeChain,
      storeLocationName: offer.storeLocation?.name ?? null,
      triggeredPriceCents: offer.priceCents,
      previousPriceCents,
      targetPriceCents: row.targetPriceCents,
      savingsCents,
      unitPriceCents: offer.unitPrice?.cents ?? null,
      conditions: offer.conditions,
      validUntil: offer.provenance.validUntil,
      link: row.catalogProductId ? `/producten/${row.catalogProductId}` : `/alerts/${row.id}`,
      cheaperAlternative,
      message: parts.join(' '),
      sentAt: null,
      readAt: null,
      createdAt: now.toISOString(),
    };

    try {
      await this.prisma.alertNotification.create({
        data: {
          priceAlertId: row.id,
          productOfferId: offer.id,
          userId: row.userId,
          channel: row.notificationChannel,
          idempotencyKey,
          digestKey,
          triggeredPriceCents: offer.priceCents,
          previousPriceCents,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  /** De vorige geregistreerde prijs van dit winkelproduct, als die er is. */
  private async previousPrice(offer: ProductOffer, now: Date): Promise<number | null> {
    const row = await this.prisma.productOffer.findUnique({ where: { id: offer.id }, select: { storeProductId: true, storeLocationId: true } });
    if (!row) return offer.originalPriceCents;

    const history = await this.prisma.priceHistory.findMany({
      where: { storeProductId: row.storeProductId, storeLocationId: row.storeLocationId, observedAt: { lte: now } },
      orderBy: { observedAt: 'desc' },
      take: 2,
      select: { priceCents: true },
    });

    const previous = history.find((point) => point.priceCents !== offer.priceCents);
    return previous?.priceCents ?? offer.originalPriceCents;
  }
}

/** Hulp voor tests en controllers: is de grens gehaald voor een gegeven waarde? */
export { meetsThreshold };

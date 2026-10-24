/**
 * Boodschappenlijsten en het doorrekenen van een lijst over de ketens.
 *
 * Eigenaarschap wordt in élke methode gecontroleerd. Eén foutmelding voor
 * "bestaat niet" en "niet van jou", zoals elders in deze API: anders kan
 * iemand met geraden id's uitvinden welke lijsten bestaan.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AddShoppingListItemInput,
  BasketCompareInput,
  BasketCompareResult,
  CreateShoppingListInput,
  ShoppingList,
  ShoppingListItem,
  ShoppingListSummary,
  UpdateShoppingListInput,
  UpdateShoppingListItemInput,
} from '@superette/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { compareBaskets, type OptimizerCandidate, type OptimizerChain, type OptimizerItem } from '../basket/basket-optimizer';
import { CompareCatalogService, productLabel } from '../catalog/compare-catalog.service';
import { PreferencesService } from '../preferences/preferences.service';

const LIST_INCLUDE = {
  items: { include: { catalogProduct: { include: { category: true } } }, orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.ShoppingListInclude;

type ListRow = Prisma.ShoppingListGetPayload<{ include: typeof LIST_INCLUDE }>;

const MAX_ITEMS_PER_LIST = 200;

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CompareCatalogService,
    private readonly preferences: PreferencesService,
  ) {}

  async list(userId: string): Promise<ShoppingListSummary[]> {
    const rows = await this.prisma.shoppingList.findMany({
      where: { userId },
      orderBy: [{ archived: 'asc' }, { updatedAt: 'desc' }],
      include: { items: { select: { checked: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      archived: row.archived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      itemCount: row.items.length,
      checkedCount: row.items.filter((item) => item.checked).length,
    }));
  }

  async create(userId: string, input: CreateShoppingListInput): Promise<ShoppingList> {
    const row = await this.prisma.shoppingList.create({ data: { userId, name: input.name }, include: LIST_INCLUDE });
    return this.toDto(row);
  }

  async get(userId: string, listId: string): Promise<ShoppingList> {
    return this.toDto(await this.requireOwned(userId, listId));
  }

  async update(userId: string, listId: string, input: UpdateShoppingListInput): Promise<ShoppingList> {
    await this.requireOwned(userId, listId);
    const row = await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.archived !== undefined ? { archived: input.archived } : {}) },
      include: LIST_INCLUDE,
    });
    return this.toDto(row);
  }

  async remove(userId: string, listId: string): Promise<void> {
    await this.requireOwned(userId, listId);
    await this.prisma.shoppingList.delete({ where: { id: listId } });
  }

  /** Voegt een product of vrije regel toe. Hetzelfde product nogmaals toevoegen verhoogt het aantal. */
  async addItem(userId: string, listId: string, input: AddShoppingListItemInput): Promise<ShoppingList> {
    const list = await this.requireOwned(userId, listId);
    if (list.items.length >= MAX_ITEMS_PER_LIST) throw new BadRequestException(`Een lijst bevat maximaal ${MAX_ITEMS_PER_LIST} regels`);

    if (input.catalogProductId) {
      const product = await this.prisma.catalogProduct.findUnique({ where: { id: input.catalogProductId }, select: { id: true, active: true } });
      if (!product || !product.active) throw new NotFoundException('Product niet gevonden');

      const existing = list.items.find((item) => item.catalogProductId === input.catalogProductId);
      if (existing) {
        await this.prisma.shoppingListItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(99, existing.quantity + input.quantity), checked: false },
        });
        return this.get(userId, listId);
      }
    }

    const sortOrder = (list.items.at(-1)?.sortOrder ?? -1) + 1;
    await this.prisma.shoppingListItem.create({
      data: {
        listId,
        catalogProductId: input.catalogProductId ?? null,
        freeText: input.freeText ?? null,
        quantity: input.quantity,
        exactBrandRequired: input.exactBrandRequired,
        allowStoreBrand: input.allowStoreBrand,
        allowAlternatives: input.allowAlternatives,
        maxPriceCents: input.maxPriceCents ?? null,
        preferredChainSlug: input.preferredChainSlug ?? null,
        desiredPackageLabel: input.desiredPackageLabel ?? null,
        sortOrder,
      },
    });

    await this.touch(listId);
    return this.get(userId, listId);
  }

  async updateItem(userId: string, listId: string, itemId: string, input: UpdateShoppingListItemInput): Promise<ShoppingList> {
    const list = await this.requireOwned(userId, listId);
    const item = list.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException('Regel niet gevonden');

    if (input.catalogProductId) {
      const product = await this.prisma.catalogProduct.findUnique({ where: { id: input.catalogProductId }, select: { active: true } });
      if (!product || !product.active) throw new NotFoundException('Product niet gevonden');
    }

    await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.checked !== undefined ? { checked: input.checked } : {}),
        ...(input.freeText !== undefined ? { freeText: input.freeText } : {}),
        ...(input.catalogProductId !== undefined ? { catalogProductId: input.catalogProductId } : {}),
        ...(input.exactBrandRequired !== undefined ? { exactBrandRequired: input.exactBrandRequired } : {}),
        ...(input.allowStoreBrand !== undefined ? { allowStoreBrand: input.allowStoreBrand } : {}),
        ...(input.allowAlternatives !== undefined ? { allowAlternatives: input.allowAlternatives } : {}),
        ...(input.maxPriceCents !== undefined ? { maxPriceCents: input.maxPriceCents } : {}),
        ...(input.preferredChainSlug !== undefined ? { preferredChainSlug: input.preferredChainSlug } : {}),
        ...(input.desiredPackageLabel !== undefined ? { desiredPackageLabel: input.desiredPackageLabel } : {}),
      },
    });

    await this.touch(listId);
    return this.get(userId, listId);
  }

  async removeItem(userId: string, listId: string, itemId: string): Promise<ShoppingList> {
    const list = await this.requireOwned(userId, listId);
    if (!list.items.some((item) => item.id === itemId)) throw new NotFoundException('Regel niet gevonden');

    await this.prisma.shoppingListItem.delete({ where: { id: itemId } });
    await this.touch(listId);
    return this.get(userId, listId);
  }

  /** Alles verwijderen van een gebruiker (AVG). */
  async eraseAll(userId: string): Promise<void> {
    await this.prisma.shoppingList.deleteMany({ where: { userId } });
  }

  /**
   * Rekent de lijst door over de gekozen ketens.
   *
   * Per regel worden de exacte aanbiedingen én die van gerelateerde producten
   * (andere verpakking, alternatief) als kandidaten meegegeven; de optimizer
   * past de voorkeuren per regel toe en legt elke keuze uit.
   */
  async compare(userId: string, listId: string, input: BasketCompareInput, now: Date = new Date()): Promise<BasketCompareResult> {
    const list = await this.requireOwned(userId, listId);
    const prefs = await this.preferences.get(userId);

    const chainSlugs = input.chainSlugs.length > 0 ? input.chainSlugs : prefs.enabledChainSlugs;
    const chains = await this.catalog.chains(chainSlugs);
    const coverage = await this.catalog.coverage(chains.map((chain) => chain.slug));
    const hasData = new Map(coverage.chains.map((entry) => [entry.slug, entry.hasData]));

    const optimizerChains: OptimizerChain[] = chains.map((chain) => ({
      ref: { id: chain.id, slug: chain.slug, name: chain.name, logoUrl: chain.logoUrl },
      loyaltyCardName: chain.loyaltyCardName,
      hasLoyaltyCard: prefs.loyaltyCardChainSlugs.includes(chain.slug),
      hasData: hasData.get(chain.slug) ?? false,
      // Afstand vraagt filiaalcoördinaten én een locatie van de gebruiker; nog niet beschikbaar.
      distanceKm: null,
    }));

    // Kandidaten: het product zelf plus gerelateerde producten, met hun matchtype.
    const productItems = list.items.filter((item) => item.catalogProductId !== null);
    const relatedByProduct = new Map<string, Awaited<ReturnType<CompareCatalogService['related']>>['related']>();
    for (const item of productItems) {
      const productId = item.catalogProductId!;
      if (!relatedByProduct.has(productId)) relatedByProduct.set(productId, (await this.catalog.related(productId)).related);
    }

    const allProductIds = new Set<string>();
    for (const [productId, related] of relatedByProduct) {
      allProductIds.add(productId);
      for (const entry of related) allProductIds.add(entry.product.id);
    }

    const offersByProduct = await this.catalog.offersByProduct(
      [...allProductIds],
      {
        chainSlugs: chains.map((chain) => chain.slug),
        includePersonalized: input.includePersonalizedOffers,
        includeOnline: input.includeOnlineOffers,
        loyalty: 'ANY',
      },
      now,
    );

    const items: OptimizerItem[] = list.items.map((item) => {
      const constraints = {
        exactBrandRequired: item.exactBrandRequired,
        allowStoreBrand: item.allowStoreBrand && !(prefs.preferNationalBrands && item.exactBrandRequired),
        allowAlternatives: item.allowAlternatives && prefs.allowAlternatives,
        maxPriceCents: item.maxPriceCents,
        preferredChainSlug: item.preferredChainSlug,
        desiredPackageLabel: item.desiredPackageLabel,
      };

      if (!item.catalogProductId || !item.catalogProduct) {
        return { itemId: item.id, label: item.freeText ?? 'Vrije regel', quantity: item.quantity, freeText: true, constraints, candidates: [] };
      }

      const product = this.catalog.productSummary(item.catalogProduct);
      const candidates: OptimizerCandidate[] = (offersByProduct.get(item.catalogProductId) ?? []).map((offer) => ({ offer, product, matchType: 'EXACT' as const }));
      for (const related of relatedByProduct.get(item.catalogProductId) ?? []) {
        for (const offer of offersByProduct.get(related.product.id) ?? []) {
          candidates.push({ offer, product: related.product, matchType: related.matchType });
        }
      }

      return {
        itemId: item.id,
        label: productLabel(product),
        quantity: item.quantity,
        freeText: false,
        constraints,
        candidates,
      };
    });

    const result = compareBaskets(items, optimizerChains, input);

    return {
      listId,
      mode: input.mode,
      settings: input,
      perStore: result.perStore,
      bestSingleStore: result.bestSingleStore,
      cheapestCombination: result.cheapestCombination,
      balanced: result.balanced,
      summary: result.summary,
      coverage,
      containsDemoData: result.perStore.some((store) => store.containsDemoData),
      freeTextLines: result.freeTextLines,
    };
  }

  // ── Intern ───────────────────────────────────────────────────────────────

  private async requireOwned(userId: string, listId: string): Promise<ListRow> {
    const row = await this.prisma.shoppingList.findUnique({ where: { id: listId }, include: LIST_INCLUDE });
    if (!row || row.userId !== userId) throw new NotFoundException('Boodschappenlijst niet gevonden');
    return row;
  }

  private async touch(listId: string): Promise<void> {
    await this.prisma.shoppingList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  }

  private toDto(row: ListRow): ShoppingList {
    return {
      id: row.id,
      name: row.name,
      archived: row.archived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: row.items.map(
        (item): ShoppingListItem => ({
          id: item.id,
          catalogProductId: item.catalogProductId,
          product: item.catalogProduct ? this.catalog.productSummary(item.catalogProduct) : null,
          freeText: item.freeText,
          quantity: item.quantity,
          checked: item.checked,
          exactBrandRequired: item.exactBrandRequired,
          allowStoreBrand: item.allowStoreBrand,
          allowAlternatives: item.allowAlternatives,
          maxPriceCents: item.maxPriceCents,
          preferredChainSlug: item.preferredChainSlug,
          desiredPackageLabel: item.desiredPackageLabel,
          sortOrder: item.sortOrder,
        }),
      ),
    };
  }
}

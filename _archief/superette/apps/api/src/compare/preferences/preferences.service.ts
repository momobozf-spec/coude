/**
 * Winkelvoorkeuren per gebruiker. Alles wat zoekt, vergelijkt of alerts
 * controleert, vertrekt van `effective(userId)`.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_COMPARE_PREFERENCES, type ComparePreferences, type UpdateComparePreferencesInput } from '@superette/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<ComparePreferences> {
    const [row, chainPrefs, favorites] = await Promise.all([
      this.prisma.comparePreference.findUnique({ where: { userId } }),
      this.prisma.userChainPreference.findMany({ where: { userId }, include: { storeChain: { select: { slug: true, active: true } } } }),
      this.prisma.userFavoriteLocation.findMany({ where: { userId }, select: { storeLocationId: true } }),
    ]);

    const active = chainPrefs.filter((pref) => pref.storeChain.active);
    const anyDisabled = active.some((pref) => !pref.enabled);

    return {
      // Alleen een expliciete beperking bewaren we als lijst; "alles aan" = lege lijst.
      enabledChainSlugs: anyDisabled ? active.filter((pref) => pref.enabled).map((pref) => pref.storeChain.slug) : [],
      favoriteChainSlugs: active.filter((pref) => pref.isFavorite).map((pref) => pref.storeChain.slug),
      loyaltyCardChainSlugs: active.filter((pref) => pref.hasLoyaltyCard).map((pref) => pref.storeChain.slug),
      favoriteLocationIds: favorites.map((favorite) => favorite.storeLocationId),
      postalCode: row?.postalCode ?? DEFAULT_COMPARE_PREFERENCES.postalCode,
      municipality: row?.municipality ?? DEFAULT_COMPARE_PREFERENCES.municipality,
      maxDistanceKm: row?.maxDistanceKm ?? DEFAULT_COMPARE_PREFERENCES.maxDistanceKm,
      preferStoreBrands: row?.preferStoreBrands ?? DEFAULT_COMPARE_PREFERENCES.preferStoreBrands,
      preferNationalBrands: row?.preferNationalBrands ?? DEFAULT_COMPARE_PREFERENCES.preferNationalBrands,
      allowAlternatives: row?.allowAlternatives ?? DEFAULT_COMPARE_PREFERENCES.allowAlternatives,
      includePersonalizedOffers: row?.includePersonalizedOffers ?? DEFAULT_COMPARE_PREFERENCES.includePersonalizedOffers,
      includeOnlineOffers: row?.includeOnlineOffers ?? DEFAULT_COMPARE_PREFERENCES.includeOnlineOffers,
      emailNotifications: row?.emailNotifications ?? DEFAULT_COMPARE_PREFERENCES.emailNotifications,
    };
  }

  async update(userId: string, input: UpdateComparePreferencesInput): Promise<ComparePreferences> {
    const chains = await this.prisma.storeChain.findMany({ where: { active: true }, select: { id: true, slug: true } });
    const chainBySlug = new Map(chains.map((chain) => [chain.slug, chain.id]));

    const resolve = (slugs: string[] | undefined, label: string): Set<string> | undefined => {
      if (slugs === undefined) return undefined;
      const ids = new Set<string>();
      for (const slug of slugs) {
        const id = chainBySlug.get(slug);
        if (!id) throw new BadRequestException(`Onbekende supermarkt in ${label}: ${slug}`);
        ids.add(id);
      }
      return ids;
    };

    const enabled = resolve(input.enabledChainSlugs, 'enabledChainSlugs');
    const favorite = resolve(input.favoriteChainSlugs, 'favoriteChainSlugs');
    const loyalty = resolve(input.loyaltyCardChainSlugs, 'loyaltyCardChainSlugs');

    let favoriteLocationIds: string[] | undefined;
    if (input.favoriteLocationIds !== undefined) {
      const found = await this.prisma.storeLocation.findMany({
        where: { id: { in: input.favoriteLocationIds }, active: true },
        select: { id: true },
      });
      if (found.length !== new Set(input.favoriteLocationIds).size) {
        throw new BadRequestException('Eén of meer favoriete filialen bestaan niet');
      }
      favoriteLocationIds = found.map((location) => location.id);
    }

    const scalar = {
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.municipality !== undefined ? { municipality: input.municipality } : {}),
      ...(input.maxDistanceKm !== undefined ? { maxDistanceKm: input.maxDistanceKm } : {}),
      ...(input.preferStoreBrands !== undefined ? { preferStoreBrands: input.preferStoreBrands } : {}),
      ...(input.preferNationalBrands !== undefined ? { preferNationalBrands: input.preferNationalBrands } : {}),
      ...(input.allowAlternatives !== undefined ? { allowAlternatives: input.allowAlternatives } : {}),
      ...(input.includePersonalizedOffers !== undefined ? { includePersonalizedOffers: input.includePersonalizedOffers } : {}),
      ...(input.includeOnlineOffers !== undefined ? { includeOnlineOffers: input.includeOnlineOffers } : {}),
      ...(input.emailNotifications !== undefined ? { emailNotifications: input.emailNotifications } : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.comparePreference.upsert({ where: { userId }, update: scalar, create: { userId, ...scalar } });

      if (enabled || favorite || loyalty) {
        for (const chain of chains) {
          const data = {
            ...(enabled ? { enabled: enabled.size === 0 ? true : enabled.has(chain.id) } : {}),
            ...(favorite ? { isFavorite: favorite.has(chain.id) } : {}),
            ...(loyalty ? { hasLoyaltyCard: loyalty.has(chain.id) } : {}),
          };
          await tx.userChainPreference.upsert({
            where: { userId_storeChainId: { userId, storeChainId: chain.id } },
            update: data,
            create: { userId, storeChainId: chain.id, ...data },
          });
        }
      }

      if (favoriteLocationIds) {
        await tx.userFavoriteLocation.deleteMany({ where: { userId } });
        if (favoriteLocationIds.length > 0) {
          await tx.userFavoriteLocation.createMany({ data: favoriteLocationIds.map((storeLocationId) => ({ userId, storeLocationId })) });
        }
      }
    });

    return this.get(userId);
  }

  /** Verwijdert alle voorkeuren van een gebruiker (AVG: recht op wissing). */
  async erase(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userFavoriteLocation.deleteMany({ where: { userId } }),
      this.prisma.userChainPreference.deleteMany({ where: { userId } }),
      this.prisma.comparePreference.deleteMany({ where: { userId } }),
    ]);
  }
}

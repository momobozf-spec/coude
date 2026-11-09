/**
 * De uniforme supermarktadapter.
 *
 * ## Het principe
 *
 * De kern van de vergelijker kent géén Delhaize-JSON, géén Colruyt-feed en
 * géén Lidl-API. Ze kent alleen `AdapterSnapshot`: filialen, winkelproducten
 * en aanbiedingen in ons eigen formaat. Elke keten krijgt één adapter die
 * haar bron — officiële API, gelicentieerde feed, handmatig importbestand —
 * naar dat formaat vertaalt.
 *
 * Een nieuwe keten toevoegen is daardoor: één adapter schrijven en hem in
 * `adapter-registry.ts` registreren. Niets anders wijzigt.
 *
 * ## Bronnen en voorwaarden
 *
 * Een adapter scrapet niet. `source.termsReviewed` is een expliciete
 * verklaring dat gebruiksvoorwaarden, robots-regels, databankrechten en rate
 * limits van de bron zijn nagekeken. Zolang dat `false` is, mag de adapter
 * alleen importbestanden en demogegevens leveren.
 */
import type {
  Availability,
  BrandType,
  DataSourceKind,
  OfferChannel,
  PackageUnit,
  PromotionRuleInput,
  PromotionType,
} from '@superette/contracts';

export interface AdapterChainInfo {
  readonly slug: string;
  readonly name: string;
  readonly logoUrl?: string | null;
  readonly websiteUrl?: string | null;
  /** Naam van de klantenkaart, bv. "Xtra". `null` als de keten er geen heeft. */
  readonly loyaltyCardName?: string | null;
  readonly sortOrder?: number;
}

export interface AdapterSourceInfo {
  readonly kind: DataSourceKind;
  /** Leesbaar, bv. "Demogegevens" of "Importbestand delhaize.json". */
  readonly label: string;
  /** Zijn gebruiksvoorwaarden, robots-regels, databankrechten en rate limits nagekeken? */
  readonly termsReviewed: boolean;
  readonly notes?: string;
}

export interface NormalizedLocation {
  readonly externalId: string;
  readonly name: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly serviceArea?: string | null;
  readonly active?: boolean;
}

export interface NormalizedStoreProduct {
  /** Sku of id in de bron van de keten. Stabiel over imports heen. */
  readonly externalId: string;
  readonly name: string;
  readonly brand?: string | null;
  readonly brandType?: BrandType;
  readonly barcode?: string | null;
  readonly imageUrl?: string | null;
  readonly productUrl?: string | null;
  readonly description?: string | null;
  /** Categoriepad in de bron, bv. "Dranken > Frisdrank". */
  readonly categoryPath?: string | null;
  /** Onze categorie-slug, als de adapter die al kan bepalen. */
  readonly categorySlug?: string | null;
  readonly packageQuantity?: number | null;
  readonly packageUnit?: PackageUnit | null;
  readonly packCount?: number;
  readonly active?: boolean;
}

export interface NormalizedOffer {
  readonly productExternalId: string;
  /** Filiaal waarvoor de prijs geldt. `null` = de hele keten. */
  readonly locationExternalId?: string | null;
  /** Stabiele sleutel in de bron, bv. `${sku}:regular` of `${sku}:promo-2026w40`. */
  readonly sourceReference: string;
  /** Prijs voor één verpakking vandaag, zonder statiegeld, onvoorwaardelijke promo verrekend. */
  readonly priceCents: number;
  readonly originalPriceCents?: number | null;
  readonly promotionType?: PromotionType;
  readonly promotionText?: string | null;
  readonly promotionRule?: PromotionRuleInput | null;
  readonly conditions?: string | null;
  readonly requiresLoyaltyCard?: boolean;
  readonly isPersonalized?: boolean;
  readonly channel?: OfferChannel;
  readonly minimumQuantity?: number;
  readonly depositCents?: number | null;
  readonly availability?: Availability;
  readonly startsAt?: Date | null;
  readonly endsAt?: Date | null;
  /** Wanneer de bron deze prijs voor het laatst bevestigde. Standaard `snapshot.observedAt`. */
  readonly observedAt?: Date;
  /** 0–1. Standaard 1 voor officiële bronnen, lager voor handmatige invoer. */
  readonly confidence?: number;
}

export interface AdapterSnapshot {
  readonly chain: AdapterChainInfo;
  readonly source: AdapterSourceInfo;
  /** Moment van de volledige controle. */
  readonly observedAt: Date;
  readonly locations: readonly NormalizedLocation[];
  readonly products: readonly NormalizedStoreProduct[];
  readonly offers: readonly NormalizedOffer[];
}

export interface AdapterLogger {
  log(message: string): void;
  warn(message: string): void;
}

export interface AdapterContext {
  readonly logger: AdapterLogger;
  /** Map met importbestanden (`COMPARE_FEED_DIR`). */
  readonly feedDir: string;
  /** Mogen adapters demogegevens leveren als er geen echte bron is? Nooit in productie. */
  readonly allowDemo: boolean;
  readonly now: Date;
  /**
   * Laatst aangeleverde feed voor deze adapter uit de database
   * (`POST /compare/internal/feeds/:chain`), als ruwe JSON. Optioneel: scripts
   * en tests zonder database laten hem weg.
   */
  readonly loadStoredFeed?: (adapterKey: string) => Promise<unknown | null>;
}

export interface SupermarketAdapter {
  /** Unieke sleutel, bv. "delhaize". Landt in `StoreChain.adapterKey`. */
  readonly key: string;
  readonly chain: AdapterChainInfo;
  /** De bron die deze adapter *zou* gebruiken. De werkelijke bron staat in de snapshot. */
  readonly source: AdapterSourceInfo;

  /**
   * Haalt de actuele stand op.
   *
   * Geeft `null` als er geen gegevens beschikbaar zijn (geen importbestand,
   * demo niet toegestaan, bron onbereikbaar). De importservice registreert dat
   * als een mislukte run; de app toont dan "geen gegevens van deze keten".
   */
  fetchSnapshot(context: AdapterContext): Promise<AdapterSnapshot | null>;
}

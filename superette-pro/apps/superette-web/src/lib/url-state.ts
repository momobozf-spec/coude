/**
 * Zoekfilters ↔ URL. De URL is de bron van waarheid voor de zoekpagina:
 * delen, terugknop en herladen werken dan vanzelf.
 */
import type { SearchQueryInput } from '@superette/contracts';
import { euroInputToCents, centsToEuroInput } from './format';

export const SEARCH_SORTS = ['UNIT_PRICE', 'PACKAGE_PRICE', 'DISCOUNT', 'STORE', 'RELEVANCE'] as const;
export type SearchSortValue = (typeof SEARCH_SORTS)[number];

export interface SearchFilters {
  q: string;
  chains: string[];
  category: string;
  brand: string;
  brandType: '' | 'NATIONAL_BRAND' | 'STORE_BRAND';
  onlyPromotions: boolean;
  loyaltyCard: 'ANY' | 'REQUIRED' | 'NOT_REQUIRED';
  unit: '' | 'KG' | 'L' | 'PIECE';
  availability: '' | 'IN_STOCK';
  /** Eurotekst zoals ingetikt ("5,00"); leeg = geen maximum. */
  maxPrice: string;
  includePersonalized: boolean;
  includeOnline: boolean;
  sort: SearchSortValue;
  page: number;
}

export const DEFAULT_FILTERS: SearchFilters = Object.freeze({
  q: '',
  chains: [],
  category: '',
  brand: '',
  brandType: '',
  onlyPromotions: false,
  loyaltyCard: 'ANY',
  unit: '',
  availability: '',
  maxPrice: '',
  includePersonalized: false,
  includeOnline: true,
  sort: 'UNIT_PRICE',
  page: 1,
});

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseSearchParams(params: URLSearchParams): SearchFilters {
  const page = Number(params.get('pagina') ?? '1');
  return {
    q: (params.get('q') ?? '').trim(),
    chains: (params.get('winkels') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => /^[a-z0-9-]{1,40}$/.test(v)),
    category: params.get('categorie') ?? '',
    brand: params.get('merk') ?? '',
    brandType: oneOf(params.get('merktype'), ['', 'NATIONAL_BRAND', 'STORE_BRAND'] as const, ''),
    onlyPromotions: params.get('promoties') === '1',
    loyaltyCard: oneOf(params.get('klantenkaart'), ['ANY', 'REQUIRED', 'NOT_REQUIRED'] as const, 'ANY'),
    unit: oneOf(params.get('eenheid'), ['', 'KG', 'L', 'PIECE'] as const, ''),
    availability: oneOf(params.get('voorraad'), ['', 'IN_STOCK'] as const, ''),
    maxPrice: params.get('maxprijs') ?? '',
    includePersonalized: params.get('persoonlijk') === '1',
    includeOnline: params.get('online') !== '0',
    sort: oneOf(params.get('sorteer'), SEARCH_SORTS, 'UNIT_PRICE'),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Alleen afwijkingen van de standaard komen in de URL: korte, leesbare links. */
export function serializeSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.chains.length > 0) params.set('winkels', filters.chains.join(','));
  if (filters.category) params.set('categorie', filters.category);
  if (filters.brand) params.set('merk', filters.brand);
  if (filters.brandType) params.set('merktype', filters.brandType);
  if (filters.onlyPromotions) params.set('promoties', '1');
  if (filters.loyaltyCard !== 'ANY') params.set('klantenkaart', filters.loyaltyCard);
  if (filters.unit) params.set('eenheid', filters.unit);
  if (filters.availability) params.set('voorraad', filters.availability);
  if (filters.maxPrice) params.set('maxprijs', filters.maxPrice);
  if (filters.includePersonalized) params.set('persoonlijk', '1');
  if (!filters.includeOnline) params.set('online', '0');
  if (filters.sort !== 'UNIT_PRICE') params.set('sorteer', filters.sort);
  if (filters.page > 1) params.set('pagina', String(filters.page));
  return params;
}

/** Wat naar `GET /compare/search` gaat. Bedragen als centen, lege filters weggelaten. */
export function toSearchQuery(filters: SearchFilters, pageSize = 20): SearchQueryInput {
  const maxPriceCents = euroInputToCents(filters.maxPrice);
  return {
    q: filters.q,
    chains: filters.chains,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.brand ? { brand: filters.brand } : {}),
    ...(filters.brandType ? { brandType: filters.brandType } : {}),
    onlyPromotions: filters.onlyPromotions,
    loyaltyCard: filters.loyaltyCard,
    ...(filters.unit ? { unit: filters.unit } : {}),
    ...(filters.availability ? { availability: filters.availability } : {}),
    ...(maxPriceCents !== null && maxPriceCents > 0 ? { maxPriceCents } : {}),
    includePersonalized: filters.includePersonalized,
    includeOnline: filters.includeOnline,
    sort: filters.sort,
    page: filters.page,
    pageSize,
  };
}

/** Aantal actieve filters (zonder zoekterm, sortering en pagina) voor het filterknopje. */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.chains.length > 0) count++;
  if (filters.category) count++;
  if (filters.brand) count++;
  if (filters.brandType) count++;
  if (filters.onlyPromotions) count++;
  if (filters.loyaltyCard !== 'ANY') count++;
  if (filters.unit) count++;
  if (filters.availability) count++;
  if (filters.maxPrice && euroInputToCents(filters.maxPrice) !== null) count++;
  if (filters.includePersonalized) count++;
  if (!filters.includeOnline) count++;
  return count;
}

export { centsToEuroInput };

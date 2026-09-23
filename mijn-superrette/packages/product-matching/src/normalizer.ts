import {
  type BaseQuantity,
  type Quantity,
  normalizeGtin,
  normalizeText,
  stripDiacritics,
} from '@superrette/shared';
import type { DietaryAttribute } from '@superrette/domain';
import { DEFAULT_DICTIONARY, type BrandEntry, type NormalizerDictionary } from './dictionary.js';
import { parseQuantity } from './quantity-parser.js';

export interface RawProductInput {
  title: string;
  brand?: string | null;
  quantityText?: string | null;
  gtins?: readonly string[] | null;
  categoryText?: string | null;
}

export interface NormalizedProduct {
  /** Valid, normalised GTINs only. Invalid codes are dropped, never guessed. */
  gtins: string[];
  invalidGtins: string[];
  brand: { slug: string; name: string; privateLabelOf: string | null } | null;
  /** Title with brand, quantity and packaging words removed. */
  name: string;
  /** Canonical tokens (synonyms resolved, stopwords removed), sorted. */
  tokens: string[];
  productType: string | null;
  categorySlug: string | null;
  variants: string[];
  flavours: string[];
  dietary: DietaryAttribute[];
  quantity: Quantity | null;
  packCount: number;
  netContent: BaseQuantity | null;
  soldByWeight: boolean;
  /** The quantity text that was recognised, e.g. "1,5l" (lower-cased, without accents). */
  quantitySource: string | null;
  /** Clothing/diaper style size such as "maat 4". */
  size: string | null;
  /** Deterministic key for blocking candidates: brand|type|variants|content. */
  signature: string;
}

interface CompiledSynonym {
  pattern: RegExp;
  token: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ProductNormalizer turns retailer-specific product text into a canonical,
 * comparable representation. It is deterministic and side-effect free so it
 * can run in the ingestion pipeline, the API and tests alike.
 */
export class ProductNormalizer {
  private readonly synonyms: CompiledSynonym[];
  private readonly brandAliases: { alias: string; pattern: RegExp; brand: BrandEntry }[];
  private readonly stopwords: Set<string>;

  constructor(private readonly dictionary: NormalizerDictionary = DEFAULT_DICTIONARY) {
    this.synonyms = Object.entries(dictionary.synonyms)
      .map(([phrase, token]) => [normalizeText(phrase), token] as const)
      .sort((a, b) => b[0].length - a[0].length)
      .map(([phrase, token]) => ({ pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, 'gu'), token }));
    this.brandAliases = dictionary.brands
      .flatMap((brand) => brand.aliases.map((alias) => ({ alias: normalizeText(alias), brand })))
      .sort((a, b) => b.alias.length - a.alias.length)
      .map(({ alias, brand }) => ({
        alias,
        brand,
        pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, 'u'),
      }));
    this.stopwords = new Set(dictionary.stopwords.map(normalizeText));
  }

  /** Resolve synonyms in free text and return canonical tokens (used for search queries too). */
  canonicalizeText(text: string): string[] {
    let normalized = ` ${normalizeText(text)} `;
    const found: string[] = [];
    for (const { pattern, token } of this.synonyms) {
      normalized = normalized.replace(pattern, () => {
        found.push(token);
        return ' ';
      });
    }
    const rest = normalized
      .split(' ')
      .filter((t) => t.length > 0 && !this.stopwords.has(t) && !/^\d+([.,]\d+)?$/.test(t));
    return [...new Set([...found, ...rest])];
  }

  detectBrand(title: string, explicitBrand?: string | null): NormalizedProduct['brand'] {
    const candidates = [explicitBrand, title].filter((s): s is string => Boolean(s && s.trim()));
    for (const text of candidates) {
      const normalized = normalizeText(text);
      // Titles usually start with the brand: prefer the earliest, then longest alias.
      let best: { index: number; length: number; brand: BrandEntry } | null = null;
      for (const { alias, pattern, brand } of this.brandAliases) {
        const match = pattern.exec(normalized);
        if (!match) continue;
        if (!best || match.index < best.index || (match.index === best.index && alias.length > best.length)) {
          best = { index: match.index, length: alias.length, brand };
        }
      }
      if (best) {
        return { slug: best.brand.slug, name: best.brand.name, privateLabelOf: best.brand.privateLabelOf ?? null };
      }
    }
    if (explicitBrand && explicitBrand.trim()) {
      const name = explicitBrand.trim();
      return { slug: normalizeText(name).replace(/\s+/g, '-'), name, privateLabelOf: null };
    }
    return null;
  }

  normalize(input: RawProductInput): NormalizedProduct {
    const gtins: string[] = [];
    const invalidGtins: string[] = [];
    for (const raw of input.gtins ?? []) {
      const g = normalizeGtin(raw);
      if (g) {
        if (!gtins.includes(g)) gtins.push(g);
      } else invalidGtins.push(raw);
    }

    const brand = this.detectBrand(input.title, input.brand);
    const parsed = parseQuantity(input.quantityText) ?? parseQuantity(input.title);

    let text = stripDiacritics(input.title).toLowerCase();
    if (parsed) text = text.replace(parsed.source, ' ');
    const sizeMatch = /\b(?:maat|taille|size)\s*(\d+\+?)/i.exec(text);
    // Remove remaining quantity expressions (e.g. duplicated "1,5L" or "1500 ml").
    text = text.replace(/\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*[a-z]+/g, ' ').replace(/\d+(?:[.,]\d+)?\s*(?:ml|cl|dl|l|ltr|liter|litre|g|gr|kg|gram|stuks?)\b/g, ' ');
    let nameText = normalizeText(text);
    if (brand) {
      for (const { alias, brand: b } of this.brandAliases) {
        if (b.slug === brand.slug) nameText = nameText.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, 'u'), ' ');
      }
    }
    // Brand names such as "Coca-Cola" also carry product meaning ("cola").
    const implied = this.dictionary.brands.find((b) => b.slug === brand?.slug)?.impliesTokens ?? [];
    const tokens = [...new Set([...this.canonicalizeText(nameText), ...implied])]
      .filter((t) => !(sizeMatch && t === sizeMatch[1]))
      .sort();

    const tokenSet = new Set(tokens);
    const productType = this.detectProductType(tokenSet);
    const variants = this.dictionary.variantTokens.filter((v) => tokenSet.has(v)).sort();
    const flavours = this.dictionary.flavourTokens.filter((f) => tokenSet.has(f)).sort();
    const dietary = [
      ...new Set(
        Object.entries(this.dictionary.dietary)
          .filter(([token]) => tokenSet.has(token))
          .map(([, attr]) => attr),
      ),
    ].sort();

    const name = nameText.replace(/\s+/g, ' ').trim();
    const categorySlug =
      this.dictionary.productTypes.find((t) => t.slug === productType)?.categorySlug ??
      (input.categoryText ? normalizeText(input.categoryText).replace(/\s+/g, '-') : null);

    const netContent = parsed?.netContent ?? null;
    const signature = [
      brand?.slug ?? '-',
      productType ?? '-',
      variants.join('+') || '-',
      flavours.join('+') || '-',
      netContent ? `${netContent.amount}${netContent.unit}` : '-',
    ].join('|');

    return {
      gtins,
      invalidGtins,
      brand,
      name,
      tokens,
      productType,
      categorySlug,
      variants,
      flavours,
      dietary,
      quantity: parsed?.perItem ?? null,
      packCount: parsed?.packCount ?? 1,
      netContent,
      soldByWeight: parsed?.soldByWeight ?? false,
      quantitySource: parsed && parsed.source !== 'per kg' && parsed.source !== 'per stuk' ? parsed.source : null,
      size: sizeMatch?.[1] ?? null,
      signature,
    };
  }

  private detectProductType(tokens: Set<string>): string | null {
    let best: { slug: string; specificity: number } | null = null;
    for (const type of this.dictionary.productTypes) {
      if (!type.requires.every((t) => tokens.has(t))) continue;
      if (type.excludes?.some((t) => tokens.has(t))) continue;
      if (!best || type.requires.length > best.specificity) best = { slug: type.slug, specificity: type.requires.length };
    }
    return best?.slug ?? null;
  }
}

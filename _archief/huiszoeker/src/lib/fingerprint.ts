/**
 * De derde ontdubbelingssleutel: dezelfde woning op twee verschillende sites.
 *
 * `source + externalId` en de genormaliseerde URL vangen duplicaten *binnen* een
 * bron. Voor duplicaten *tussen* bronnen is er geen gedeelde sleutel, dus
 * bouwen we er zelf een uit de eigenschappen die een woning identificeren.
 *
 * Bewust géén unique constraint in de database: twee identieke nieuwbouw-
 * appartementen in hetzelfde gebouw leveren legitiem dezelfde vingerafdruk op.
 * Een unique constraint zou daar een crash van maken. In plaats daarvan is het
 * een geïndexeerde hint waarmee de matching engine een tweede melding voor
 * feitelijk dezelfde woning kan onderdrukken.
 */
import { createHash } from "node:crypto";
import type { PropertyListing } from "../schemas/property.js";

/** Ruwe adressen verschillen per site in interpunctie en afkortingen. */
function normalizeAddressPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(straat|str\.?|laan|ln\.?|steenweg|stwg\.?|avenue|ave\.?|rue|chaussee)\b/g, (m) => m[0] ?? m)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Prijs en oppervlakte worden afgerond naar buckets. Een site die €449.500
 * toont en een andere die €450.000 toont beschrijven hetzelfde pand; een exacte
 * match zou dat missen.
 */
function bucket(value: number | undefined, size: number): string {
  if (value === undefined) return "";
  return String(Math.round(value / size) * size);
}

export function computeFingerprint(listing: {
  address?: string;
  postalCode?: string;
  city?: string;
  price?: number;
  livingAreaM2?: number;
  propertyType?: string;
  transactionType?: string;
}): string {
  const parts = [
    listing.address ? normalizeAddressPart(listing.address) : "",
    listing.postalCode ?? "",
    listing.city ? normalizeAddressPart(listing.city) : "",
    bucket(listing.price, 5_000),
    bucket(listing.livingAreaM2, 5),
    listing.propertyType ?? "",
    listing.transactionType ?? "buy",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function fingerprintForListing(listing: PropertyListing): string {
  return computeFingerprint({
    address: listing.address,
    postalCode: listing.postalCode,
    city: listing.city,
    price: listing.price,
    livingAreaM2: listing.livingAreaM2,
    propertyType: listing.propertyType,
    transactionType: listing.transactionType,
  });
}

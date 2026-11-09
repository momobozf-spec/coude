/**
 * Prisma → domeinneutrale referentiedata.
 *
 * Dit is de enige plek waar de halal-engine en Prisma elkaar raken. De engine
 * zelf importeert geen enkel Prisma-type; hij krijgt gewone objecten. Daardoor
 * is de engine te testen zonder database én is de referentiebron vervangbaar
 * (een cache, een fixture, later eventueel een read-replica) zonder dat er één
 * regel beslislogica verandert.
 *
 * N+1 is hier het gevaar: bij honderd ingrediënten op een etiket zou een naïeve
 * implementatie honderd keer de aliassen ophalen. Daarom drie queries voor
 * álles — ingrediënten mét aliassen en bron in één `include`, E-nummers idem,
 * en de certificaten van het product apart. Meer worden het er niet, ongeacht
 * hoe lang het etiket is.
 */
import type { Certificate, CertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CertificateEvidence, SourceReference } from "@/types/halal";
import type { HalalReference, ReferenceLoader } from "@/server/halal/engine/evidence";
import type { ENumberReference, IngredientReference } from "@/server/halal/engine/types";

type Db = typeof prisma;

/**
 * De referentietabel is een zorgvuldig samengestelde lijst van enkele honderden
 * records die alleen verandert bij een seed of een beheeractie — geen
 * gebruikersdata. Hem één keer per proces inladen scheelt bij elke scan drie
 * queries. De TTL is er zodat een beheerwijziging binnen redelijke tijd
 * doorwerkt zonder herstart.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  reference: HalalReference;
  loadedAt: number;
}

let cache: CacheEntry | undefined;

/** Alleen voor tests en voor een beheeractie die de referentiedata wijzigt. */
export function invalidateReferenceCache(): void {
  cache = undefined;
}

function toSourceReference(source: {
  id: string;
  name: string;
  organization: string;
  url: string | null;
  sourceType: SourceReference["sourceType"];
  lastVerifiedAt: Date | null;
} | null): SourceReference | null {
  if (!source) return null;
  return {
    id: source.id,
    name: source.name,
    organization: source.organization,
    url: source.url,
    sourceType: source.sourceType,
    // Een interne heuristiek is geen externe autoriteit. Dat onderscheid moet
    // tot in de UI zichtbaar blijven, dus het reist mee als eigen veld.
    isInternal: source.sourceType === "INTERNAL_RULE",
    lastVerifiedAt: source.lastVerifiedAt?.toISOString() ?? null,
  };
}

export class PrismaReferenceLoader implements ReferenceLoader {
  constructor(private readonly db: Db = prisma) {}

  async load(): Promise<HalalReference> {
    if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
      return cache.reference;
    }

    // Twee queries voor de hele referentietabel, ongeacht het aantal
    // ingrediënten op het etiket.
    const [ingredientRows, eNumberRows] = await Promise.all([
      this.db.ingredient.findMany({
        include: {
          aliases: { select: { alias: true } },
          eNumber: { select: { code: true } },
          sources: {
            include: { source: true },
            orderBy: { retrievedAt: "desc" },
            take: 1,
          },
        },
      }),
      this.db.eNumber.findMany({
        include: {
          sources: {
            include: { source: true },
            orderBy: { retrievedAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    const ingredients: IngredientReference[] = ingredientRows.map((row) => ({
      id: row.id,
      name: row.name,
      normalizedName: row.normalizedName,
      defaultStatus: row.defaultStatus,
      defaultConfidence: row.defaultConfidence,
      originRisk: row.originRisk,
      eNumberCode: row.eNumber?.code ?? null,
      aliases: row.aliases.map((alias) => alias.alias),
      source: toSourceReference(row.sources[0]?.source ?? null),
    }));

    const eNumbers: ENumberReference[] = eNumberRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      defaultStatus: row.defaultStatus,
      defaultConfidence: row.defaultConfidence,
      originRisk: row.originRisk,
      animalDerivedPossible: row.animalDerivedPossible,
      plantDerivedPossible: row.plantDerivedPossible,
      syntheticPossible: row.syntheticPossible,
      source: toSourceReference(row.sources[0]?.source ?? null),
    }));

    const reference: HalalReference = { ingredients, eNumbers };
    cache = { reference, loadedAt: Date.now() };
    return reference;
  }
}

/**
 * Is dit certificaat op dit moment geldig bewijs?
 *
 * §4 van de beslisboom, letterlijk: alleen `VERIFIED` én niet verlopen telt.
 * Alle andere toestanden — `PENDING`, `COMMUNITY_REVIEWED`, `REJECTED`,
 * `EXPIRED`, of `VERIFIED` maar over de datum — leveren géén positieve
 * bewijskracht. Ze reizen wél mee naar de UI, zodat die "in verificatie" of
 * "verlopen" kan tonen in plaats van niets.
 */
export function isActiveCertificate(
  status: CertificateStatus,
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (status !== "VERIFIED") return false;
  if (expiresAt === null) return true;
  return expiresAt.getTime() >= now.getTime();
}

type CertificateWithBody = Certificate & {
  certificationBody: { name: string; official: boolean };
};

export function toCertificateEvidence(
  certificate: CertificateWithBody,
  now: Date,
): CertificateEvidence {
  return {
    certificateId: certificate.id,
    certificateNumber: certificate.certificateNumber,
    certificationBodyName: certificate.certificationBody.name,
    certificationBodyOfficial: certificate.certificationBody.official,
    issuedAt: certificate.issuedAt?.toISOString() ?? null,
    expiresAt: certificate.expiresAt?.toISOString() ?? null,
    isActive: isActiveCertificate(certificate.status, certificate.expiresAt, now),
    status: certificate.status,
  };
}

/**
 * Certificaten van dit product. Eén query, met de instantie erbij zodat de
 * naam niet per certificaat opnieuw opgehaald hoeft te worden.
 */
export async function loadCertificateEvidence(
  productId: string,
  now: Date,
  db: Db = prisma,
): Promise<CertificateEvidence[]> {
  const rows = await db.certificate.findMany({
    where: { productId },
    include: { certificationBody: { select: { name: true, official: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => toCertificateEvidence(row, now));
}

export const referenceLoader = new PrismaReferenceLoader();

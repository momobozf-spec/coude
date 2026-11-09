/**
 * Beoordeelde productparen in één keer in de database zetten.
 *
 *   npm run match:apply                                      (standaardbestand)
 *   npm run match:apply -- data/matches/review-2026-10-07.json
 *
 * Het bestand bevat per paar twee producten (keten + productcode zoals in de
 * importbestanden) en een beslissing:
 *   z = zelfde product          → EQUIVALENT, bevestigd
 *   a = vergelijkbaar alternatief → ALTERNATIVE, bevestigd
 *   n = niet hetzelfde          → afgewezen (wordt nooit meer voorgesteld)
 *
 * Beide richtingen worden opgeslagen, net zoals `match:review` doet. Een
 * eerdere beslissing voor hetzelfde paar wordt overschreven. Producten die
 * (nog) niet in de database staan, worden gemeld en overgeslagen.
 *
 * Het bestand is gewoon JSON: open het, pas een letter aan, draai opnieuw.
 */
import './load-env';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const side = z.object({ chain: z.string().min(1), externalId: z.string().min(1), label: z.string().optional() });
const fileSchema = z.object({
  reviewedBy: z.string().optional(),
  pairs: z.array(z.object({ decision: z.enum(['z', 'a', 'n']), a: side, b: side })).min(1),
});

const DATA = {
  z: { matchType: 'EQUIVALENT' as const, status: 'CONFIRMED' as const, confidence: 1, reason: 'Zelfde product, bevestigd bij beoordeling' },
  a: { matchType: 'ALTERNATIVE' as const, status: 'CONFIRMED' as const, confidence: 0.9, reason: 'Alternatief, bevestigd bij beoordeling' },
  n: { matchType: 'UNCERTAIN' as const, status: 'REJECTED' as const, confidence: 0, reason: 'Afgewezen bij beoordeling' },
};

async function main() {
  const apiRoot = resolve(__dirname, '..');
  const file = resolve(apiRoot, process.argv[2] ?? 'data/matches/review-2026-10-07.json');
  const parsed = fileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  console.log(`\n${parsed.pairs.length} paren uit ${file}${parsed.reviewedBy ? ` (beoordeeld door ${parsed.reviewedBy})` : ''}`);

  const cache = new Map<string, string | null>();
  const productId = async (chain: string, externalId: string) => {
    const key = `${chain}|${externalId}`;
    if (!cache.has(key)) {
      const row = await prisma.storeProduct.findFirst({
        where: { externalId, storeChain: { slug: chain } },
        select: { catalogProductId: true },
      });
      cache.set(key, row?.catalogProductId ?? null);
    }
    return cache.get(key)!;
  };

  const counts = { z: 0, a: 0, n: 0, missing: 0, same: 0 };
  for (const pair of parsed.pairs) {
    const left = await productId(pair.a.chain, pair.a.externalId);
    const right = await productId(pair.b.chain, pair.b.externalId);
    if (!left || !right) {
      counts.missing += 1;
      console.log(`  ? niet in de database: ${pair.a.label ?? `${pair.a.chain}:${pair.a.externalId}`} ↔ ${pair.b.label ?? `${pair.b.chain}:${pair.b.externalId}`}`);
      continue;
    }
    if (left === right) {
      // Al samengevoegd tot één catalogusproduct (bv. via barcode): niets te doen.
      counts.same += 1;
      continue;
    }
    const data = DATA[pair.decision];
    for (const [from, to] of [
      [left, right],
      [right, left],
    ] as const) {
      await prisma.productMatch.upsert({
        where: { productId_relatedProductId: { productId: from, relatedProductId: to } },
        create: { productId: from, relatedProductId: to, ...data },
        update: data,
      });
    }
    counts[pair.decision] += 1;
    if (pair.decision !== 'n') console.log(`  ✔ ${pair.decision} · ${pair.a.label ?? pair.a.externalId} ↔ ${pair.b.label ?? pair.b.externalId}`);
  }

  console.log(
    `\nKlaar: ${counts.z} zelfde product · ${counts.a} alternatief · ${counts.n} afgewezen · ` +
      `${counts.missing} niet gevonden · ${counts.same} al hetzelfde catalogusproduct.\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Kandidaat-matches tussen ketens laten bevestigen door een mens.
 *
 *   npm run match:review            (standaard 30 kandidaten per sessie)
 *   npm run match:review -- 100     (meer per sessie)
 *
 * Waarom: geen enkele keten toont een EAN, dus de automatische matcher kan
 * alleen op naam vergelijken. Nederlandse samenstellingen ("Kippenborstfilet"
 * vs "Kipfilet") en andere schrijfwijzen ("COCA-COLA Frisdrank" vs
 * "Coca-Cola Original taste") vallen daardoor buiten de boot. Dit script zoekt
 * zelf kandidaten tussen VERSCHILLENDE ketens, ook op lettergroepen, en laat
 * jou per paar beslissen:
 *
 *   z = zelfde product          → EQUIVALENT, bevestigd
 *   a = vergelijkbaar alternatief → ALTERNATIVE, bevestigd
 *   n = niet hetzelfde          → afgewezen (wordt nooit meer voorgesteld)
 *   s = overslaan (later opnieuw)
 *   q = stoppen
 *
 * Alleen wat jij bevestigt, toont de app als vergelijking. Niets gebeurt
 * automatisch. Bestaande bevestigingen en afwijzingen worden gerespecteerd.
 */
import './load-env';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SESSION_LIMIT = Number(process.argv[2] ?? 30);
const MIN_SCORE = 0.35;

/** Lettergroepen van drie, zonder spaties: "kip filet" → kip, ipf, pfi, fil, ile, let. */
function trigrams(text: string): Set<string> {
  const s = text.replace(/\s+/g, '');
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i += 1) grams.add(s.slice(i, i + 3));
  return grams;
}

/** Dice-gelijkenis op lettergroepen: vangt samenstellingen ("kippenborstfilet" ↔ "kipfilet"). */
function charSimilarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared += 1;
  return (2 * shared) / (ga.size + gb.size);
}

/** Jaccard op hele woorden. */
function wordSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

const euro = (cents: number) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

async function main() {
  const products = await prisma.catalogProduct.findMany({
    where: { active: true, normalizedUnit: { not: null }, normalizedQuantity: { not: null } },
    select: {
      id: true,
      name: true,
      brand: true,
      normalizedName: true,
      normalizedBrand: true,
      normalizedQuantity: true,
      normalizedUnit: true,
      packageQuantity: true,
      packageUnit: true,
      packCount: true,
      storeProducts: {
        where: { active: true },
        select: {
          storeChain: { select: { slug: true } },
          offers: { where: { active: true }, select: { priceCents: true, requiresLoyaltyCard: true }, orderBy: { priceCents: 'asc' }, take: 1 },
        },
      },
    },
  });

  // Wat een mens al besliste, stellen we niet opnieuw voor.
  const decided = await prisma.productMatch.findMany({
    where: { status: { in: ['CONFIRMED', 'REJECTED'] } },
    select: { productId: true, relatedProductId: true },
  });
  const decidedKey = new Set(decided.map((m) => `${m.productId}|${m.relatedProductId}`));

  const chainsOf = (p: (typeof products)[number]) => [...new Set(p.storeProducts.map((sp) => sp.storeChain.slug))].sort();

  type Candidate = { a: (typeof products)[number]; b: (typeof products)[number]; score: number };
  const candidates: Candidate[] = [];
  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      const a = products[i]!;
      const b = products[j]!;
      if (a.normalizedUnit !== b.normalizedUnit) continue;
      const ca = chainsOf(a);
      const cb = chainsOf(b);
      // Alleen tussen verschillende ketens: daar zit de vergelijking.
      if (ca.length === 0 || cb.length === 0 || ca.some((c) => cb.includes(c))) continue;
      if (decidedKey.has(`${a.id}|${b.id}`) || decidedKey.has(`${b.id}|${a.id}`)) continue;
      // Een blikje naast een vat is geen kandidaat (factor 5 marge).
      const ratio = a.normalizedQuantity! / b.normalizedQuantity!;
      if (ratio < 0.2 || ratio > 5) continue;

      // Met én zonder merk: een huismerk ("Delhaize kipfilet") mag een
      // merkloze naam ("kippenborstfilet") niet wegdrukken.
      const nameA = [a.normalizedBrand, a.normalizedName].filter(Boolean).join(' ');
      const nameB = [b.normalizedBrand, b.normalizedName].filter(Boolean).join(' ');
      const score = Math.max(
        wordSimilarity(nameA, nameB),
        charSimilarity(nameA, nameB),
        wordSimilarity(a.normalizedName, b.normalizedName),
        charSimilarity(a.normalizedName, b.normalizedName),
      );
      if (score >= MIN_SCORE) candidates.push({ a, b, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  console.log(`\n${candidates.length} kandidaat-paren tussen ketens gevonden (score ≥ ${MIN_SCORE}). We tonen er maximaal ${SESSION_LIMIT}.\n`);
  if (candidates.length === 0) return;

  const describe = (p: (typeof products)[number]) => {
    const pack = `${p.packCount > 1 ? `${p.packCount} x ` : ''}${p.packageQuantity ?? '?'} ${p.packageUnit ?? ''}`.trim();
    const prices = p.storeProducts
      .map((sp) => {
        const offer = sp.offers[0];
        return `${sp.storeChain.slug}: ${offer ? `${euro(offer.priceCents)}${offer.requiresLoyaltyCard ? ' (klantenkaart)' : ''}` : 'geen actieve prijs'}`;
      })
      .join(' · ');
    return `${p.brand ? `${p.brand} — ` : ''}${p.name} (${pack}) · ${prices}`;
  };

  const rl = createInterface({ input: stdin, output: stdout });
  const counts = { z: 0, a: 0, n: 0, s: 0 };
  try {
    for (const [index, { a, b, score }] of candidates.slice(0, SESSION_LIMIT).entries()) {
      console.log(`\n[${index + 1}/${Math.min(SESSION_LIMIT, candidates.length)}] gelijkenis ${(score * 100).toFixed(0)}%`);
      console.log(`  1) ${describe(a)}`);
      console.log(`  2) ${describe(b)}`);

      let answer = '';
      while (!['z', 'a', 'n', 's', 'q'].includes(answer)) {
        answer = (await rl.question('  z = zelfde product · a = alternatief · n = niet hetzelfde · s = overslaan · q = stoppen > ')).trim().toLowerCase();
      }
      if (answer === 'q') break;
      counts[answer as 'z' | 'a' | 'n' | 's'] += 1;
      if (answer === 's') continue;

      const data =
        answer === 'n'
          ? { matchType: 'UNCERTAIN' as const, status: 'REJECTED' as const, confidence: 0, reason: 'Afgewezen door beheerder' }
          : answer === 'z'
            ? { matchType: 'EQUIVALENT' as const, status: 'CONFIRMED' as const, confidence: 1, reason: 'Zelfde product, bevestigd door beheerder' }
            : { matchType: 'ALTERNATIVE' as const, status: 'CONFIRMED' as const, confidence: 0.9, reason: 'Alternatief, bevestigd door beheerder' };

      // Beide richtingen, zoals de import ze ook bewaart.
      for (const [productId, relatedProductId] of [
        [a.id, b.id],
        [b.id, a.id],
      ] as const) {
        await prisma.productMatch.upsert({
          where: { productId_relatedProductId: { productId, relatedProductId } },
          create: { productId, relatedProductId, ...data },
          update: data,
        });
      }
      console.log(answer === 'n' ? '  ✖ afgewezen' : '  ✔ bevestigd');
    }
  } finally {
    rl.close();
  }

  console.log(`\nKlaar: ${counts.z} zelfde product · ${counts.a} alternatief · ${counts.n} afgewezen · ${counts.s} overgeslagen.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

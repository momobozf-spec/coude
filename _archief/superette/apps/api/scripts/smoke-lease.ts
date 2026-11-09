/**
 * Integratietest voor de databaselease van de synchronisatie (`JobLeaseService`),
 * rechtstreeks tegen de database — géén draaiende API nodig.
 *
 *   DATABASE_URL=… npx tsx scripts/smoke-lease.ts
 *
 * Dekt: verwerven, tweede houder geweigerd, heartbeat alleen door de houder,
 * verlopen lease overgenomen door een ander (gecrashte run), release door een
 * niet-houder heeft geen effect, release door de houder geeft vrij.
 */
import { PrismaClient } from '@prisma/client';
import { JobLeaseService } from '../src/compare/jobs/job-lease.service';

const NAME = 'smoke-lease-test';
let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}\n      verwacht: ${JSON.stringify(expected)}\n      kreeg:    ${JSON.stringify(actual)}`);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  // De service gebruikt alleen `prisma.jobLease`; de Nest-container is niet nodig.
  const leases = new JobLeaseService(prisma as never);
  await prisma.jobLease.deleteMany({ where: { name: NAME } });

  const a = JobLeaseService.newHolderId();
  const b = JobLeaseService.newHolderId();
  const now = new Date();

  console.log('\nLease: verwerven en weigeren');
  check('A verwerft een vrije lease', await leases.acquire(NAME, a, 60_000, now), true);
  check('B wordt geweigerd zolang A de lease houdt', await leases.acquire(NAME, b, 60_000, now), false);
  check('A kan zijn eigen lease opnieuw verwerven (idempotent)', await leases.acquire(NAME, a, 60_000, now), true);
  check('heartbeat door A lukt', await leases.renew(NAME, a, 60_000, now), true);
  check('heartbeat door B lukt niet', await leases.renew(NAME, b, 60_000, now), false);
  const current = await leases.current(NAME);
  check('huidige houder is A', current?.holder, a);

  console.log('\nLease: verlopen (gecrashte houder)');
  const later = new Date(now.getTime() + 61_000);
  check('B neemt een verlopen lease over', await leases.acquire(NAME, b, 60_000, later), true);
  check('A verliest zijn heartbeat na de overname', await leases.renew(NAME, a, 60_000, later), false);
  check('A kan de lease niet meer verwerven', await leases.acquire(NAME, a, 60_000, later), false);

  console.log('\nLease: vrijgeven');
  await leases.release(NAME, a);
  check('release door niet-houder A verandert niets', ((await leases.current(NAME))?.expiresAt.getTime() ?? 0) > later.getTime(), true);
  await leases.release(NAME, b);
  const released = await leases.current(NAME);
  check('release door houder B laat de lease verlopen', (released?.expiresAt.getTime() ?? 1) <= Date.now(), true);
  check('daarna kan A meteen opnieuw verwerven', await leases.acquire(NAME, a, 60_000, new Date()), true);

  console.log('\nLease: gelijktijdige verwerving (10 houders, één wint)');
  await leases.release(NAME, a);
  const holders = Array.from({ length: 10 }, () => JobLeaseService.newHolderId());
  const at = new Date();
  const results = await Promise.all(holders.map((holder) => leases.acquire(NAME, holder, 60_000, at)));
  check('precies één houder krijgt de lease', results.filter(Boolean).length, 1);

  await prisma.jobLease.deleteMany({ where: { name: NAME } });
  await prisma.$disconnect();
  console.log(`\n${passed} geslaagd, ${failed} mislukt\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

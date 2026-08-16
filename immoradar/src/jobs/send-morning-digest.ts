/**
 * Job: send the morning opportunity brief to every agency with digests
 * enabled. Schedule with cron at each agency's preferred hour, e.g.:
 *   0 * * * *  npm run jobs:digest        (the service dedupes per day and
 *                                          respects Agency.digestHourLocal)
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { DigestService } from "@/services/digest-service";

async function main() {
  const force = process.argv.includes("--force");
  const hourBrussels = parseInt(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Brussels" })
      .format(new Date()),
    10,
  );

  const agencies = await prisma.agency.findMany({
    where: { digestEnabled: true },
    select: { id: true, slug: true, digestHourLocal: true },
  });
  const digest = new DigestService(prisma);

  for (const agency of agencies) {
    if (!force && agency.digestHourLocal !== hourBrussels) continue;
    const sent = await digest.sendMorningBrief(agency.id);
    logger.info("job.digest.agency", { agency: agency.slug, sent });
  }
}

main()
  .catch((err) => {
    logger.error("job.digest.failed", { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

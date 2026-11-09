/**
 * Het startpunt van de HTTP-server.
 *
 * Alleen opstarten en netjes afsluiten. Een SIGTERM tijdens een deploy moet de
 * lopende verzoeken laten aflopen en de databaseconnecties sluiten, anders
 * blijven er bij elke deploy verbindingen hangen.
 */
import { buildApp } from "./api/app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { disconnectPrisma } from "./db/prisma.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Afsluiten");
    try {
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    } catch (e) {
      logger.error({ err: e }, "Afsluiten mislukt");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(
    { port: env.PORT, host: env.HOST, aiEnabled: env.AI_ENABLED, sources: env.SCRAPER_ENABLED_SOURCES },
    "Huiszoeker draait",
  );
}

main().catch((e: unknown) => {
  logger.error({ err: e }, "Opstarten mislukt");
  process.exit(1);
});

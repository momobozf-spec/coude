/**
 * Bouwt de Fastify-applicatie.
 *
 * Losgetrokken van `server.ts` zodat tests de app in het geheugen kunnen
 * starten (`app.inject`) zonder een poort te openen of een signaalhandler te
 * registreren.
 */
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../db/prisma.js";
import { createRepositories, type Repositories } from "../db/repositories/index.js";
import { SearchService, type SearchExecutor } from "../services/searchService.js";
import { SearchRunner } from "../services/searchRunner.js";
import { getSourceRegistry } from "../sources/registry.js";
import { registerAuth } from "./middleware/auth.js";
import { registerErrorHandler, buildErrorBody } from "./middleware/errorHandler.js";
import { registerSearchRoutes } from "./routes/searches.js";
import { registerHealthRoutes } from "./routes/health.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AiProvider } from "../types/ai.js";

export interface BuildAppOptions {
  repositories?: Repositories;
  prismaClient?: PrismaClient;
  executor?: SearchExecutor;
  aiProvider?: AiProvider;
  workerId?: string;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const repositories = options.repositories ?? createRepositories();
  const client = options.prismaClient ?? prisma;

  // Expliciet als `FastifyBaseLogger` doorgeven. Zonder die annotatie leidt
  // Fastify het instantietype af uit het concrete Pino-type, en dan past de
  // instantie niet meer op de `FastifyInstance` die de register-functies
  // verwachten — een typefout die niets met de logging zelf te maken heeft.
  const baseLogger: FastifyBaseLogger = logger;

  const app = Fastify({
    loggerInstance: baseLogger,
    // Een binnenkomende x-request-id wordt overgenomen zodat een trace over
    // meerdere services heen aan elkaar te knopen is; anders een eigen uuid.
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      const value = Array.isArray(header) ? header[0] : header;
      return value && value.length <= 128 ? value : randomUUID();
    },
    // Zonder deze grens is een 50 MB JSON-body een gratis geheugenaanval.
    bodyLimit: 256 * 1024,
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: false });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_PER_MINUTE,
    timeWindow: "1 minute",
    // De limiet geldt niet voor de probes: een readiness-check die 429 krijgt
    // laat een gezonde instantie uit de load balancer vallen.
    allowList: (req) => req.url === "/health" || req.url === "/ready",
    errorResponseBuilder: (req, context) =>
      buildErrorBody(
        "RATE_LIMITED",
        `Te veel verzoeken. Probeer het over ${context.after} opnieuw.`,
        req.id,
      ),
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  registerErrorHandler(app);
  registerAuth(app, repositories.users);

  const executor =
    options.executor ??
    new SearchRunner({
      registry: getSourceRegistry(),
      properties: repositories.properties,
      matches: repositories.matches,
      logger,
      maxResultsPerSource: env.SCRAPER_MAX_RESULTS_PER_RUN,
    });

  const searchService = new SearchService({
    searches: repositories.searches,
    searchRuns: repositories.searchRuns,
    executor,
    logger,
    lockTtlMinutes: env.SEARCH_LOCK_TTL_MINUTES,
    workerId: options.workerId ?? `api-${process.pid}`,
    aiProvider: options.aiProvider,
  });

  registerHealthRoutes(app, client);
  registerSearchRoutes(app, searchService);

  return app;
}

/**
 * Twee endpoints met een bewust verschil.
 *
 *   /health — draait het proces? Raakt niets externs, faalt nooit door een
 *             trage database. Dit is wat een orchestrator gebruikt om te
 *             beslissen of hij de container moet herstarten.
 *   /ready  — kan dit proces verkeer aan? Controleert de database en de
 *             configuratie. Dit is wat een load balancer gebruikt.
 *
 * Ze samenvoegen betekent dat een korte databasehapering je container laat
 * herstarten, wat de hapering verergert.
 */
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { getSourceRegistry } from "../../sources/registry.js";

export function registerHealthRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({ data: { status: "ok", uptimeSeconds: Math.round(process.uptime()) }, meta: {} });
  });

  app.get("/ready", async (request, reply) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (e) {
      checks.database = { ok: false, detail: (e as Error).message.slice(0, 200) };
    }

    checks.ai = env.AI_ENABLED
      ? { ok: true, detail: `${env.AI_PROVIDER}` }
      : { ok: true, detail: "uitgeschakeld (AI_ENABLED=false)" };

    const registry = getSourceRegistry();
    const unknown = registry.unknownEnabledNames();
    checks.sources =
      unknown.length === 0
        ? { ok: true, detail: env.SCRAPER_ENABLED_SOURCES.join(",") }
        : { ok: false, detail: `onbekende bronnen in SCRAPER_ENABLED_SOURCES: ${unknown.join(",")}` };

    const ok = Object.values(checks).every((c) => c.ok);
    return reply.code(ok ? 200 : 503).send({ data: { status: ok ? "ready" : "degraded", checks }, meta: { requestId: request.id } });
  });
}

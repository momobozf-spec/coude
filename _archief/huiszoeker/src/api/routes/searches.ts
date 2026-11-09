/**
 * REST-endpoints voor zoekopdrachten.
 *
 * De handlers doen drie dingen: valideren, de service aanroepen, presenteren.
 * Er zit geen businesslogica in — die staat in `SearchService`, zodat de CLI en
 * de scheduler dezelfde regels volgen zonder over HTTP te gaan.
 */
import type { FastifyInstance } from "fastify";
import {
  createSearchBodySchema,
  idParamSchema,
  listQuerySchema,
  parseSearchBodySchema,
  runQuerySchema,
  updateSearchBodySchema,
} from "../../schemas/api.js";
import type { SearchService } from "../../services/searchService.js";
import { requireUser } from "../middleware/auth.js";
import { toSearchDto } from "../presenters.js";

export function registerSearchRoutes(app: FastifyInstance, searchService: SearchService): void {
  /** Vrije tekst → criteria, zonder op te slaan. Handig als preview in een UI. */
  app.post("/api/searches/parse", async (request, reply) => {
    requireUser(request);
    const body = parseSearchBodySchema.parse(request.body);
    const result = await searchService.parse(body.query);
    return reply.code(200).send({
      data: { criteria: result.criteria },
      meta: { criteriaVersion: result.criteriaVersion, parsedBy: result.parsedBy, requestId: request.id },
    });
  });

  app.post("/api/searches", async (request, reply) => {
    const user = requireUser(request);
    const body = createSearchBodySchema.parse(request.body);
    const search = await searchService.create(user.userId, body);
    return reply.code(201).send({ data: toSearchDto(search), meta: { requestId: request.id } });
  });

  app.get("/api/searches", async (request, reply) => {
    const user = requireUser(request);
    const query = listQuerySchema.parse(request.query);
    const { items, total } = await searchService.list(user.userId, {
      activeOnly: query.active === true,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.code(200).send({
      data: items.map(toSearchDto),
      meta: { total, limit: query.limit, offset: query.offset, requestId: request.id },
    });
  });

  app.get("/api/searches/:id", async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParamSchema.parse(request.params);
    const search = await searchService.get(id, user.userId);
    return reply.code(200).send({ data: toSearchDto(search), meta: { requestId: request.id } });
  });

  app.patch("/api/searches/:id", async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParamSchema.parse(request.params);
    const body = updateSearchBodySchema.parse(request.body);
    const search = await searchService.update(id, user.userId, body);
    return reply.code(200).send({ data: toSearchDto(search), meta: { requestId: request.id } });
  });

  app.delete("/api/searches/:id", async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParamSchema.parse(request.params);
    await searchService.delete(id, user.userId);
    return reply.code(204).send();
  });

  /**
   * Handmatig starten. 409 wanneer de zoekopdracht al draait: dat is geen fout
   * van de client maar een toestand van de server, en de client moet het
   * verschil kunnen zien met "gestart".
   */
  app.post("/api/searches/:id/run", async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParamSchema.parse(request.params);
    const query = runQuerySchema.parse(request.query ?? {});

    const result = await searchService.run(id, user.userId, { force: query.force });

    if (!result.started) {
      const code = result.reason === "locked" ? "SEARCH_ALREADY_RUNNING" : "SEARCH_INACTIVE";
      const message =
        result.reason === "locked"
          ? "Deze zoekopdracht draait al"
          : "Deze zoekopdracht staat uit; activeer hem of gebruik ?force=true";
      return reply.code(409).send({ error: { code, message, requestId: request.id } });
    }

    return reply.code(202).send({
      data: { runId: result.runId, totals: result.totals },
      meta: { requestId: request.id },
    });
  });
}

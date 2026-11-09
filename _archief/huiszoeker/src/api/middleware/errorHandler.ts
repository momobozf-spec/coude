/**
 * Centrale foutafhandeling.
 *
 * De regel: alleen een `AppError` bepaalt zelf wat de client ziet. Alles
 * anders — een Prisma-fout, een TypeError, een kapotte JSON-body — wordt een
 * generieke 500 met een request-id. De volledige fout gaat wél de logs in.
 *
 * Zonder deze scheiding lekt vroeg of laat een databasestructuur of een
 * bestandspad naar buiten, en dan gebeurt dat op de plek waar iemand vergat een
 * try/catch te schrijven. Nu is vergeten onmogelijk.
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { isAppError } from "../../lib/errors.js";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export function buildErrorBody(
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): ErrorBody {
  return { error: { code, message, requestId, ...(details !== undefined ? { details } : {}) } };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(buildErrorBody("NOT_FOUND", "Deze route bestaat niet", request.id));
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    if (isAppError(error)) {
      // Verwachte fout: op info-niveau, want dit is normaal verkeer.
      request.log.info(
        { err: { code: error.code, message: error.message }, statusCode: error.statusCode },
        "Verzoek afgewezen",
      );
      reply
        .code(error.statusCode)
        .send(buildErrorBody(error.code, error.message, requestId, error.details));
      return;
    }

    if (error instanceof ZodError) {
      reply.code(400).send(
        buildErrorBody("VALIDATION_ERROR", "De invoer is ongeldig", requestId, {
          issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        }),
      );
      return;
    }

    // Fastify's eigen 4xx (kapotte JSON, te grote body, rate limit): de
    // statuscode is bruikbaar, de boodschap ook.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      request.log.info({ err: error, statusCode: error.statusCode }, "Verzoek afgewezen");
      reply
        .code(error.statusCode)
        .send(buildErrorBody(error.code ?? "BAD_REQUEST", error.message, requestId));
      return;
    }

    // Alles wat hier komt is onverwacht. Volledig loggen, niets doorgeven.
    request.log.error({ err: error }, "Onverwachte fout");
    reply
      .code(500)
      .send(
        buildErrorBody(
          "INTERNAL_ERROR",
          "Er ging iets mis. Vermeld het request-id wanneer je dit meldt.",
          requestId,
        ),
      );
  });
}

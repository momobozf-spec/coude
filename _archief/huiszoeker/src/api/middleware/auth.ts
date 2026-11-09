/**
 * Authenticatie — voor v1 één ontwikkelgebruiker.
 *
 * De enige plek in de applicatie die weet dat er nog geen echte login is. De
 * gebruiker wordt opgezocht (of aangemaakt) op basis van `DEFAULT_USER_EMAIL`
 * en in `request.userContext` gezet. Vervangen door echte auth betekent: de
 * body van `resolveUser` herschrijven naar "verifieer het JWT". Alles
 * daarbuiten blijft ongewijzigd.
 *
 * Er zit geen enkele aanname van "er is maar één gebruiker" in de rest van de
 * codebase: elke query filtert op `userId`, ook nu er maar één is.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { UserRepository } from "../../db/repositories/interfaces.js";
import { UnauthorizedError } from "../../lib/errors.js";
import type { RequestUserContext } from "../context.js";
import { env } from "../../config/env.js";

export function registerAuth(app: FastifyInstance, users: UserRepository): void {
  app.decorateRequest("userContext", undefined);

  app.addHook("onRequest", async (request) => {
    // Health-endpoints moeten werken zonder gebruiker: een readiness-probe
    // heeft geen account.
    if (request.url === "/health" || request.url === "/ready") return;

    const user = await users.ensure(env.DEFAULT_USER_EMAIL);
    request.userContext = {
      userId: user.id,
      email: user.email,
      requestId: request.id,
    };
  });
}

/** Haalt de gebruiker op of gooit. Voorkomt `userContext!` in elke handler. */
export function requireUser(request: FastifyRequest): RequestUserContext {
  if (!request.userContext) throw new UnauthorizedError();
  return request.userContext;
}

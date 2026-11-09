/**
 * Wie doet dit verzoek.
 *
 * De hele API werkt op deze abstractie, nooit op "de dev-gebruiker". Zolang er
 * geen login is, vult de auth-middleware hem met de gebruiker uit
 * `DEFAULT_USER_EMAIL`; zodra er JWT's zijn, vult diezelfde middleware hem uit
 * het token. Geen enkele controller of service verandert daardoor.
 *
 * Dat is precies waarom dit een apart bestandje is en geen `userId: string`
 * dat overal doorgegeven wordt: `RequestUserContext` kan later `roles`,
 * `plan` of `organisationId` krijgen zonder dat elke signature meeverandert.
 */
export interface RequestUserContext {
  readonly userId: string;
  readonly email: string;
  /** Correlatie-id van dit verzoek; komt in elke logregel en in elke foutrespons. */
  readonly requestId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Gevuld door de auth-middleware; gebruik `requireUser(request)`. */
    userContext?: RequestUserContext;
  }
}

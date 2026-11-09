import { verifyAccessToken } from '@orbit/auth';
import {
  DomainError,
  requireMembership,
  requireUser,
  type PrismaClient,
  type Scope,
  type Transactional,
} from '@orbit/db';
import { ErrorCode, type UserId, type WorkspaceId } from '@orbit/types';

/**
 * De brug tussen een HTTP-verzoek en de businesslogica.
 *
 * Elk verzoek wordt hier omgezet naar een `Scope`: geauthenticeerde gebruiker,
 * gecontroleerd lidmaatschap en een vaste `workspaceId`. Use-cases krijgen
 * uitsluitend die scope en kunnen daardoor niet per ongeluk buiten de workspace
 * van de gebruiker kijken.
 */

export interface RequestInfo {
  authorizationHeader?: string | null;
  workspaceIdHeader?: string | null;
  deviceIdHeader?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuthenticatedUser {
  userId: UserId;
  sessionId: string;
  tokenWorkspaceId: WorkspaceId | null;
}

export function unauthenticated(message = 'Niet ingelogd'): DomainError {
  return new DomainError(ErrorCode.Unauthenticated, message);
}

function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

export async function authenticate(
  request: RequestInfo,
  secret: string,
): Promise<AuthenticatedUser> {
  const token = bearerToken(request.authorizationHeader);
  if (!token) throw unauthenticated();

  const claims = await verifyAccessToken(token, secret);
  if (!claims) throw unauthenticated('Token ongeldig of verlopen');

  return {
    userId: claims.userId,
    sessionId: claims.sessionId,
    tokenWorkspaceId: claims.workspaceId,
  };
}

export interface ScopeOptions {
  db: Transactional;
  user: AuthenticatedUser;
  /** De header wint van de workspace in het token: schakelen mag zonder opnieuw in te loggen. */
  requestedWorkspaceId?: string | null;
  deviceId?: string | null;
  now?: Date;
}

export async function createScope(options: ScopeOptions): Promise<Scope> {
  const workspaceId = options.requestedWorkspaceId ?? options.user.tokenWorkspaceId;
  if (!workspaceId) {
    throw new DomainError(ErrorCode.ValidationFailed, 'Geen workspace opgegeven');
  }

  // Elk verzoek controleert het lidmaatschap opnieuw. Dat kost één geïndexeerde
  // lookup en zorgt dat een ingetrokken lid niet tot het einde van zijn
  // access token toegang houdt. De voorkeuren komen in dezelfde ronde mee.
  const [role, user] = await Promise.all([
    requireMembership(options.db, options.user.userId, workspaceId),
    requireUser(options.db, options.user.userId),
  ]);

  return {
    db: options.db,
    userId: options.user.userId,
    workspaceId,
    role,
    now: options.now ?? new Date(),
    timeZone: user.timeZone,
    weekStartsOn: user.preferences.weekStartsOn,
    showCompleted: user.preferences.showCompleted,
    ...(options.deviceId ? { deviceId: options.deviceId } : {}),
  };
}

export interface ApiContext {
  prisma: PrismaClient;
  secret: string;
  now: Date;
}

/** Volledige afhandeling: token controleren en scope opbouwen. */
export async function scopeFromRequest(
  context: ApiContext,
  request: RequestInfo,
): Promise<Scope> {
  const user = await authenticate(request, context.secret);
  return createScope({
    db: context.prisma,
    user,
    requestedWorkspaceId: request.workspaceIdHeader,
    deviceId: request.deviceIdHeader,
    now: context.now,
  });
}

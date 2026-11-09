import { ErrorCode } from '@orbit/types';

/**
 * Databasefouten vertalen naar domeinfouten. Route handlers hoeven zo nooit een
 * Prisma-foutcode te kennen, en er lekt geen schema-informatie naar de client.
 */

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string): DomainError =>
  new DomainError(ErrorCode.NotFound, `${what} niet gevonden`);

export const forbidden = (message = 'Geen toegang'): DomainError =>
  new DomainError(ErrorCode.Forbidden, message);

export const conflict = (message: string): DomainError =>
  new DomainError(ErrorCode.Conflict, message);

export const validationFailed = (
  message: string,
  fields?: { path: string; message: string }[],
): DomainError => new DomainError(ErrorCode.ValidationFailed, message, fields);

interface PrismaLikeError {
  code?: string;
  meta?: { target?: string[] | string; field_name?: string };
}

/** Vertaalt de handvol Prisma-codes die wij daadwerkelijk kunnen uitlokken. */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;

  const prismaError = error as PrismaLikeError;
  switch (prismaError.code) {
    case 'P2002': {
      const target = Array.isArray(prismaError.meta?.target)
        ? prismaError.meta.target.join(', ')
        : (prismaError.meta?.target ?? 'waarde');
      return conflict(`Bestaat al: ${target}`);
    }
    case 'P2003':
      return validationFailed('Verwijst naar iets dat niet bestaat');
    case 'P2025':
      return notFound('Record');
    case 'P2034':
      return conflict('Gelijktijdige wijziging, probeer opnieuw');
    default:
      return new DomainError(
        ErrorCode.Internal,
        error instanceof Error ? error.message : 'Onbekende databasefout',
      );
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as PrismaLikeError)?.code === 'P2002';
}

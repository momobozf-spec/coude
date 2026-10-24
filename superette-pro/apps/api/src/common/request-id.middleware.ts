import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Alleen een veilige, korte tekenreeks van de proxy overnemen; anders zelf genereren. */
const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

export interface RequestWithId extends Request {
  id: string;
}

/**
 * Geeft elke request een id, neemt een geldig id van de reverse proxy over en
 * zet het in de respons. Fouten, logregels en auditregels verwijzen ernaar,
 * zodat een gebruiker met één code naar de helpdesk kan.
 */
export function requestIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header(REQUEST_ID_HEADER);
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  (request as RequestWithId).id = id;
  response.setHeader(REQUEST_ID_HEADER, id);
  next();
}

export function requestIdOf(request: Request): string {
  return (request as Partial<RequestWithId>).id ?? 'onbekend';
}

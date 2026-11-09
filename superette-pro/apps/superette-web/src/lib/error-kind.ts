import { ApiError } from './api';

/** Soort fout, voor titel, uitleg en pictogram van de foutmelding. */
export type ErrorKind = 'offline' | 'network' | 'session' | 'generic';

/**
 * Bepaalt wat er misging, zonder te gokken: geen antwoord + toestel offline
 * = offline; geen antwoord terwijl het toestel online is = server onbereikbaar;
 * 401 = sessie voorbij; al de rest = algemene fout met de boodschap van de API.
 */
export function errorKind(error: unknown, online: boolean): ErrorKind {
  if (error instanceof ApiError) {
    if (error.isNetwork) return online ? 'network' : 'offline';
    if (error.status === 401) return 'session';
  }
  return 'generic';
}

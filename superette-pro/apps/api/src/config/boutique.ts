/**
 * Vlag voor de onbemande boetiek "Jamal & Jamila".
 *
 * Productie is alleen de supermarktvergelijker; de boetiek staat standaard UIT,
 * ook in productie. Met de vlag uit worden de boetiekmodules niet geladen
 * (`AppModule.forRoot`), start MQTT niet en geven boetiekroutes 404.
 */
import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/** Leest de (door `validateEnv` genormaliseerde) vlag. Alles behalve exact `true` is uit. */
export function isBoutiqueEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['BOUTIQUE_ENABLED']?.trim() === 'true';
}

/**
 * Voor losse boetiekroutes in een gedeelde controller (bv. `POST /auth/register`
 * met winkeltoestemmingen): zonder boetiek bestaat de route niet.
 */
@Injectable()
export class BoutiqueEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isBoutiqueEnabled()) throw new NotFoundException();
    return true;
  }
}

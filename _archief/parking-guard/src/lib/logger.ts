import 'server-only'

import pino from 'pino'

import { getEnv } from './env'

/**
 * Gestructureerde logging: één JSON-object per regel, zodat een logdrain erop
 * kan filteren zonder reguliere expressies.
 *
 * ─── REDACTION ZIT HIER, NIET OP DE CALL-SITES ───────────────────────────────
 *
 * Dit product verwerkt identiteitskaarten. Een `logger.info('dossier', { data })`
 * ergens diep in de extractiepijplijn mag geen rijksregisternummer laten
 * weglekken omdat de schrijver van die regel er niet aan dacht. Een logbestand
 * is de makkelijkste plek om per ongeluk duizenden persoonsgegevens te
 * verzamelen die er niet horen te staan.
 *
 * De lijst hieronder is bewust ruim. Liever een veld te veel weggelaten dan een
 * geboortedatum in een logdrain die zes maanden bewaard blijft.
 */
const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'apiKey',
  'authorization',
  'cookie',
  'secret',
  'nationalNumber',
  'nationalNumberEncrypted',
  'rijksregisternummer',
  'birthDate',
  'dateOfBirth',
  'address',
  'street',
  'plate',
  'licensePlate',
  'nummerplaat',
  'vin',
  'chassisNumber',
  'extractedData',
  'fields',
  'bodyText',
]

// pino redact wil ook de geneste varianten expliciet hebben.
const redactPaths = REDACTED_PATHS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`])

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[weggelaten]',
  },
  // De tijdstempel als ISO-string; een epoch in milliseconden is bij een
  // incident onnodig werk.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
})

/**
 * Logger met vaste context, bv. per dossier of per achtergrondjob.
 *
 * Geef hier nooit persoonsgegevens aan mee. Een dossier-id is genoeg om alles
 * terug te vinden; de naam van de aanvrager voegt niets toe aan een logregel en
 * maakt de log wél tot een register van persoonsgegevens.
 */
export function childLogger(bindings: Record<string, string | number>): pino.Logger {
  return logger.child(bindings)
}

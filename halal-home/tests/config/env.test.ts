/**
 * Environment-validatie.
 *
 * De belangrijkste test hier is de eerste: een `.env` die letterlijk uit
 * `.env.example` is gekopieerd moet valideren. Dat bestand bevat lege waarden
 * voor optionele sleutels (`ANTHROPIC_API_KEY=`), en een aanwezige lege string
 * is iets anders dan een afwezige sleutel. Zonder de juiste behandeling krijgt
 * iedereen die de installatie-instructies volgt een crash bij het opstarten.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/**
 * Ruimere time-out dan de standaard vijf seconden.
 *
 * Elke test hier roept `vi.resetModules()` aan en importeert `src/config/env.ts`
 * opnieuw — inclusief de hele Zod-keten die eraan hangt. Dat kost onder
 * belasting soms net iets meer dan vijf seconden, en dan faalt een test die
 * inhoudelijk klopt. Wat hier getest wordt is de validatie, niet de snelheid
 * van de moduleloader.
 */
vi.setConfig({ testTimeout: 30_000 })

/**
 * Leest `.env.example` en zet hem om in een object, net zoals dotenv dat doet.
 * Zo test we tegen het bestand dat we werkelijk uitleveren, niet tegen een
 * kopie ervan die kan verouderen.
 */
function parseEnvExample(): Record<string, string> {
  const file = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8')
  const result: Record<string, string> = {}

  for (const line of file.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const index = trimmed.indexOf('=')
    if (index === -1) continue

    result[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }

  return result
}

/**
 * Importeert `src/config/env.ts` met een schone module-cache, zodat elke test
 * zijn eigen `process.env` krijgt. Het bestand valideert bij het importeren, dus
 * zonder `vi.resetModules()` zou alleen de eerste test werkelijk valideren en
 * zouden de rest de gecachete uitkomst van die eerste te zien krijgen.
 */
async function loadEnvWith(overrides: Record<string, string | undefined>) {
  const original = process.env
  process.env = { ...overrides } as NodeJS.ProcessEnv

  try {
    vi.resetModules()
    const loaded = await import('@/config/env')
    return loaded.env as Record<string, unknown>
  } finally {
    process.env = original
  }
}

const BASE = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db?schema=public',
  AUTH_SECRET: 'een-secret-dat-minstens-tweeendertig-tekens-lang-is',
  STORAGE_SIGNING_SECRET: 'een-signeersleutel-die-ook-lang-genoeg-is-hoor',
}

describe('.env.example', () => {
  it('valideert zoals hij wordt uitgeleverd, op de twee secrets na', () => {
    const example = parseEnvExample()

    // Deze twee moet de gebruiker zelf invullen; de rest hoort te werken zoals
    // het er staat.
    const filled = {
      ...example,
      AUTH_SECRET: BASE.AUTH_SECRET,
      STORAGE_SIGNING_SECRET: BASE.STORAGE_SIGNING_SECRET,
    }

    return expect(loadEnvWith(filled)).resolves.toBeDefined()
  })

  it('bevat de sleutels die de applicatie verplicht stelt', () => {
    const example = parseEnvExample()
    for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'NEXT_PUBLIC_APP_URL']) {
      expect(example, `.env.example mist ${key}`).toHaveProperty(key)
    }
  })
})

describe('lege waarden voor optionele sleutels', () => {
  it('behandelt een lege API-key als niet ingevuld', () => {
    // Precies het geval uit .env.example: ANTHROPIC_API_KEY= zonder waarde.
    return expect(
      loadEnvWith({ ...BASE, AI_ENABLED: 'false', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }),
    ).resolves.toBeDefined()
  })

  it('behandelt lege S3-waarden als niet ingevuld zolang storage lokaal is', () => {
    return expect(
      loadEnvWith({ ...BASE, STORAGE_PROVIDER: 'local', S3_BUCKET: '', S3_ACCESS_KEY: '' }),
    ).resolves.toBeDefined()
  })
})

describe('conditionele eisen', () => {
  it('eist een API-key zodra AI aanstaat', () => {
    return expect(
      loadEnvWith({ ...BASE, AI_ENABLED: 'true', AI_PROVIDER: 'anthropic', AI_MODEL: 'model-x' }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it('eist een modelnaam zodra AI aanstaat', () => {
    // Bewust geen default in de code: een hardcoded modelnaam breekt in
    // productie zodra het model uitgefaseerd wordt.
    return expect(
      loadEnvWith({
        ...BASE,
        AI_ENABLED: 'true',
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'sk-test',
      }),
    ).rejects.toThrow(/AI_MODEL/)
  })

  it('eist de OpenAI-key wanneer die provider gekozen is', () => {
    return expect(
      loadEnvWith({
        ...BASE,
        AI_ENABLED: 'true',
        AI_PROVIDER: 'openai',
        AI_MODEL: 'model-x',
        ANTHROPIC_API_KEY: 'sk-anthropic',
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it('eist een signeersleutel bij lokale opslag', () => {
    // Zonder sleutel zijn download-tokens vervalsbaar.
    const { STORAGE_SIGNING_SECRET: _omitted, ...zonder } = BASE
    return expect(
      loadEnvWith({ ...zonder, STORAGE_PROVIDER: 'local' }),
    ).rejects.toThrow(/STORAGE_SIGNING_SECRET/)
  })

  it('eist bucket en sleutels bij S3-opslag', () => {
    return expect(
      loadEnvWith({ ...BASE, STORAGE_PROVIDER: 's3' }),
    ).rejects.toThrow(/S3_BUCKET/)
  })

  it('weigert een te korte AUTH_SECRET', () => {
    return expect(loadEnvWith({ ...BASE, AUTH_SECRET: 'kort' })).rejects.toThrow(/AUTH_SECRET/)
  })
})

describe('foutmeldingen', () => {
  it('lekken de ingelezen waarden niet', () => {
    // De ruwe Zod-error bevat de waarden die gevalideerd zijn, en dat zijn
    // precies de secrets die niet in een stacktrace of log horen.
    const secret = 'sk-geheim-mag-nooit-in-een-foutmelding-staan'

    return loadEnvWith({ ...BASE, AUTH_SECRET: 'kort', ANTHROPIC_API_KEY: secret }).then(
      () => expect.unreachable('validatie had moeten falen'),
      (error: Error) => {
        expect(error.message).not.toContain(secret)
        expect(error.message).toContain('AUTH_SECRET')
      },
    )
  })
})

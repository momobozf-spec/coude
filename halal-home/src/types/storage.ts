/**
 * Het contract voor documentopslag.
 *
 * Halal Home bewaart identiteitskaarten, loonfiches en bankafschriften. Elke
 * implementatie van dit interface moet daarom voldoen aan de eisen in
 * `src/server/storage/policy.ts`:
 *
 *   - de opslag is privé; er bestaat geen publieke URL naar een object;
 *   - downloads lopen via een tijdelijke, gesigneerde URL;
 *   - de sleutel bevat een willekeurige UUID en nooit de bestandsnaam van de
 *     gebruiker;
 *   - verwijderen verwijdert echt.
 */

export type StorageProviderName = 'local' | 's3'

export interface StoredObject {
  key: string
  size: number
  mimeType: string
}

/** Wat de opslag over een object weet, zonder het te downloaden. */
export interface StorageMetadata {
  key: string
  size: number
  lastModified: Date | null
}

export interface StorageProvider {
  readonly name: StorageProviderName

  put(key: string, data: Buffer, mimeType: string): Promise<StoredObject>

  get(key: string): Promise<Buffer>

  delete(key: string): Promise<void>

  exists(key: string): Promise<boolean>

  /**
   * De eigenschappen van een object zonder de inhoud op te halen.
   *
   * Bestaat om databaserij en opslag tegen elkaar te kunnen houden: een rij die
   * zegt "1,2 MB beschikbaar" terwijl de opslag niets heeft, is een
   * inconsistentie die we willen kunnen vinden zonder gigabytes te downloaden.
   *
   * Geeft null wanneer het object niet bestaat — dat is een antwoord, geen fout.
   */
  getMetadata(key: string): Promise<StorageMetadata | null>

  /**
   * Een tijdelijke URL waarmee het bestand opgehaald kan worden.
   * Geldig gedurende `ttlSeconds`; daarna niet meer.
   */
  signedUrl(key: string, ttlSeconds: number): Promise<string>
}

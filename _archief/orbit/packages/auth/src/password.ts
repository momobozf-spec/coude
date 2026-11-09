import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id voor wachtwoorden.
 *
 * Waarom niet bcrypt: bcrypt kapt stil af op 72 bytes en is puur CPU-hard,
 * waardoor GPU's het efficiënt kraken. Argon2id is geheugen-hard en is de
 * huidige aanbeveling van OWASP. De parameters volgen hun minimum voor
 * Argon2id: 19 MiB geheugen, 2 iteraties, 1 thread.
 */
// Argon2id is de standaardvariant van @node-rs/argon2; we zetten hem niet
// expliciet omdat de `Algorithm`-enum een ambient const enum is en daardoor niet
// samengaat met `verbatimModuleSyntax`. De testsuite controleert dat de
// resulterende hash daadwerkelijk met `$argon2id$` begint.
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hashValue: string, password: string): Promise<boolean>;
  /** Of de hash met verouderde parameters is gemaakt en herzien moet worden. */
  needsRehash(hashValue: string): boolean;
}

export const argon2Hasher: PasswordHasher = {
  async hash(password) {
    return hash(password, OPTIONS);
  },

  async verify(hashValue, password) {
    try {
      return await verify(hashValue, password, OPTIONS);
    } catch {
      // Een beschadigde of onbekende hash is simpelweg geen match. Nooit de
      // onderliggende fout doorgeven: dat zou verraden of het account bestaat.
      return false;
    }
  },

  needsRehash(hashValue) {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)/.exec(hashValue);
    if (!match) return true;
    return (
      Number(match[1]) < OPTIONS.memoryCost ||
      Number(match[2]) < OPTIONS.timeCost ||
      Number(match[3]) < OPTIONS.parallelism
    );
  },
};

/**
 * Vergelijking in constante tijd voor de gevallen waarin er geen gebruiker is.
 * Zonder dit is een niet-bestaand account meetbaar sneller dan een bestaand
 * account met verkeerd wachtwoord, en dat lekt welke e-mailadressen bestaan.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zYWx0LXZhbHVl$4kJ2sVpm3AaP1r5oQ2sBqXzT8yLdEfGhIjKlMnOpQrS';

export async function fakeVerify(hasher: PasswordHasher, password: string): Promise<void> {
  await hasher.verify(DUMMY_HASH, password);
}

import { describe, expect, it } from 'vitest';
import { argon2Hasher } from '../src/password';

describe('wachtwoord-hashing', () => {
  it('maakt een argon2id-hash die verifieert', async () => {
    const hash = await argon2Hasher.hash('een lang en degelijk wachtwoord');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2Hasher.verify(hash, 'een lang en degelijk wachtwoord')).toBe(true);
  });

  it('weigert een verkeerd wachtwoord', async () => {
    const hash = await argon2Hasher.hash('een lang en degelijk wachtwoord');
    expect(await argon2Hasher.verify(hash, 'iets anders')).toBe(false);
  });

  it('gebruikt per hash een eigen salt', async () => {
    const [first, second] = await Promise.all([
      argon2Hasher.hash('zelfde wachtwoord'),
      argon2Hasher.hash('zelfde wachtwoord'),
    ]);
    expect(first).not.toBe(second);
  });

  it('kapt niet af bij lange wachtwoorden', async () => {
    // bcrypt zou hier stilzwijgend na 72 bytes stoppen en beide accepteren.
    const long = 'a'.repeat(100);
    const hash = await argon2Hasher.hash(`${long}staart-een`);
    expect(await argon2Hasher.verify(hash, `${long}staart-twee`)).toBe(false);
  });

  it('crasht niet op een onzin-hash', async () => {
    expect(await argon2Hasher.verify('geen-geldige-hash', 'wachtwoord')).toBe(false);
  });

  it('signaleert verouderde parameters', async () => {
    const current = await argon2Hasher.hash('wachtwoord');
    expect(argon2Hasher.needsRehash(current)).toBe(false);
    expect(argon2Hasher.needsRehash('$argon2id$v=19$m=4096,t=1,p=1$abc$def')).toBe(true);
    expect(argon2Hasher.needsRehash('$2b$10$oudebcrypthash')).toBe(true);
  });
});

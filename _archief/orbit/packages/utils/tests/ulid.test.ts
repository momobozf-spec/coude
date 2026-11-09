import { describe, expect, it } from 'vitest';
import { createMonotonicUlid, isUlid, ulid, ulidTimestamp } from '../src/ulid';

describe('ulid', () => {
  it('is 26 tekens lang en geldig', () => {
    const id = ulid();
    expect(id).toHaveLength(26);
    expect(isUlid(id)).toBe(true);
  });

  it('sorteert lexicografisch op tijd', () => {
    const early = ulid(1_700_000_000_000);
    const late = ulid(1_800_000_000_000);
    expect(early < late).toBe(true);
  });

  it('kan het aanmaakmoment teruglezen', () => {
    const now = 1_756_000_000_000;
    expect(ulidTimestamp(ulid(now))).toBe(now);
  });

  it('is monotoon binnen dezelfde milliseconde', () => {
    const next = createMonotonicUlid();
    const ids = Array.from({ length: 500 }, () => next(1_756_000_000_000));
    expect(new Set(ids).size).toBe(500);
    expect([...ids].sort()).toEqual(ids);
  });

  it('herkent ongeldige waarden', () => {
    expect(isUlid('te-kort')).toBe(false);
    expect(isUlid('IIIIIIIIIIIIIIIIIIIIIIIIII')).toBe(false); // I zit niet in Crockford
    expect(isUlid(42)).toBe(false);
  });

  it('genereert geen botsingen bij volume', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => ulid()));
    expect(ids.size).toBe(10_000);
  });
});

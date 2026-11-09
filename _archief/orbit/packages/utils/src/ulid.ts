/**
 * ULID: 48-bit timestamp in milliseconden + 80 bits willekeur, Crockford base32.
 *
 * Waarom geen UUIDv4: ULIDs sorteren lexicografisch op aanmaaktijd, wat een
 * gratis `ORDER BY id` oplevert en b-tree-indexen niet fragmenteert. Waarom
 * client-generated: offline moet je meteen relaties kunnen leggen tussen
 * objecten die de server nog nooit gezien heeft.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: geen I, L, O, U
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;
const TIME_MAX = 281474976710655; // 2^48 - 1

export type RandomSource = (bytes: number) => Uint8Array;

const cryptoRandom: RandomSource = (bytes) => {
  const buf = new Uint8Array(bytes);
  // Structureel getypeerd: dit draait zowel in Node, de browser als in Hermes,
  // en we willen geen DOM-lib in een package dat ook op de server wordt gebruikt.
  const g = globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(buf);
    return buf;
  }
  // Laatste redmiddel (oude React Native runtimes zonder crypto-polyfill).
  // Niet cryptografisch sterk, maar botsingskans blijft verwaarloosbaar omdat
  // de tijdcomponent al 48 bits uniek maakt.
  for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
};

function encodeTime(now: number): string {
  if (!Number.isInteger(now) || now < 0 || now > TIME_MAX) {
    throw new RangeError(`ULID-timestamp buiten bereik: ${now}`);
  }
  let out = '';
  let value = now;
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = value % ENCODING_LEN;
    out = ENCODING[mod] + out;
    value = (value - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(random: RandomSource): string {
  const bytes = random(RANDOM_LEN);
  let out = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    out += ENCODING[(bytes[i] ?? 0) % ENCODING_LEN];
  }
  return out;
}

/**
 * Genereert een ULID. `now` en `random` zijn injecteerbaar zodat tests
 * deterministisch kunnen zijn.
 */
export function ulid(now: number = Date.now(), random: RandomSource = cryptoRandom): string {
  return encodeTime(now) + encodeRandom(random);
}

/**
 * Monotone variant: binnen dezelfde milliseconde wordt het random-deel met 1
 * opgehoogd in plaats van opnieuw getrokken, zodat twee ids die in dezelfde tick
 * ontstaan gegarandeerd oplopend sorteren. Belangrijk voor bulkimports.
 */
export function createMonotonicUlid(random: RandomSource = cryptoRandom): (now?: number) => string {
  let lastTime = -1;
  let lastRandom = '';

  return (now: number = Date.now()): string => {
    if (now <= lastTime) {
      lastRandom = incrementBase32(lastRandom);
      return encodeTime(lastTime) + lastRandom;
    }
    lastTime = now;
    lastRandom = encodeRandom(random);
    return encodeTime(now) + lastRandom;
  };
}

function incrementBase32(str: string): string {
  const chars = str.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const index = ENCODING.indexOf(chars[i] ?? '');
    if (index < ENCODING_LEN - 1) {
      chars[i] = ENCODING[index + 1] as string;
      return chars.join('');
    }
    chars[i] = ENCODING[0] as string;
  }
  throw new Error('ULID random-component is overgelopen');
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value);
}

/** Haalt het aanmaakmoment uit een ULID. Handig voor debugging en sortering. */
export function ulidTimestamp(id: string): number {
  if (!isUlid(id)) throw new TypeError(`Geen geldige ULID: ${id}`);
  let time = 0;
  for (let i = 0; i < TIME_LEN; i++) {
    time = time * ENCODING_LEN + ENCODING.indexOf(id[i] as string);
  }
  return time;
}

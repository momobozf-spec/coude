/**
 * Identifier generation with an injectable implementation.
 *
 * The platform layer installs `expo-crypto`'s `randomUUID`; tests and Node use
 * the WebCrypto implementation. The Math.random fallback exists only so that the
 * domain layer never crashes in an environment without WebCrypto.
 */

export type IdGenerator = () => string;

let generator: IdGenerator | null = null;

function fallbackGenerator(): string {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  // RFC 4122 v4 shape from Math.random; acceptable only as a last-resort fallback.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function setIdGenerator(next: IdGenerator | null): void {
  generator = next;
}

export function newId(): string {
  return (generator ?? fallbackGenerator)();
}

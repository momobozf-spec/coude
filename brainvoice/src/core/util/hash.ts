/** Small, dependency-free 32-bit FNV-1a hash (not cryptographic). Used to correlate audit rows and to de-duplicate imported content. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Stable 64-bit-ish content fingerprint built from two FNV-1a passes over normalised text. */
export function contentFingerprint(parts: readonly (string | null | undefined)[]): string {
  const normalised = parts.map((p) => (p ?? '').replace(/\s+/g, ' ').trim().toLowerCase()).join('\u0000');
  return `${fnv1a(normalised)}${fnv1a(`${normalised.length}:${normalised}`)}`;
}

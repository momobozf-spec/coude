/**
 * Deterministic shuffling for the lesson player.
 *
 * The page is rendered on the server and hydrated in the browser; a
 * `Math.random()` shuffle would produce two different orders and a hydration
 * mismatch. Seeding from the lesson and exercise id gives every member the same
 * order for the same question — fine for learning, and stable across reloads.
 */

function hash(value: string): number {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The indices 0…length-1 in a seeded order. Never returns the identity order
 * when `length > 1`, so an ordering question is never already solved and the
 * right answer is never always the first option.
 */
export function shuffledIndices(length: number, seed: string): number[] {
  const indices = Array.from({ length }, (_, index) => index)
  const random = mulberry32(hash(seed))

  for (let index = length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[indices[index], indices[swap]] = [indices[swap]!, indices[index]!]
  }

  if (length > 1 && indices.every((value, position) => value === position)) {
    indices.push(indices.shift()!)
  }

  return indices
}

/**
 * Semantic search abstraction. Not used by the MVP (FTS5 is enough), but the
 * SearchService accepts an EmbeddingProvider so vectors can be added later
 * (e.g. sqlite-vec via expo-sqlite's `withSQLiteVecExtension`, or a cloud model).
 */
export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorIndex {
  upsert(itemId: string, vector: number[]): Promise<void>;
  remove(itemId: string): Promise<void>;
  query(vector: number[], limit: number): Promise<{ itemId: string; score: number }[]>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

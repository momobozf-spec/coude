/**
 * Provider credentials (OAuth refresh tokens, API keys) live **server-side** in an
 * encrypted store; the app never holds them. This is the seam: the server implements it
 * with AES-256-GCM over the `provider_credentials` table (server/db/EncryptedCredentialStore.ts),
 * tests use the in-memory version. Metadata (account address, last error) is not secret.
 */
export interface StoredCredential<T> {
  secret: T;
  meta: Record<string, unknown>;
  updatedAt: string;
}

export interface CredentialStore {
  load<T>(provider: string): Promise<StoredCredential<T> | null>;
  save<T>(provider: string, secret: T, meta?: Record<string, unknown>): Promise<void>;
  updateMeta(provider: string, patch: Record<string, unknown>): Promise<void>;
  clear(provider: string): Promise<void>;
}

export class InMemoryCredentialStore implements CredentialStore {
  private readonly items = new Map<string, StoredCredential<unknown>>();

  async load<T>(provider: string): Promise<StoredCredential<T> | null> {
    return (this.items.get(provider) as StoredCredential<T> | undefined) ?? null;
  }

  async save<T>(provider: string, secret: T, meta: Record<string, unknown> = {}): Promise<void> {
    const existing = this.items.get(provider);
    this.items.set(provider, { secret, meta: { ...(existing?.meta ?? {}), ...meta }, updatedAt: new Date().toISOString() });
  }

  async updateMeta(provider: string, patch: Record<string, unknown>): Promise<void> {
    const existing = this.items.get(provider);
    if (!existing) return;
    this.items.set(provider, { ...existing, meta: { ...existing.meta, ...patch }, updatedAt: new Date().toISOString() });
  }

  async clear(provider: string): Promise<void> {
    this.items.delete(provider);
  }
}

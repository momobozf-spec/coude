import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import type { SqlExecutor } from '../../src/core/db/SqlDriver';
import type { CredentialStore, StoredCredential } from '../../src/core/ops/providers/CredentialStore';
import type { Clock } from '../../src/core/services/Clock';

/**
 * Provider secrets (Gmail refresh tokens…) encrypted at rest with AES-256-GCM in the
 * `provider_credentials` table. The key comes from `ALFRED_SECRET_KEY` (64 hex chars or
 * base64 of 32 bytes); a shorter value is stretched with scrypt so development still
 * works, but production must use a random 32-byte key. Metadata stays readable.
 */
export class EncryptedCredentialStore implements CredentialStore {
  private readonly key: Buffer;

  constructor(
    private readonly db: SqlExecutor,
    secretKey: string,
    private readonly clock: Clock,
  ) {
    this.key = deriveKey(secretKey);
  }

  async load<T>(provider: string): Promise<StoredCredential<T> | null> {
    const row = await this.db.get<{ secret_enc: string; meta_json: string; updated_at: string }>('SELECT secret_enc, meta_json, updated_at FROM provider_credentials WHERE provider = ?', [provider]);
    if (!row) return null;
    return { secret: JSON.parse(this.decrypt(String(row.secret_enc))) as T, meta: safeJson(String(row.meta_json)), updatedAt: String(row.updated_at) };
  }

  async save<T>(provider: string, secret: T, meta: Record<string, unknown> = {}): Promise<void> {
    const existing = await this.load<T>(provider);
    const now = this.clock.nowISO();
    const merged = { ...(existing?.meta ?? {}), ...meta };
    await this.db.run(
      `INSERT INTO provider_credentials (provider, secret_enc, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET secret_enc = excluded.secret_enc, meta_json = excluded.meta_json, updated_at = excluded.updated_at`,
      [provider, this.encrypt(JSON.stringify(secret)), JSON.stringify(merged), now, now],
    );
  }

  async updateMeta(provider: string, patch: Record<string, unknown>): Promise<void> {
    const existing = await this.load(provider);
    if (!existing) return;
    await this.db.run('UPDATE provider_credentials SET meta_json = ?, updated_at = ? WHERE provider = ?', [JSON.stringify({ ...existing.meta, ...patch }), this.clock.nowISO(), provider]);
  }

  async clear(provider: string): Promise<void> {
    await this.db.run('DELETE FROM provider_credentials WHERE provider = ?', [provider]);
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  private decrypt(payload: string): string {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  const b64 = Buffer.from(trimmed, 'base64');
  if (b64.length === 32) return b64;
  return scryptSync(trimmed, 'alfred-provider-credentials', 32);
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

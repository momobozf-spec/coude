import type { Database } from '../../db/Database';
import type { AuditEntry, ToolPermission } from '../../domain/admin';
import { fnv1a } from '../../util/hash';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

/**
 * Audit trail for sensitive and external tool executions (§134). Arguments are stored
 * as a short summary plus a hash, never the full payload (email bodies, amounts stay in
 * their own records).
 */
export class AuditService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async record(params: { tool: string; permission: ToolPermission; args: unknown; confirmed: boolean; ok: boolean; error?: string | null }): Promise<AuditEntry> {
    const json = safeStringify(params.args);
    const entry: AuditEntry = {
      id: newId(),
      tool: params.tool,
      permission: params.permission,
      argsSummary: json.length > 160 ? `${json.slice(0, 157)}…` : json,
      argsHash: fnv1a(json),
      confirmed: params.confirmed,
      ok: params.ok,
      error: params.error ?? null,
      createdAt: this.clock.nowISO(),
    };
    await this.db.audit.insert(entry);
    return entry;
  }

  listRecent(limit = 100): Promise<AuditEntry[]> {
    return this.db.audit.listRecent(limit);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'string' && v.length > 200 ? `${v.slice(0, 197)}…` : v)) ?? '';
  } catch {
    return String(value);
  }
}

export { fnv1a };

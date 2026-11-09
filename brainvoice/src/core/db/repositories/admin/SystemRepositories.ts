import { fromBool, nullable, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { AuditEntry, EntityLink, EntityRef, LinkableType, ToolPermission, Workflow, WorkflowCondition, WorkflowRun, WorkflowRunStatus, WorkflowStep, WorkflowTrigger, WorkflowTriggerType } from '../../../domain/admin';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Workflows (§129)
// ---------------------------------------------------------------------------

function rowToWorkflow(r: Row): Workflow {
  return {
    id: String(r.id),
    name: String(r.name),
    description: nullable(r.description),
    trigger: parseJson<WorkflowTrigger>(r.trigger_json, { type: 'schedule' }),
    conditions: parseJson<WorkflowCondition[]>(r.conditions_json, []),
    steps: parseJson<WorkflowStep[]>(r.steps_json, []),
    enabled: toBool(r.enabled),
    builtIn: toBool(r.built_in),
    sourceText: nullable(r.source_text),
    lastRunAt: nullable(r.last_run_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class WorkflowRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(w: Workflow): Promise<void> {
    await this.db.run('INSERT INTO workflows (id, name, description, trigger_json, conditions_json, steps_json, enabled, built_in, source_text, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      w.id, w.name, w.description, toJson(w.trigger), toJson(w.conditions), toJson(w.steps), fromBool(w.enabled), fromBool(w.builtIn), w.sourceText, w.lastRunAt, w.createdAt, w.updatedAt,
    ]);
  }

  async update(w: Workflow): Promise<void> {
    await this.db.run('UPDATE workflows SET name = ?, description = ?, trigger_json = ?, conditions_json = ?, steps_json = ?, enabled = ?, source_text = ?, last_run_at = ?, updated_at = ? WHERE id = ?', [
      w.name, w.description, toJson(w.trigger), toJson(w.conditions), toJson(w.steps), fromBool(w.enabled), w.sourceText, w.lastRunAt, w.updatedAt, w.id,
    ]);
  }

  async getById(id: string): Promise<Workflow | null> {
    const row = await this.db.get<Row>('SELECT * FROM workflows WHERE id = ?', [id]);
    return row ? rowToWorkflow(row) : null;
  }

  async list(options: { enabledOnly?: boolean; triggerType?: WorkflowTriggerType | null } = {}): Promise<Workflow[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.enabledOnly) where.push('enabled = 1');
    if (options.triggerType) {
      where.push('trigger_json LIKE ?');
      params.push(`%"type":"${options.triggerType}"%`);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM workflows ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY built_in DESC, created_at ASC`, params);
    return rows.map(rowToWorkflow);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM workflows WHERE id = ? AND built_in = 0', [id]);
  }
}

function rowToRun(r: Row): WorkflowRun {
  return {
    id: String(r.id),
    workflowId: String(r.workflow_id),
    workflowName: String(r.workflow_name ?? ''),
    triggerType: String(r.trigger_type) as WorkflowTriggerType,
    eventSummary: String(r.event_summary ?? ''),
    status: String(r.status) as WorkflowRunStatus,
    log: parseJson<string[]>(r.log_json, []),
    eventPayload: parseJson<Record<string, unknown>>(r.event_json, {}),
    steps: parseJson<WorkflowStep[]>(r.steps_json, []),
    nextStep: Number(r.next_step ?? 0),
    approvalId: nullable(r.approval_id),
    ticketId: nullable(r.ticket_id),
    createdAt: String(r.created_at),
    updatedAt: nullable(r.updated_at),
  };
}

export class WorkflowRunRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(run: WorkflowRun): Promise<void> {
    await this.db.run('INSERT INTO workflow_runs (id, workflow_id, workflow_name, trigger_type, event_summary, status, log_json, event_json, steps_json, next_step, approval_id, ticket_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      run.id, run.workflowId, run.workflowName, run.triggerType, run.eventSummary, run.status, toJson(run.log), toJson(run.eventPayload), toJson(run.steps), run.nextStep, run.approvalId, run.ticketId, run.createdAt, run.updatedAt,
    ]);
  }

  async update(run: WorkflowRun): Promise<void> {
    await this.db.run('UPDATE workflow_runs SET status = ?, log_json = ?, next_step = ?, approval_id = ?, ticket_id = ?, updated_at = ? WHERE id = ?', [run.status, toJson(run.log), run.nextStep, run.approvalId, run.ticketId, run.updatedAt, run.id]);
  }

  async getById(id: string): Promise<WorkflowRun | null> {
    const row = await this.db.get<Row>('SELECT * FROM workflow_runs WHERE id = ?', [id]);
    return row ? rowToRun(row) : null;
  }

  async listRecent(limit = 50): Promise<WorkflowRun[]> {
    const rows = await this.db.all<Row>('SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToRun);
  }

  async listByStatus(status: WorkflowRunStatus, limit = 100): Promise<WorkflowRun[]> {
    const rows = await this.db.all<Row>('SELECT * FROM workflow_runs WHERE status = ? ORDER BY created_at DESC LIMIT ?', [status, limit]);
    return rows.map(rowToRun);
  }
}

// ---------------------------------------------------------------------------
// Audit log (§134)
// ---------------------------------------------------------------------------

export class AuditRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: AuditEntry): Promise<void> {
    await this.db.run('INSERT INTO audit_log (id, tool, permission, args_summary, args_hash, confirmed, ok, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [e.id, e.tool, e.permission, e.argsSummary, e.argsHash, fromBool(e.confirmed), fromBool(e.ok), e.error, e.createdAt]);
  }

  async listRecent(limit = 100): Promise<AuditEntry[]> {
    const rows = await this.db.all<Row>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map((r) => ({ id: String(r.id), tool: String(r.tool), permission: String(r.permission) as ToolPermission, argsSummary: String(r.args_summary ?? ''), argsHash: String(r.args_hash ?? ''), confirmed: toBool(r.confirmed), ok: toBool(r.ok), error: nullable(r.error), createdAt: String(r.created_at) }));
  }
}

// ---------------------------------------------------------------------------
// Entity links (§133) – reuses the `item_links` table
// ---------------------------------------------------------------------------

export class LinkRepository {
  constructor(private readonly db: SqlExecutor) {}

  async link(from: EntityRef, to: EntityRef, relation: string, createdAt: string): Promise<void> {
    await this.db.run('INSERT OR IGNORE INTO item_links (from_type, from_id, to_type, to_id, relation, created_at) VALUES (?, ?, ?, ?, ?, ?)', [from.type, from.id, to.type, to.id, relation, createdAt]);
  }

  async unlink(from: EntityRef, to: EntityRef): Promise<void> {
    await this.db.run('DELETE FROM item_links WHERE from_type = ? AND from_id = ? AND to_type = ? AND to_id = ?', [from.type, from.id, to.type, to.id]);
  }

  /** Links in both directions for an entity. */
  async linksOf(ref: EntityRef, type?: LinkableType): Promise<EntityLink[]> {
    const params: SqlValue[] = [ref.type, ref.id, ref.type, ref.id];
    let typeFilter = '';
    if (type) {
      typeFilter = ' AND (to_type = ? OR from_type = ?)';
      params.push(type, type);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM item_links WHERE ((from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?))${typeFilter} ORDER BY created_at ASC`, params);
    return rows.map((r) => ({ from: { type: String(r.from_type) as LinkableType, id: String(r.from_id) }, to: { type: String(r.to_type) as LinkableType, id: String(r.to_id) }, relation: String(r.relation), createdAt: String(r.created_at) }));
  }

  /** Ids of linked entities of one type (either direction). */
  async linkedIds(ref: EntityRef, type: LinkableType): Promise<string[]> {
    const links = await this.linksOf(ref, type);
    const ids = new Set<string>();
    for (const l of links) {
      if (l.from.type === type && !(l.from.type === ref.type && l.from.id === ref.id)) ids.add(l.from.id);
      if (l.to.type === type && !(l.to.type === ref.type && l.to.id === ref.id)) ids.add(l.to.id);
    }
    return [...ids];
  }

  async removeAll(ref: EntityRef): Promise<void> {
    await this.db.run('DELETE FROM item_links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)', [ref.type, ref.id, ref.type, ref.id]);
  }
}

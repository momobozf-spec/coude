import { nullable, numberOrNull, parseJson, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { Blocker, BlockerKind, Decision, Meeting, Milestone, MilestoneStatus, Project, ProjectRisk, ProjectStatus, RiskLevel, RiskStatus, SourceType, Suggestion, SuggestionKind, SuggestionStatus } from '../../../domain/admin';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Projects (§112–§113)
// ---------------------------------------------------------------------------

function rowToProject(r: Row): Project {
  return {
    id: String(r.id),
    name: String(r.name),
    description: nullable(r.description),
    status: String(r.status) as ProjectStatus,
    companyId: nullable(r.company_id),
    goal: nullable(r.goal),
    deliverables: parseJson<string[]>(r.deliverables_json, []),
    tags: parseJson<string[]>(r.tags_json, []),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    completedAt: nullable(r.completed_at),
  };
}

export class ProjectRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(p: Project): Promise<void> {
    await this.db.run('INSERT INTO projects (id, name, description, status, company_id, goal, deliverables_json, tags_json, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      p.id, p.name, p.description, p.status, p.companyId, p.goal, toJson(p.deliverables), toJson(p.tags), p.createdAt, p.updatedAt, p.completedAt,
    ]);
  }

  async update(p: Project): Promise<void> {
    await this.db.run('UPDATE projects SET name = ?, description = ?, status = ?, company_id = ?, goal = ?, deliverables_json = ?, tags_json = ?, updated_at = ?, completed_at = ? WHERE id = ?', [
      p.name, p.description, p.status, p.companyId, p.goal, toJson(p.deliverables), toJson(p.tags), p.updatedAt, p.completedAt, p.id,
    ]);
  }

  async getById(id: string): Promise<Project | null> {
    const row = await this.db.get<Row>('SELECT * FROM projects WHERE id = ?', [id]);
    return row ? rowToProject(row) : null;
  }

  async list(options: { status?: ProjectStatus | 'open' | 'all'; companyId?: string | null; limit?: number } = {}): Promise<Project[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'open';
    if (status === 'open') where.push("status IN ('active', 'on_hold')");
    else if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.companyId) {
      where.push('company_id = ?');
      params.push(options.companyId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM projects ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END, updated_at DESC LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToProject);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Milestones (§116)
// ---------------------------------------------------------------------------

function rowToMilestone(r: Row): Milestone {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    title: String(r.title),
    targetDate: nullable(r.target_date),
    status: String(r.status) as MilestoneStatus,
    owner: nullable(r.owner),
    sortOrder: numberOrNull(r.sort_order) ?? 0,
    dependsOn: parseJson<string[]>(r.depends_on_json, []),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    completedAt: nullable(r.completed_at),
  };
}

export class MilestoneRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(m: Milestone): Promise<void> {
    await this.db.run('INSERT INTO milestones (id, project_id, title, target_date, status, owner, sort_order, depends_on_json, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      m.id, m.projectId, m.title, m.targetDate, m.status, m.owner, m.sortOrder, toJson(m.dependsOn), m.createdAt, m.updatedAt, m.completedAt,
    ]);
  }

  async update(m: Milestone): Promise<void> {
    await this.db.run('UPDATE milestones SET title = ?, target_date = ?, status = ?, owner = ?, sort_order = ?, depends_on_json = ?, updated_at = ?, completed_at = ? WHERE id = ?', [m.title, m.targetDate, m.status, m.owner, m.sortOrder, toJson(m.dependsOn), m.updatedAt, m.completedAt, m.id]);
  }

  async getById(id: string): Promise<Milestone | null> {
    const row = await this.db.get<Row>('SELECT * FROM milestones WHERE id = ?', [id]);
    return row ? rowToMilestone(row) : null;
  }

  async listByProject(projectId: string): Promise<Milestone[]> {
    const rows = await this.db.all<Row>('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order ASC, target_date ASC', [projectId]);
    return rows.map(rowToMilestone);
  }

  async listDueBetween(fromDate: string, toDate: string): Promise<Milestone[]> {
    const rows = await this.db.all<Row>("SELECT * FROM milestones WHERE status IN ('planned', 'in_progress') AND target_date >= ? AND target_date <= ? ORDER BY target_date ASC", [fromDate, toDate]);
    return rows.map(rowToMilestone);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM milestones WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Risks (§119)
// ---------------------------------------------------------------------------

function rowToRisk(r: Row): ProjectRisk {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    description: String(r.description),
    impact: String(r.impact) as RiskLevel,
    likelihood: String(r.likelihood) as RiskLevel,
    mitigation: nullable(r.mitigation),
    owner: nullable(r.owner),
    status: String(r.status) as RiskStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class RiskRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(k: ProjectRisk): Promise<void> {
    await this.db.run('INSERT INTO project_risks (id, project_id, description, impact, likelihood, mitigation, owner, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      k.id, k.projectId, k.description, k.impact, k.likelihood, k.mitigation, k.owner, k.status, k.createdAt, k.updatedAt,
    ]);
  }

  async update(k: ProjectRisk): Promise<void> {
    await this.db.run('UPDATE project_risks SET description = ?, impact = ?, likelihood = ?, mitigation = ?, owner = ?, status = ?, updated_at = ? WHERE id = ?', [k.description, k.impact, k.likelihood, k.mitigation, k.owner, k.status, k.updatedAt, k.id]);
  }

  async getById(id: string): Promise<ProjectRisk | null> {
    const row = await this.db.get<Row>('SELECT * FROM project_risks WHERE id = ?', [id]);
    return row ? rowToRisk(row) : null;
  }

  async listByProject(projectId: string | null, status: RiskStatus | 'all' = 'open'): Promise<ProjectRisk[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (projectId) {
      where.push('project_id = ?');
      params.push(projectId);
    }
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM project_risks ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC`, params);
    return rows.map(rowToRisk);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM project_risks WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Decisions (§120)
// ---------------------------------------------------------------------------

function rowToDecision(r: Row): Decision {
  return {
    id: String(r.id),
    projectId: nullable(r.project_id),
    decision: String(r.decision),
    reason: nullable(r.reason),
    decidedOn: String(r.decided_on),
    participants: parseJson<string[]>(r.participants_json, []),
    meetingId: nullable(r.meeting_id),
    createdAt: String(r.created_at),
  };
}

export class DecisionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(d: Decision): Promise<void> {
    await this.db.run('INSERT INTO decisions (id, project_id, decision, reason, decided_on, participants_json, meeting_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [d.id, d.projectId, d.decision, d.reason, d.decidedOn, toJson(d.participants), d.meetingId, d.createdAt]);
  }

  async getById(id: string): Promise<Decision | null> {
    const row = await this.db.get<Row>('SELECT * FROM decisions WHERE id = ?', [id]);
    return row ? rowToDecision(row) : null;
  }

  async list(options: { projectId?: string | null; meetingId?: string | null; query?: string | null; since?: string | null; limit?: number } = {}): Promise<Decision[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.meetingId) {
      where.push('meeting_id = ?');
      params.push(options.meetingId);
    }
    if (options.query) {
      const needle = `%${options.query.toLowerCase()}%`;
      where.push('(lower(decision) LIKE ? OR lower(reason) LIKE ?)');
      params.push(needle, needle);
    }
    if (options.since) {
      where.push('decided_on >= ?');
      params.push(options.since);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM decisions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY decided_on DESC, created_at DESC LIMIT ?`, [...params, options.limit ?? 100]);
    return rows.map(rowToDecision);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM decisions WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Blockers (§118)
// ---------------------------------------------------------------------------

function rowToBlocker(r: Row): Blocker {
  return {
    id: String(r.id),
    projectId: nullable(r.project_id),
    taskId: nullable(r.task_id),
    kind: String(r.kind) as BlockerKind,
    description: String(r.description),
    who: nullable(r.who),
    status: String(r.status) as 'open' | 'resolved',
    createdAt: String(r.created_at),
    resolvedAt: nullable(r.resolved_at),
  };
}

export class BlockerRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(b: Blocker): Promise<void> {
    await this.db.run('INSERT INTO blockers (id, project_id, task_id, kind, description, who, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [b.id, b.projectId, b.taskId, b.kind, b.description, b.who, b.status, b.createdAt, b.resolvedAt]);
  }

  async update(b: Blocker): Promise<void> {
    await this.db.run('UPDATE blockers SET project_id = ?, task_id = ?, kind = ?, description = ?, who = ?, status = ?, resolved_at = ? WHERE id = ?', [b.projectId, b.taskId, b.kind, b.description, b.who, b.status, b.resolvedAt, b.id]);
  }

  async getById(id: string): Promise<Blocker | null> {
    const row = await this.db.get<Row>('SELECT * FROM blockers WHERE id = ?', [id]);
    return row ? rowToBlocker(row) : null;
  }

  async list(options: { projectId?: string | null; taskId?: string | null; status?: 'open' | 'resolved' | 'all' } = {}): Promise<Blocker[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'open';
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.taskId) {
      where.push('task_id = ?');
      params.push(options.taskId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM blockers ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC`, params);
    return rows.map(rowToBlocker);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM blockers WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Meetings (§121–§123)
// ---------------------------------------------------------------------------

function rowToMeeting(r: Row): Meeting {
  return {
    id: String(r.id),
    projectId: nullable(r.project_id),
    title: String(r.title),
    date: String(r.date),
    time: nullable(r.time),
    participants: parseJson<string[]>(r.participants_json, []),
    notes: nullable(r.notes),
    summary: nullable(r.summary),
    processedAt: nullable(r.processed_at),
    eventId: nullable(r.event_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class MeetingRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(m: Meeting): Promise<void> {
    await this.db.run('INSERT INTO meetings (id, project_id, title, date, time, participants_json, notes, summary, processed_at, event_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      m.id, m.projectId, m.title, m.date, m.time, toJson(m.participants), m.notes, m.summary, m.processedAt, m.eventId, m.createdAt, m.updatedAt,
    ]);
  }

  async update(m: Meeting): Promise<void> {
    await this.db.run('UPDATE meetings SET project_id = ?, title = ?, date = ?, time = ?, participants_json = ?, notes = ?, summary = ?, processed_at = ?, event_id = ?, updated_at = ? WHERE id = ?', [
      m.projectId, m.title, m.date, m.time, toJson(m.participants), m.notes, m.summary, m.processedAt, m.eventId, m.updatedAt, m.id,
    ]);
  }

  async getById(id: string): Promise<Meeting | null> {
    const row = await this.db.get<Row>('SELECT * FROM meetings WHERE id = ?', [id]);
    return row ? rowToMeeting(row) : null;
  }

  async list(options: { projectId?: string | null; participant?: string | null; limit?: number } = {}): Promise<Meeting[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.participant) {
      where.push('(lower(participants_json) LIKE ? OR lower(title) LIKE ?)');
      const needle = `%${options.participant.toLowerCase()}%`;
      params.push(needle, needle);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM meetings ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, time DESC, created_at DESC LIMIT ?`, [...params, options.limit ?? 50]);
    return rows.map(rowToMeeting);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM meetings WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Suggestions (§121, §127)
// ---------------------------------------------------------------------------

function rowToSuggestion(r: Row): Suggestion {
  return {
    id: String(r.id),
    kind: String(r.kind) as SuggestionKind,
    title: String(r.title),
    payload: parseJson<Record<string, unknown>>(r.payload_json, {}),
    sourceType: String(r.source_type) as SourceType,
    sourceId: nullable(r.source_id),
    projectId: nullable(r.project_id),
    status: String(r.status) as SuggestionStatus,
    resultType: nullable(r.result_type),
    resultId: nullable(r.result_id),
    createdAt: String(r.created_at),
    resolvedAt: nullable(r.resolved_at),
  };
}

export class SuggestionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(s: Suggestion): Promise<void> {
    await this.db.run('INSERT INTO suggestions (id, kind, title, payload_json, source_type, source_id, project_id, status, result_type, result_id, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      s.id, s.kind, s.title, toJson(s.payload), s.sourceType, s.sourceId, s.projectId, s.status, s.resultType, s.resultId, s.createdAt, s.resolvedAt,
    ]);
  }

  async update(s: Suggestion): Promise<void> {
    await this.db.run('UPDATE suggestions SET kind = ?, title = ?, payload_json = ?, project_id = ?, status = ?, result_type = ?, result_id = ?, resolved_at = ? WHERE id = ?', [s.kind, s.title, toJson(s.payload), s.projectId, s.status, s.resultType, s.resultId, s.resolvedAt, s.id]);
  }

  async getById(id: string): Promise<Suggestion | null> {
    const row = await this.db.get<Row>('SELECT * FROM suggestions WHERE id = ?', [id]);
    return row ? rowToSuggestion(row) : null;
  }

  async getByIds(ids: string[]): Promise<Suggestion[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.all<Row>(`SELECT * FROM suggestions WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return rows.map(rowToSuggestion);
  }

  async list(options: { status?: SuggestionStatus | 'all'; sourceType?: SourceType | null; sourceId?: string | null; projectId?: string | null; kind?: SuggestionKind | null; limit?: number } = {}): Promise<Suggestion[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'proposed';
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.sourceType) {
      where.push('source_type = ?');
      params.push(options.sourceType);
    }
    if (options.sourceId) {
      where.push('source_id = ?');
      params.push(options.sourceId);
    }
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.kind) {
      where.push('kind = ?');
      params.push(options.kind);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM suggestions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToSuggestion);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM suggestions WHERE id = ?', [id]);
  }
}

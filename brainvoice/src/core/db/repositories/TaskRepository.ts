import { nullable, numberOrNull, parseJson, toJson, type SqlExecutor, type SqlValue } from '../SqlDriver';
import type { Task, TaskStatus } from '../../domain/entities';
import type { Priority } from '../../intent/schema';
import type { InputSource, Recurrence } from '../../types/common';

type Row = Record<string, SqlValue>;

function rowToTask(r: Row): Task {
  return {
    id: String(r.id),
    captureId: nullable(r.capture_id),
    parentTaskId: nullable(r.parent_task_id),
    title: String(r.title),
    description: nullable(r.description),
    dueDate: nullable(r.due_date),
    dueTime: nullable(r.due_time),
    dueAt: nullable(r.due_at),
    priority: String(r.priority) as Priority,
    status: String(r.status) as TaskStatus,
    category: nullable(r.category),
    tags: parseJson<string[]>(r.tags_json, []),
    people: parseJson<string[]>(r.people_json, []),
    listName: nullable(r.list_name),
    recurrence: parseJson<Recurrence | null>(r.recurrence_json, null),
    reminderAt: nullable(r.reminder_at),
    reminderNotificationId: nullable(r.reminder_notification_id),
    sortOrder: numberOrNull(r.sort_order) ?? 0,
    source: String(r.source) as InputSource,
    external: parseJson<{ provider: string; id: string } | null>(r.external_json, null),
    completedAt: nullable(r.completed_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    projectId: nullable(r.project_id),
    milestoneId: nullable(r.milestone_id),
    companyId: nullable(r.company_id),
    contactId: nullable(r.contact_id),
    assignee: nullable(r.assignee),
    owner: nullable(r.owner),
    dependsOn: parseJson<string[]>(r.depends_on_json, []),
    sourceType: nullable(r.source_type),
    sourceId: nullable(r.source_id),
    meetingId: nullable(r.meeting_id),
    emailId: nullable(r.email_id),
    documentId: nullable(r.document_id),
  };
}

const PM_COLUMNS = 'project_id, milestone_id, company_id, contact_id, assignee, owner, depends_on_json, source_type, source_id, meeting_id, email_id, document_id';

function pmValues(task: Task): SqlValue[] {
  return [task.projectId, task.milestoneId, task.companyId, task.contactId, task.assignee, task.owner, toJson(task.dependsOn), task.sourceType, task.sourceId, task.meetingId, task.emailId, task.documentId];
}

export type TaskView = 'inbox' | 'today' | 'tomorrow' | 'upcoming' | 'someday' | 'completed' | 'overdue' | 'all' | 'date';

export interface TaskListOptions {
  view: TaskView;
  /** ISO date for 'today' / 'tomorrow' / 'date' / 'upcoming' computations (device day). */
  today: string;
  date?: string;
  listName?: string | null;
  limit?: number;
}

export class TaskRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(task: Task): Promise<void> {
    await this.db.run(
      `INSERT INTO tasks (id, capture_id, parent_task_id, title, description, due_date, due_time, due_at, priority, status, category, tags_json, people_json, list_name, recurrence_json, reminder_at, reminder_notification_id, sort_order, source, external_json, completed_at, created_at, updated_at, ${PM_COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.captureId, task.parentTaskId, task.title, task.description, task.dueDate, task.dueTime, task.dueAt, task.priority, task.status, task.category, toJson(task.tags), toJson(task.people),
        task.listName, task.recurrence ? toJson(task.recurrence) : null, task.reminderAt, task.reminderNotificationId, task.sortOrder, task.source, task.external ? toJson(task.external) : null,
        task.completedAt, task.createdAt, task.updatedAt, ...pmValues(task),
      ],
    );
  }

  async update(task: Task): Promise<void> {
    await this.db.run(
      `UPDATE tasks SET parent_task_id = ?, title = ?, description = ?, due_date = ?, due_time = ?, due_at = ?, priority = ?, status = ?, category = ?, tags_json = ?, people_json = ?, list_name = ?, recurrence_json = ?, reminder_at = ?, reminder_notification_id = ?, sort_order = ?, external_json = ?, completed_at = ?, updated_at = ?,
         project_id = ?, milestone_id = ?, company_id = ?, contact_id = ?, assignee = ?, owner = ?, depends_on_json = ?, source_type = ?, source_id = ?, meeting_id = ?, email_id = ?, document_id = ? WHERE id = ?`,
      [
        task.parentTaskId, task.title, task.description, task.dueDate, task.dueTime, task.dueAt, task.priority, task.status, task.category, toJson(task.tags), toJson(task.people), task.listName,
        task.recurrence ? toJson(task.recurrence) : null, task.reminderAt, task.reminderNotificationId, task.sortOrder, task.external ? toJson(task.external) : null, task.completedAt, task.updatedAt,
        ...pmValues(task), task.id,
      ],
    );
  }

  /** Open top-level tasks of a project (or every project when null), oldest due first. */
  async listByProject(projectId: string | null, options: { status?: 'open' | 'done' | 'all'; limit?: number } = {}): Promise<Task[]> {
    const where: string[] = ['parent_task_id IS NULL'];
    const params: SqlValue[] = [];
    if (projectId) {
      where.push('project_id = ?');
      params.push(projectId);
    } else {
      where.push('project_id IS NOT NULL');
    }
    const status = options.status ?? 'open';
    if (status === 'open') where.push("status IN ('open', 'someday')");
    else if (status === 'done') where.push("status = 'done'");
    const rows = await this.db.all<Row>(`SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at ASC LIMIT ?`, [...params, options.limit ?? 500]);
    return rows.map(rowToTask);
  }

  async listCompletedBetween(fromISO: string, toISO: string, projectId: string | null = null): Promise<Task[]> {
    const params: SqlValue[] = [fromISO, toISO];
    let where = "status = 'done' AND completed_at >= ? AND completed_at < ?";
    if (projectId) {
      where += ' AND project_id = ?';
      params.push(projectId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM tasks WHERE ${where} ORDER BY completed_at DESC`, params);
    return rows.map(rowToTask);
  }

  async listDueBetween(fromDate: string, toDate: string): Promise<Task[]> {
    const rows = await this.db.all<Row>("SELECT * FROM tasks WHERE status = 'open' AND parent_task_id IS NULL AND due_date >= ? AND due_date <= ? ORDER BY due_date ASC, due_time ASC", [fromDate, toDate]);
    return rows.map(rowToTask);
  }

  /** Tasks whose people / assignee mention a person (case-insensitive substring). */
  async listMentioning(person: string, limit = 50): Promise<Task[]> {
    const needle = `%${person.toLowerCase()}%`;
    const rows = await this.db.all<Row>("SELECT * FROM tasks WHERE status IN ('open', 'someday') AND (lower(people_json) LIKE ? OR lower(assignee) LIKE ? OR lower(owner) LIKE ? OR lower(title) LIKE ?) ORDER BY due_date ASC LIMIT ?", [needle, needle, needle, needle, limit]);
    return rows.map(rowToTask);
  }

  async listBySource(sourceType: string, sourceId: string): Promise<Task[]> {
    const rows = await this.db.all<Row>('SELECT * FROM tasks WHERE source_type = ? AND source_id = ? ORDER BY created_at ASC', [sourceType, sourceId]);
    return rows.map(rowToTask);
  }

  async getById(id: string): Promise<Task | null> {
    const row = await this.db.get<Row>('SELECT * FROM tasks WHERE id = ?', [id]);
    return row ? rowToTask(row) : null;
  }

  async getByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.all<Row>(`SELECT * FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return rows.map(rowToTask);
  }

  async list(options: TaskListOptions): Promise<Task[]> {
    const where: string[] = ['parent_task_id IS NULL'];
    const params: SqlValue[] = [];
    const tomorrow = addDays(options.today, 1);
    switch (options.view) {
      case 'inbox':
        where.push("status = 'open' AND due_date IS NULL");
        break;
      case 'today':
        where.push("status = 'open' AND due_date IS NOT NULL AND due_date <= ?");
        params.push(options.today);
        break;
      case 'tomorrow':
        where.push("status = 'open' AND due_date = ?");
        params.push(tomorrow);
        break;
      case 'date':
        where.push("status = 'open' AND due_date = ?");
        params.push(options.date ?? options.today);
        break;
      case 'upcoming':
        where.push("status = 'open' AND due_date IS NOT NULL AND due_date > ?");
        params.push(options.today);
        break;
      case 'overdue':
        where.push("status = 'open' AND due_date IS NOT NULL AND due_date < ?");
        params.push(options.today);
        break;
      case 'someday':
        where.push("status = 'someday'");
        break;
      case 'completed':
        where.push("status = 'done'");
        break;
      case 'all':
      default:
        where.push("status IN ('open', 'someday')");
        break;
    }
    if (options.listName !== undefined) {
      if (options.listName === null) where.push('list_name IS NULL');
      else {
        where.push('list_name = ?');
        params.push(options.listName);
      }
    }
    const order = options.view === 'completed' ? 'completed_at DESC' : "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, due_date ASC, due_time ASC, sort_order ASC, created_at ASC";
    const rows = await this.db.all<Row>(`SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToTask);
  }

  async listOpen(limit = 500): Promise<Task[]> {
    const rows = await this.db.all<Row>("SELECT * FROM tasks WHERE status IN ('open', 'someday') ORDER BY updated_at DESC LIMIT ?", [limit]);
    return rows.map(rowToTask);
  }

  async listSubtasks(parentId: string): Promise<Task[]> {
    const rows = await this.db.all<Row>('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY sort_order ASC, created_at ASC', [parentId]);
    return rows.map(rowToTask);
  }

  async countByView(today: string): Promise<{ today: number; overdue: number; inbox: number; upcoming: number }> {
    const rows = await this.db.all<{ k: string; n: number }>(
      `SELECT 'today' AS k, COUNT(*) AS n FROM tasks WHERE status = 'open' AND parent_task_id IS NULL AND due_date = ?
       UNION ALL SELECT 'overdue', COUNT(*) FROM tasks WHERE status = 'open' AND parent_task_id IS NULL AND due_date < ?
       UNION ALL SELECT 'inbox', COUNT(*) FROM tasks WHERE status = 'open' AND parent_task_id IS NULL AND due_date IS NULL
       UNION ALL SELECT 'upcoming', COUNT(*) FROM tasks WHERE status = 'open' AND parent_task_id IS NULL AND due_date > ?`,
      [today, today, today],
    );
    const out = { today: 0, overdue: 0, inbox: 0, upcoming: 0 };
    for (const r of rows) out[r.k as keyof typeof out] = Number(r.n);
    return out;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM tasks WHERE id = ? OR parent_task_id = ?', [id, id]);
  }
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

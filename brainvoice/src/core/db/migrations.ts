import type { SqlDriver, SqlExecutor } from './SqlDriver';
import { DomainError } from '../types/common';

/**
 * Schema migrations. Append-only: never edit a released migration, add a new one.
 * Each migration runs inside a transaction; the applied version is stored in
 * `schema_migrations`. FTS5 is attempted separately with a LIKE-based fallback.
 */

/**
 * A statement is plain SQL that both engines accept, or one variant per dialect. The
 * Postgres driver additionally rewrites the SQLite idioms `INSERT OR IGNORE`,
 * `strftime('…','now')`, `json_extract` and `rowid` (see server/db/PostgresDriver.ts).
 */
export type MigrationStatement = string | { sqlite: string; postgres: string };

export interface Migration {
  version: number;
  name: string;
  statements: MigrationStatement[];
}

/** Tables ordered by insertion order use SQLite's implicit rowid; Postgres gets an explicit `seq BIGSERIAL`. */
function withSeq(sql: string): MigrationStatement {
  return { sqlite: sql, postgres: sql.replace(/\(\s*\n\s*id TEXT PRIMARY KEY,/, '(\n        seq BIGSERIAL,\n        id TEXT PRIMARY KEY,') };
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        original_text TEXT NOT NULL,
        cleaned_text TEXT NOT NULL,
        transcript TEXT,
        language TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        due_at TEXT,
        scheduled_at TEXT,
        completed_at TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        category TEXT,
        source TEXT NOT NULL,
        linked_items_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        processed INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        batch_id TEXT,
        command_id TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed, archived)',
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        type TEXT NOT NULL DEFAULT 'NOTE',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        folder TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        people_json TEXT NOT NULL DEFAULT '[]',
        favorite INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(archived, updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category)',
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        parent_task_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        due_time TEXT,
        due_at TEXT,
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'open',
        category TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        people_json TEXT NOT NULL DEFAULT '[]',
        list_name TEXT,
        recurrence_json TEXT,
        reminder_at TEXT,
        reminder_notification_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'text',
        external_json TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)',
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        title TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        all_day INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        notes TEXT,
        calendar_id TEXT,
        external_id TEXT,
        alerts_json TEXT NOT NULL DEFAULT '[]',
        recurrence_json TEXT,
        people_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_events_start ON events(deleted_at, start_at)',
      'CREATE INDEX IF NOT EXISTS idx_events_external ON events(external_id)',
      `CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        title TEXT NOT NULL,
        notes TEXT,
        due_at TEXT NOT NULL,
        recurrence_json TEXT,
        backend TEXT NOT NULL DEFAULT 'none',
        external_id TEXT,
        notification_id TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(completed_at, due_at)',
      `CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        kind TEXT NOT NULL,
        label TEXT,
        fire_at TEXT,
        duration_seconds INTEGER,
        recurrence_json TEXT,
        backend TEXT NOT NULL,
        external_id TEXT,
        notification_id TEXT,
        can_cancel INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'scheduled',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS item_tags (
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (item_type, item_id, tag_id)
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        icon TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS item_links (
        from_type TEXT NOT NULL,
        from_id TEXT NOT NULL,
        to_type TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT 'related',
        created_at TEXT NOT NULL,
        PRIMARY KEY (from_type, from_id, to_type, to_id)
      )`,
      `CREATE TABLE IF NOT EXISTS action_history (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        intent TEXT NOT NULL,
        command_json TEXT NOT NULL,
        original_text TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        external_ids_json TEXT NOT NULL DEFAULT '{}',
        undo_status TEXT NOT NULL,
        undone_at TEXT,
        result_json TEXT,
        error_message TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_history_executed ON action_history(executed_at DESC)',
      `CREATE TABLE IF NOT EXISTS conversation_context (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS external_integrations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        capture_id TEXT,
        text TEXT NOT NULL,
        transcript TEXT,
        language TEXT NOT NULL,
        source TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        next_attempt_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    name: 'seed_categories',
    statements: [
      ...['Work', 'Personal', 'Business', 'Shopping', 'Ideas', 'People', 'Finance', 'Health', 'Travel', 'Uncategorized'].map(
        (name, index) =>
          `INSERT OR IGNORE INTO categories (id, name, icon, color, sort_order, is_default, created_at) VALUES ('cat_${name.toLowerCase()}', '${name}', NULL, NULL, ${index}, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      ),
    ],
  },
  {
    // Administrative assistant & project manager (spec §94–§140).
    version: 3,
    name: 'admin_and_projects',
    statements: [
      // Tasks gain project-management links (§115, §117).
      ...['project_id TEXT', 'milestone_id TEXT', 'company_id TEXT', 'contact_id TEXT', 'assignee TEXT', 'owner TEXT', "depends_on_json TEXT NOT NULL DEFAULT '[]'", 'source_type TEXT', 'source_id TEXT', 'meeting_id TEXT', 'email_id TEXT', 'document_id TEXT'].map(
        (column) => `ALTER TABLE tasks ADD COLUMN ${column}`,
      ),
      'CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status)',
      `CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        legal_name TEXT,
        kind TEXT NOT NULL DEFAULT 'client',
        vat_number TEXT,
        company_number TEXT,
        address_json TEXT NOT NULL DEFAULT '{}',
        email TEXT,
        phone TEXT,
        payment_terms_days INTEGER,
        default_tax_rate REAL,
        iban TEXT,
        notes TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(archived, name COLLATE NOCASE)',
      `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT,
        audience TEXT,
        style_preference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email COLLATE NOCASE)',
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        invoice_number TEXT,
        company_id TEXT,
        counterparty_name TEXT NOT NULL DEFAULT '',
        counterparty_vat TEXT,
        counterparty_address_json TEXT,
        issue_date TEXT,
        due_date TEXT,
        service_period_start TEXT,
        service_period_end TEXT,
        currency TEXT NOT NULL DEFAULT 'EUR',
        status TEXT NOT NULL,
        lines_json TEXT NOT NULL DEFAULT '[]',
        subtotal_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL DEFAULT 0,
        payment_reference TEXT,
        iban TEXT,
        bic TEXT,
        description TEXT,
        notes TEXT,
        project_id TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        source_ref TEXT,
        document_id TEXT,
        extraction_json TEXT,
        paid_at TEXT,
        paid_amount_cents INTEGER,
        pdf_uri TEXT,
        reminder_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(direction, status, due_date)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id)',
      // Outgoing invoice numbers are unique per direction; the counter table makes them transactional (§104).
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_outgoing_number ON invoices(invoice_number) WHERE direction = 'outgoing' AND invoice_number IS NOT NULL",
      `CREATE TABLE IF NOT EXISTS invoice_counters (
        series TEXT PRIMARY KEY,
        last_number INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        merchant TEXT NOT NULL,
        date TEXT,
        amount_cents INTEGER NOT NULL,
        tax_cents INTEGER,
        currency TEXT NOT NULL DEFAULT 'EUR',
        category TEXT,
        payment_method TEXT,
        project_id TEXT,
        company_id TEXT,
        description TEXT,
        receipt_document_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        extraction_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC)',
      `CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        project_id TEXT,
        company_id TEXT,
        description TEXT,
        minutes INTEGER NOT NULL,
        billable INTEGER NOT NULL DEFAULT 1,
        rate_cents INTEGER,
        rate_unit TEXT NOT NULL DEFAULT 'day',
        status TEXT NOT NULL DEFAULT 'approved',
        invoice_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date, project_id, company_id)',
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        sender TEXT,
        recipient TEXT,
        date TEXT,
        expiry_date TEXT,
        contact_id TEXT,
        company_id TEXT,
        project_id TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        attachment_uri TEXT,
        mime_type TEXT,
        extracted_text TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        reminder_id TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(archived, expiry_date)',
      'CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(archived, type)',
      `CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        who TEXT,
        contact_id TEXT,
        company_id TEXT,
        project_id TEXT,
        expected_date TEXT,
        source_type TEXT,
        source_id TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status, expected_date)',
      `CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        thread_id TEXT,
        account TEXT,
        from_json TEXT NOT NULL,
        to_json TEXT NOT NULL DEFAULT '[]',
        cc_json TEXT NOT NULL DEFAULT '[]',
        subject TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        snippet TEXT NOT NULL DEFAULT '',
        received_at TEXT NOT NULL,
        is_from_me INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0,
        analysis_json TEXT,
        replied_at TEXT,
        handled_at TEXT,
        contact_id TEXT,
        company_id TEXT,
        project_id TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(archived, received_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id)',
      'CREATE INDEX IF NOT EXISTS idx_emails_external ON emails(external_id)',
      `CREATE TABLE IF NOT EXISTS email_drafts (
        id TEXT PRIMARY KEY,
        reply_to_email_id TEXT,
        to_json TEXT NOT NULL DEFAULT '[]',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        style TEXT,
        instruction TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        company_id TEXT,
        goal TEXT,
        deliverables_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, name COLLATE NOCASE)',
      `CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        target_date TEXT,
        status TEXT NOT NULL DEFAULT 'planned',
        owner TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        depends_on_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, sort_order)',
      `CREATE TABLE IF NOT EXISTS project_risks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL DEFAULT 'medium',
        likelihood TEXT NOT NULL DEFAULT 'medium',
        mitigation TEXT,
        owner TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        decision TEXT NOT NULL,
        reason TEXT,
        decided_on TEXT NOT NULL,
        participants_json TEXT NOT NULL DEFAULT '[]',
        meeting_id TEXT,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, decided_on DESC)',
      `CREATE TABLE IF NOT EXISTS blockers (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        task_id TEXT,
        kind TEXT NOT NULL DEFAULT 'other',
        description TEXT NOT NULL,
        who TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status, project_id)',
      `CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        participants_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        summary TEXT,
        processed_at TEXT,
        event_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC)',
      `CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        source_type TEXT NOT NULL,
        source_id TEXT,
        project_id TEXT,
        status TEXT NOT NULL DEFAULT 'proposed',
        result_type TEXT,
        result_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        trigger_json TEXT NOT NULL,
        conditions_json TEXT NOT NULL DEFAULT '[]',
        steps_json TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1,
        built_in INTEGER NOT NULL DEFAULT 0,
        source_text TEXT,
        last_run_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        event_summary TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        log_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs ON workflow_runs(workflow_id, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        permission TEXT NOT NULL,
        args_summary TEXT NOT NULL DEFAULT '',
        args_hash TEXT NOT NULL DEFAULT '',
        confirmed INTEGER NOT NULL DEFAULT 0,
        ok INTEGER NOT NULL DEFAULT 1,
        error TEXT,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)',
      // Built-in workflow (§129): incoming invoice with a due date → reminder 3 days before.
      `INSERT OR IGNORE INTO workflows (id, name, description, trigger_json, conditions_json, steps_json, enabled, built_in, source_text, last_run_at, created_at, updated_at)
       VALUES ('wf_invoice_reminder', 'Invoice payment reminder', 'When an incoming invoice with a due date is stored, remind me three days before it is due.',
       '{"type":"invoice.received"}', '[{"field":"invoice.dueDate","op":"exists"}]', '[{"action":"link_counterparty"},{"action":"create_reminder","dateField":"invoice.dueDate","offsetDays":-3}]',
       1, 1, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    ],
  },
  {
    // Alfred operations layer (spec §141–§181): tickets, durable jobs, approvals, questions,
    // workers, outbox, schedules, notifications, briefings, cost, push tokens, CRM, advisory.
    version: 4,
    name: 'alfred_operations',
    statements: [
      `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'INBOX',
        priority TEXT NOT NULL DEFAULT 'NORMAL',
        role TEXT NOT NULL DEFAULT 'CHIEF_OF_STAFF',
        routing_reason TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        source_ref TEXT,
        parent_id TEXT,
        project_id TEXT,
        email_id TEXT,
        company_id TEXT,
        idempotency_key TEXT,
        assigned_worker TEXT,
        due_at TEXT,
        scheduled_for TEXT,
        pickup_deadline_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        result_json TEXT,
        failure_reason TEXT,
        blocked_reason TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        language TEXT NOT NULL DEFAULT 'en',
        context_json TEXT NOT NULL DEFAULT '{}',
        plan_json TEXT NOT NULL DEFAULT '[]',
        cost_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_idempotency ON tickets(idempotency_key) WHERE idempotency_key IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_pickup ON tickets(status, pickup_deadline_at)',
      withSeq(`CREATE TABLE IF NOT EXISTS ticket_events (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        actor TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`),
      'CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events(ticket_id, created_at ASC)',
      'CREATE INDEX IF NOT EXISTS idx_ticket_events_created ON ticket_events(created_at DESC)',
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'queued',
        priority INTEGER NOT NULL DEFAULT 0,
        run_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        last_error TEXT,
        locked_by TEXT,
        locked_until TEXT,
        idempotency_key TEXT,
        ticket_id TEXT,
        schedule_id TEXT,
        result_json TEXT,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        permanent_failure INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      )`,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, run_at, priority DESC)',
      'CREATE INDEX IF NOT EXISTS idx_jobs_ticket ON jobs(ticket_id)',
      'CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type, status)',
      `CREATE TABLE IF NOT EXISTS job_attempts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        worker_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        ok INTEGER,
        error TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON job_attempts(job_id, attempt)',
      `CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        job_id TEXT,
        kind TEXT NOT NULL DEFAULT 'tool',
        tool TEXT NOT NULL,
        args_json TEXT NOT NULL DEFAULT '{}',
        permission TEXT NOT NULL,
        card_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        edit_instruction TEXT,
        decision_note TEXT,
        notes_json TEXT NOT NULL DEFAULT '[]',
        superseded_by_id TEXT,
        expires_at TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_approvals_ticket ON approvals(ticket_id)',
      `CREATE TABLE IF NOT EXISTS agent_questions (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        question TEXT NOT NULL,
        context TEXT,
        options_json TEXT NOT NULL DEFAULT '[]',
        allow_free_text INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'OPEN',
        answer_text TEXT,
        answer_option_id TEXT,
        created_at TEXT NOT NULL,
        answered_at TEXT,
        expires_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_questions_status ON agent_questions(status, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_questions_ticket ON agent_questions(ticket_id)',
      `CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        host TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        current_job_id TEXT,
        last_seen_at TEXT NOT NULL,
        started_at TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        version TEXT NOT NULL DEFAULT ''
      )`,
      withSeq(`CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        published_at TEXT
      )`),
      'CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status, created_at ASC)',
      `CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        spec_json TEXT NOT NULL,
        timezone TEXT,
        job_type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        built_in INTEGER NOT NULL DEFAULT 0,
        next_run_at TEXT,
        last_run_at TEXT,
        last_job_id TEXT,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        source_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_schedules_next ON schedules(enabled, next_run_at)',
      `CREATE TABLE IF NOT EXISTS ops_notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        detail TEXT,
        data_json TEXT NOT NULL DEFAULT '{}',
        read_at TEXT,
        created_at TEXT NOT NULL,
        delivered_at TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_ops_notifications_created ON ops_notifications(created_at DESC)',
      `CREATE TABLE IF NOT EXISTS briefings (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        date TEXT NOT NULL,
        language TEXT NOT NULL,
        sections_json TEXT NOT NULL DEFAULT '[]',
        text TEXT NOT NULL DEFAULT '',
        deliveries_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_briefings_kind_date ON briefings(kind, date)',
      `CREATE TABLE IF NOT EXISTS cost_entries (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        job_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_cost_created ON cost_entries(created_at DESC)',
      `CREATE TABLE IF NOT EXISTS push_tokens (
        token TEXT PRIMARY KEY,
        platform TEXT NOT NULL DEFAULT 'unknown',
        device_name TEXT,
        registered_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      )`,
      withSeq(`CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        contact_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        source_type TEXT,
        source_id TEXT,
        created_at TEXT NOT NULL
      )`),
      'CREATE INDEX IF NOT EXISTS idx_interactions_company ON interactions(company_id, occurred_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_interactions_source ON interactions(source_type, source_id)',
      `CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        quote_number TEXT,
        company_id TEXT,
        contact_id TEXT,
        counterparty_name TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        lines_json TEXT NOT NULL DEFAULT '[]',
        subtotal_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        status TEXT NOT NULL DEFAULT 'draft',
        valid_until TEXT,
        notes TEXT,
        project_id TEXT,
        invoice_id TEXT,
        sent_at TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number) WHERE quote_number IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status, updated_at DESC)',
      `CREATE TABLE IF NOT EXISTS sequence_counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS advisory_sessions (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        question TEXT NOT NULL,
        brief TEXT NOT NULL DEFAULT '',
        perspectives_json TEXT NOT NULL DEFAULT '[]',
        synthesis_json TEXT NOT NULL DEFAULT '{}',
        method TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      // Email monitoring (§160–§161): triage result, dedup hash and the provider that delivered the message.
      'ALTER TABLE emails ADD COLUMN triage_json TEXT',
      'ALTER TABLE emails ADD COLUMN triaged_at TEXT',
      'ALTER TABLE emails ADD COLUMN processed_at TEXT',
      'ALTER TABLE emails ADD COLUMN content_hash TEXT',
      'ALTER TABLE emails ADD COLUMN provider_id TEXT',
      'CREATE INDEX IF NOT EXISTS idx_emails_content_hash ON emails(content_hash)',
      'CREATE INDEX IF NOT EXISTS idx_emails_triage ON emails(triaged_at, archived)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_external_unique ON emails(external_id) WHERE external_id IS NOT NULL',
      // Waiting-for extension (§159): since when, last interaction, linked email.
      'ALTER TABLE follow_ups ADD COLUMN since TEXT',
      'ALTER TABLE follow_ups ADD COLUMN last_interaction_at TEXT',
      'ALTER TABLE follow_ups ADD COLUMN email_id TEXT',
      // Built-in schedules (§164). timezone NULL = the host clock's zone; next_run_at is computed on the first tick.
      ...[
        ['sched_email_poll', 'Mailbox check', '{"kind":"interval","everyMinutes":15}', 'email.poll'],
        ['sched_morning_briefing', 'Morning briefing', '{"kind":"daily","at":"08:00"}', 'briefing.morning'],
        ['sched_evening_review', 'Evening review', '{"kind":"daily","at":"18:00"}', 'briefing.evening'],
        ['sched_night_shift', 'Night shift', '{"kind":"daily","at":"23:00"}', 'night_shift.run'],
        ['sched_ticket_sla', 'Ticket pickup', '{"kind":"interval","everyMinutes":5}', 'ticket.sla_check'],
        ['sched_followup_scan', 'Waiting-for scan', '{"kind":"daily","at":"09:00"}', 'followup.scan'],
        ['sched_outbox', 'Event dispatch', '{"kind":"interval","everyMinutes":1}', 'outbox.publish'],
        ['sched_maintenance', 'Maintenance sweep', '{"kind":"interval","everyMinutes":5}', 'maintenance.sweep'],
        ['sched_crm_scan', 'CRM scan', '{"kind":"weekly","at":"08:30","weekdays":[1]}', 'crm.scan'],
      ].map(
        ([id, name, spec, jobType]) =>
          `INSERT OR IGNORE INTO schedules (id, name, spec_json, timezone, job_type, payload_json, enabled, built_in, next_run_at, last_run_at, last_job_id, max_attempts, source_text, created_at, updated_at)
           VALUES ('${id}', '${name}', '${spec}', NULL, '${jobType}', '{}', 1, 1, NULL, NULL, NULL, 3, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      ),
    ],
  },
  {
    // Connected Alfred (central source of truth): resumable workflow runs with durable approvals,
    // server-side provider credentials (encrypted at rest) and OAuth state.
    version: 5,
    name: 'alfred_connected',
    statements: [
      "ALTER TABLE workflow_runs ADD COLUMN event_json TEXT NOT NULL DEFAULT '{}'",
      "ALTER TABLE workflow_runs ADD COLUMN steps_json TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE workflow_runs ADD COLUMN next_step INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE workflow_runs ADD COLUMN workflow_name TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE workflow_runs ADD COLUMN approval_id TEXT',
      'ALTER TABLE workflow_runs ADD COLUMN ticket_id TEXT',
      'ALTER TABLE workflow_runs ADD COLUMN updated_at TEXT',
      'CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS provider_credentials (
        provider TEXT PRIMARY KEY,
        secret_enc TEXT NOT NULL,
        meta_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
    ],
  },
];

/** FTS5 index over notes, tasks, captures. Attempted separately because FTS5 may be unavailable. */
export const FTS_CREATE = `CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  item_id UNINDEXED,
  item_type UNINDEXED,
  title,
  content,
  tags,
  people,
  tokenize = 'unicode61 remove_diacritics 2'
)`;

export const FTS_FALLBACK_CREATE = `CREATE TABLE IF NOT EXISTS search_index_plain (
  item_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,
  people TEXT NOT NULL
)`;

export interface MigrationResult {
  appliedVersions: number[];
  currentVersion: number;
  fts5: boolean;
}

async function ensureMigrationsTable(db: SqlExecutor): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
}

export async function runMigrations(driver: SqlDriver): Promise<MigrationResult> {
  try {
    await driver.exec('PRAGMA journal_mode = WAL');
  } catch {
    // WAL is unavailable on some file systems (and irrelevant in-memory); not fatal.
  }
  await ensureMigrationsTable(driver);
  const appliedVersions: number[] = [];

  const applyPending = async (tx: SqlExecutor): Promise<void> => {
    const rows = await tx.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
    const applied = new Set(rows.map((r) => Number(r.version)));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      try {
        for (const statement of migration.statements) await tx.exec(typeof statement === 'string' ? statement : statement[driver.dialect]);
        await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [migration.version, migration.name, new Date().toISOString()]);
        appliedVersions.push(migration.version);
      } catch (e) {
        throw new DomainError('DB_MIGRATION_FAILED', `Migration ${migration.version} (${migration.name}) failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e, details: { version: migration.version } });
      }
    }
  };

  if (driver.dialect === 'postgres') {
    // Several processes (API, worker, scheduler) may start at once: one transaction-scoped advisory
    // lock serialises them, and the version check happens inside the lock.
    await driver.transaction(async (tx) => {
      await tx.exec('SELECT pg_advisory_xact_lock(727031)');
      await applyPending(tx);
    });
  } else {
    await driver.transaction(applyPending);
  }

  let fts5 = false;
  try {
    await driver.exec(FTS_CREATE);
    fts5 = true;
  } catch {
    await driver.exec(FTS_FALLBACK_CREATE);
  }
  await driver.run("INSERT INTO settings (key, value, updated_at) VALUES ('db.fts5', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [fts5 ? '1' : '0', new Date().toISOString()]);

  const current = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
  return { appliedVersions, currentVersion: current, fts5 };
}

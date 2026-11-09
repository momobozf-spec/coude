import { DateTime } from 'luxon';

import type { CompanyService } from './CompanyService';
import type { FollowUpService } from './FollowUpService';
import type { ReminderScheduler } from './ReminderScheduler';
import type { Database } from '../../db/Database';
import type { Workflow, WorkflowCondition, WorkflowRun, WorkflowStep, WorkflowTrigger, WorkflowTriggerType } from '../../domain/admin';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import { parseRecurringText, parseWorkflowText, type ParsedWorkflow, type RecurringAdminPlan } from '../../workflow/parse';
import type { Clock } from '../Clock';
import type { TaskService } from '../TaskService';

export interface WorkflowEvent {
  type: WorkflowTriggerType;
  /** Event payload addressed by conditions/steps, e.g. { invoice: {...} }. */
  payload: Record<string, unknown>;
  summary: string;
}

export interface WorkflowInput {
  name: string;
  description?: string | null;
  trigger: WorkflowTrigger;
  conditions?: WorkflowCondition[];
  steps: WorkflowStep[];
  enabled?: boolean;
  sourceText?: string | null;
}

export type { ParsedWorkflow, RecurringAdminPlan };

export interface WorkflowGateParams {
  run: WorkflowRun;
  workflow: Pick<Workflow, 'id' | 'name'>;
  step: Extract<WorkflowStep, { action: 'require_approval' }>;
  event: WorkflowEvent;
  remaining: WorkflowStep[];
}

export type WorkflowApprovalGate = (params: WorkflowGateParams) => Promise<{ ticketId: string | null }>;

/**
 * Lightweight workflow engine (§128–§130): triggers → conditions → steps, with runs
 * logged. Natural-language configuration lives in `workflow/parse.ts`; the LLM can
 * produce the same `WorkflowInput` shape later.
 */
export class WorkflowService {
  private approvalGate: WorkflowApprovalGate | null = null;

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: { tasks: TaskService; followUps: FollowUpService; companies: CompanyService; reminders: () => ReminderScheduler; markEmailHandled: (emailId: string) => Promise<void> },
  ) {}

  list(): Promise<Workflow[]> {
    return this.db.workflows.list();
  }

  get(id: string): Promise<Workflow | null> {
    return this.db.workflows.getById(id);
  }

  async create(input: WorkflowInput): Promise<Workflow> {
    const now = this.clock.nowISO();
    const workflow: Workflow = { id: newId(), name: input.name.trim(), description: input.description ?? null, trigger: input.trigger, conditions: input.conditions ?? [], steps: input.steps, enabled: input.enabled ?? true, builtIn: false, sourceText: input.sourceText ?? null, lastRunAt: null, createdAt: now, updatedAt: now };
    if (workflow.steps.length === 0) throw new DomainError('INVALID_ARGUMENTS', 'A workflow needs at least one step');
    await this.db.workflows.insert(workflow);
    return workflow;
  }

  async setEnabled(id: string, enabled: boolean): Promise<Workflow> {
    const workflow = await this.db.workflows.getById(id);
    if (!workflow) throw new DomainError('NOT_FOUND', 'Workflow not found');
    const next = { ...workflow, enabled, updatedAt: this.clock.nowISO() };
    await this.db.workflows.update(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await this.db.workflows.delete(id);
  }

  listRuns(limit = 50): Promise<WorkflowRun[]> {
    return this.db.workflowRuns.listRecent(limit);
  }

  parseWorkflowText(text: string, language: Language): ParsedWorkflow | null {
    return parseWorkflowText(text, language);
  }

  parseRecurringText(text: string, language: Language): RecurringAdminPlan | null {
    return parseRecurringText(text, language, this.clock.now(), this.clock.timezone());
  }

  /** Creates the recurring task for a parsed recurring-administration sentence (§130). */
  async createRecurringTask(plan: RecurringAdminPlan): Promise<{ id: string; title: string; dueDate: string | null }> {
    const task = await this.deps.tasks.create({ title: plan.title, dueDate: plan.firstDate, recurrence: plan.recurrence, category: 'Finance', sourceType: 'workflow', sourceId: null });
    return { id: task.id, title: task.title, dueDate: task.dueDate };
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /** The operations layer installs this: a `require_approval` step becomes a durable approval card (§Phase 3). */
  setApprovalGate(gate: WorkflowApprovalGate | null): void {
    this.approvalGate = gate;
  }

  async emit(event: WorkflowEvent): Promise<WorkflowRun[]> {
    const workflows = (await this.db.workflows.list({ enabledOnly: true })).filter((w) => w.trigger.type === event.type);
    const runs: WorkflowRun[] = [];
    for (const workflow of workflows) runs.push(await this.runWorkflow(workflow, event));
    return runs;
  }

  getRun(id: string): Promise<WorkflowRun | null> {
    return this.db.workflowRuns.getById(id);
  }

  listWaitingRuns(): Promise<WorkflowRun[]> {
    return this.db.workflowRuns.listByStatus('waiting_approval');
  }

  /** Continues a run that paused at an approval step; only called from the approved `workflow.resume` tool. */
  async resumeRun(runId: string, actor = 'approval'): Promise<WorkflowRun> {
    const run = await this.db.workflowRuns.getById(runId);
    if (!run) throw new DomainError('NOT_FOUND', `Workflow run ${runId} not found`);
    if (run.status !== 'waiting_approval') throw new DomainError('TICKET_STATE', `Workflow run is ${run.status}, not waiting for approval`);
    run.log.push(`resumed by ${actor}`);
    const workflow = (await this.db.workflows.getById(run.workflowId)) ?? { id: run.workflowId, name: run.workflowName };
    return this.executeFrom(run, workflow);
  }

  async cancelRun(runId: string, reason: string): Promise<WorkflowRun | null> {
    const run = await this.db.workflowRuns.getById(runId);
    if (!run || run.status !== 'waiting_approval') return run;
    run.status = 'skipped';
    run.log.push(`cancelled: ${reason}`);
    run.updatedAt = this.clock.nowISO();
    await this.db.workflowRuns.update(run);
    return run;
  }

  private async runWorkflow(workflow: Workflow, event: WorkflowEvent): Promise<WorkflowRun> {
    const now = this.clock.nowISO();
    const run: WorkflowRun = { id: newId(), workflowId: workflow.id, workflowName: workflow.name, triggerType: event.type, eventSummary: event.summary, status: 'completed', log: [], eventPayload: event.payload, steps: workflow.steps, nextStep: 0, approvalId: null, ticketId: null, createdAt: now, updatedAt: now };
    await this.db.workflows.update({ ...workflow, lastRunAt: now });
    if (!workflow.conditions.every((c) => evaluateCondition(c, event.payload))) {
      run.status = 'skipped';
      run.log.push('conditions not met');
      await this.db.workflowRuns.insert(run);
      return run;
    }
    await this.db.workflowRuns.insert(run);
    return this.executeFrom(run, workflow);
  }

  /** Executes steps from `run.nextStep`; persists after every state change so a restart never loses the position. */
  private async executeFrom(run: WorkflowRun, workflow: Pick<Workflow, 'id' | 'name'>): Promise<WorkflowRun> {
    const event: WorkflowEvent = { type: run.triggerType, payload: run.eventPayload, summary: run.eventSummary };
    let index = run.nextStep;
    let status: WorkflowRun['status'] = 'completed';
    while (index < run.steps.length) {
      const step = run.steps[index]!;
      try {
        if (step.action === 'require_approval') {
          run.log.push(`require_approval: ${step.message}`);
          run.status = 'waiting_approval';
          run.nextStep = index + 1;
          run.updatedAt = this.clock.nowISO();
          await this.db.workflowRuns.update(run);
          if (this.approvalGate) {
            const gate = await this.approvalGate({ run, workflow, step, event, remaining: run.steps.slice(index + 1) });
            run.ticketId = gate.ticketId;
            run.updatedAt = this.clock.nowISO();
            await this.db.workflowRuns.update(run);
          } else {
            run.log.push('no approval gate installed – waiting without a card');
            await this.db.workflowRuns.update(run);
          }
          return run;
        }
        run.log.push(await this.runStep(step, event, workflow));
        index++;
      } catch (e) {
        status = 'failed';
        run.log.push(`${step.action}: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
    run.status = status;
    run.nextStep = index;
    run.updatedAt = this.clock.nowISO();
    await this.db.workflowRuns.update(run);
    return run;
  }

  private async runStep(step: WorkflowStep, event: WorkflowEvent, workflow: Pick<Workflow, 'id' | 'name'>): Promise<string> {
    const zone = this.clock.timezone();
    const dateAt = (field: string | undefined, offsetDays: number | undefined): string | null => {
      if (!field) return null;
      const raw = getPath(event.payload, field);
      if (typeof raw !== 'string' || !raw) return null;
      const dt = DateTime.fromISO(raw, { zone });
      return dt.isValid ? (dt.plus({ days: offsetDays ?? 0 }).toISODate() ?? null) : null;
    };
    switch (step.action) {
      case 'create_reminder': {
        const date = dateAt(step.dateField, step.offsetDays);
        if (!date) return 'create_reminder: no date, skipped';
        let fire: DateTime = DateTime.fromISO(date, { zone }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
        if (fire < this.clock.now()) fire = this.clock.now().plus({ minutes: 5 });
        const title = interpolate(step.title ?? `${workflow.name}: ${event.summary}`, event.payload);
        const { reminderId } = await this.deps.reminders()({ title, dueISO: fire.toISO({ suppressMilliseconds: true }) ?? date });
        return `create_reminder: ${reminderId} at ${fire.toISODate()}`;
      }
      case 'create_task': {
        const task = await this.deps.tasks.create({ title: interpolate(step.title, event.payload), dueDate: dateAt(step.dateField, step.offsetDays), projectId: step.projectId ?? null, sourceType: 'workflow', sourceId: workflow.id });
        return `create_task: ${task.id}`;
      }
      case 'create_follow_up': {
        const followUp = await this.deps.followUps.create({ kind: step.kind, title: interpolate(step.title, event.payload), who: step.who ? interpolate(step.who, event.payload) : null, expectedDate: dateAt(step.dateField, step.offsetDays), sourceType: 'workflow', sourceId: workflow.id });
        return `create_follow_up: ${followUp.id}`;
      }
      case 'link_counterparty': {
        const invoiceId = getPath(event.payload, 'invoice.id');
        if (typeof invoiceId !== 'string') return 'link_counterparty: no invoice';
        const invoice = await this.db.invoices.getById(invoiceId);
        if (!invoice || invoice.companyId) return 'link_counterparty: already linked';
        const company = await this.deps.companies.matchCounterparty({ name: invoice.counterpartyName, iban: invoice.iban, vatNumber: invoice.counterpartyVat });
        if (!company) return 'link_counterparty: no match';
        await this.db.invoices.update({ ...invoice, companyId: company.id, updatedAt: this.clock.nowISO() });
        return `link_counterparty: ${company.name}`;
      }
      case 'mark_email_handled': {
        const emailId = getPath(event.payload, 'email.id') ?? getPath(event.payload, 'invoice.sourceRef');
        if (typeof emailId !== 'string') return 'mark_email_handled: no email';
        await this.deps.markEmailHandled(emailId);
        return `mark_email_handled: ${emailId}`;
      }
      case 'notify':
        return `notify: ${interpolate(step.title, event.payload)}`;
      case 'require_approval':
        return `require_approval: ${step.message}`;
      case 'generate_invoice_draft':
        return 'generate_invoice_draft: use the timesheet invoice tool';
      default:
        return 'unknown step';
    }
  }
}

export function getPath(payload: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), payload);
}

export function evaluateCondition(condition: WorkflowCondition, payload: Record<string, unknown>): boolean {
  const value = getPath(payload, condition.field);
  switch (condition.op) {
    case 'exists':
      return value !== undefined && value !== null && value !== '';
    case 'missing':
      return value === undefined || value === null || value === '';
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'gt':
      return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
    case 'lt':
      return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
    case 'contains':
      return typeof value === 'string' && typeof condition.value === 'string' && value.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}

function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{([\w.]+)\}/g, (_, path: string) => {
    const v = getPath(payload, path);
    return v === undefined || v === null ? '' : String(v);
  });
}

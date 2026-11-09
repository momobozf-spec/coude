import type { z } from 'zod';

import type { ButlerAdapters } from './adapters';
import { getTool, type ToolArgs, type ToolDefinition, type ToolName } from './catalog';
import type { ButlerFocus, FocusPatch } from './focus';
import type { ToolPayload } from './payloads';
import type { InvoiceStatus, ToolPermission } from '../domain/admin';
import type { ItemRef } from '../domain/entities';
import type { Logger } from '../logging/logger';
import type { OpsServices } from '../ops';
import type { Clock } from '../services/Clock';
import type { CoreServices } from '../services';
import { DomainError, type Language } from '../types/common';

/**
 * ToolRegistry – binds handlers to catalog definitions and executes them with
 * validation, permission gating and audit logging (§134, §138). It is the only
 * place where a Butler capability runs; the ActionRouter calls it for BUTLER_TOOL
 * commands after the user confirmed the preview.
 */

export interface ToolContext {
  services: CoreServices;
  adapters: ButlerAdapters;
  clock: Clock;
  language: Language;
  focus: ButlerFocus;
  /** True when the user explicitly confirmed this execution in the preview. */
  confirmed: boolean;
  batchId: string;
  originalText: string;
  logger?: Logger;
  /** Operations layer (tickets, approvals, schedules…); absent in minimal setups. */
  ops?: OpsServices | null;
}

/** How to reverse a tool execution; stored in the action history. */
export type ToolUndo =
  | { kind: 'delete'; entity: 'task' | 'follow_up' | 'risk' | 'decision' | 'blocker' | 'milestone' | 'time_entry' | 'expense' | 'document' | 'company' | 'contact' | 'project' | 'meeting' | 'workflow' | 'email' | 'reminder'; id: string }
  | { kind: 'invoice_cancel_draft'; id: string }
  | { kind: 'invoice_unpay'; id: string }
  | { kind: 'invoice_status'; id: string; status: InvoiceStatus }
  | { kind: 'followup_reopen'; id: string }
  | { kind: 'blocker_reopen'; id: string }
  | { kind: 'email_unhandled'; id: string }
  | { kind: 'draft_discard'; id: string }
  | { kind: 'draft_restore'; id: string; subject: string; body: string }
  | { kind: 'suggestions_reset'; ids: string[] }
  | { kind: 'expense_unassign'; id: string; previousProjectId: string | null }
  | { kind: 'task_unassign'; id: string; previousProjectId: string | null; previousMilestoneId: string | null }
  | { kind: 'none' };

export interface ToolOutcome {
  summary: string;
  detail: string[];
  payload: ToolPayload | null;
  focus?: FocusPatch | null;
  undo?: ToolUndo | null;
  createdItem?: ItemRef | null;
  externalIds?: Record<string, string>;
  note?: string | null;
}

export type ToolHandler<S extends z.ZodTypeAny = z.ZodTypeAny> = (args: z.infer<S>, ctx: ToolContext) => Promise<ToolOutcome>;

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();

  register<S extends z.ZodTypeAny>(definition: ToolDefinition<S>, handler: ToolHandler<S>): void {
    if (!getTool(definition.name)) throw new Error(`Tool ${definition.name} is not in the catalog`);
    this.handlers.set(definition.name, handler as ToolHandler);
  }

  /** Registers a handler for a catalog tool; `args` is typed from the tool's schema. */
  registerByName<N extends ToolName>(name: N, handler: (args: ToolArgs<N>, ctx: ToolContext) => Promise<ToolOutcome>): void {
    const definition = getTool(name);
    if (!definition) throw new Error(`Tool ${name} is not in the catalog`);
    this.handlers.set(name, handler as unknown as ToolHandler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return [...this.handlers.keys()];
  }

  permissionOf(name: string): ToolPermission | null {
    return getTool(name)?.permission ?? null;
  }

  async execute(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolOutcome> {
    const definition = getTool(name);
    const handler = this.handlers.get(name);
    if (!definition || !handler) throw new DomainError('TOOL_NOT_FOUND', `Unknown tool ${name}`);
    const parsed = definition.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      throw new DomainError('INVALID_ARGUMENTS', parsed.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; '), { details: { tool: name } });
    }
    const needsConfirmation = definition.permission === 'sensitive' || definition.permission === 'external';
    if (needsConfirmation && !ctx.confirmed) {
      throw new DomainError('CONFIRMATION_REQUIRED', `${name} requires explicit confirmation`, { details: { tool: name, permission: definition.permission } });
    }
    try {
      const outcome = await handler(parsed.data, ctx);
      if (definition.permission !== 'read') await ctx.services.audit.record({ tool: name, permission: definition.permission, args: parsed.data, confirmed: ctx.confirmed, ok: true }).catch(() => undefined);
      return outcome;
    } catch (e) {
      const error = DomainError.from(e);
      if (definition.permission !== 'read') await ctx.services.audit.record({ tool: name, permission: definition.permission, args: parsed.data, confirmed: ctx.confirmed, ok: false, error: error.message }).catch(() => undefined);
      throw error;
    }
  }

  /** Reverses a tool execution (used by the action history's undo). */
  async undo(plan: ToolUndo, services: CoreServices): Promise<void> {
    const db = services.db;
    switch (plan.kind) {
      case 'delete':
        await this.deleteEntity(plan.entity, plan.id, services);
        return;
      case 'invoice_cancel_draft':
        await services.invoices.cancelDraft(plan.id);
        return;
      case 'invoice_unpay':
        await services.invoices.unmarkPaid(plan.id);
        return;
      case 'invoice_status':
        await services.invoices.setStatus(plan.id, plan.status);
        return;
      case 'followup_reopen':
        await services.followUps.setStatus(plan.id, 'open');
        return;
      case 'blocker_reopen': {
        const blocker = await db.blockers.getById(plan.id);
        if (blocker) await db.blockers.update({ ...blocker, status: 'open', resolvedAt: null });
        return;
      }
      case 'email_unhandled': {
        const email = await db.emails.getById(plan.id);
        if (email) await db.emails.update({ ...email, handledAt: null });
        return;
      }
      case 'draft_discard':
        await services.emails.discardDraft(plan.id);
        return;
      case 'draft_restore':
        await services.emails.updateDraftText(plan.id, { subject: plan.subject, body: plan.body });
        return;
      case 'suggestions_reset': {
        for (const id of plan.ids) {
          const s = await db.suggestions.getById(id);
          if (!s) continue;
          if (s.resultId) {
            if (s.resultType === 'TASK') await services.tasks.delete(s.resultId).catch(() => undefined);
            else if (s.resultType === 'FOLLOW_UP') await services.followUps.delete(s.resultId).catch(() => undefined);
            else if (s.resultType === 'DECISION') await db.decisions.delete(s.resultId);
            else if (s.resultType === 'RISK') await db.risks.delete(s.resultId);
            else if (s.resultType === 'REMINDER') await services.reminders.delete(s.resultId).catch(() => undefined);
          }
          await db.suggestions.update({ ...s, status: 'proposed', resultType: null, resultId: null, resolvedAt: null });
        }
        return;
      }
      case 'expense_unassign':
        await services.expenses.assignToProject(plan.id, plan.previousProjectId);
        return;
      case 'task_unassign':
        await services.tasks.update(plan.id, { projectId: plan.previousProjectId, milestoneId: plan.previousMilestoneId });
        return;
      case 'none':
      default:
        throw new DomainError('UNDO_NOT_POSSIBLE');
    }
  }

  private async deleteEntity(entity: Extract<ToolUndo, { kind: 'delete' }>['entity'], id: string, services: CoreServices): Promise<void> {
    const db = services.db;
    switch (entity) {
      case 'task':
        return services.tasks.delete(id);
      case 'follow_up':
        return services.followUps.delete(id);
      case 'time_entry':
        return services.timesheets.delete(id);
      case 'expense':
        return services.expenses.delete(id);
      case 'document':
        return services.documents.delete(id);
      case 'meeting':
        return services.meetings.delete(id);
      case 'workflow':
        return services.workflows.delete(id);
      case 'email':
        return services.emails.delete(id);
      case 'reminder':
        return services.reminders.delete(id);
      case 'project':
        return db.projects.delete(id);
      case 'company':
        return db.companies.delete(id);
      case 'contact':
        return db.contacts.delete(id);
      case 'risk':
        return db.risks.delete(id);
      case 'decision':
        return db.decisions.delete(id);
      case 'blocker':
        return db.blockers.delete(id);
      case 'milestone':
        return db.milestones.delete(id);
      default:
        throw new DomainError('UNDO_NOT_POSSIBLE');
    }
  }
}

import type { OpsServices } from './index';
import type { CoreServices } from '../services';
import type { InvoiceFilter } from '../services/admin/InvoiceService';
import { DomainError, type Language } from '../types/common';

/**
 * Connected mode (central source of truth): the app reads and writes administrative
 * data through the Alfred API instead of its own SQLite. This table is the complete
 * allow-list of service calls the API exposes; the server refuses anything else.
 * The same table serves the in-process client, so local and connected mode behave alike.
 */

export interface RemoteContext {
  services: CoreServices;
  ops: OpsServices;
  language: () => Language;
}

type RemoteFn = (ctx: RemoteContext, args: unknown[]) => Promise<unknown>;

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v) throw new DomainError('INVALID_ARGUMENTS', `${name} must be a non-empty string`);
  return v;
};
const optStr = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const bool = (v: unknown): boolean => v === true;

export const REMOTE_METHODS: Record<string, RemoteFn> = {
  // Dashboards and inbox (§98, §131)
  'administrative.dashboard': (c) => c.services.administrative.dashboard(),
  'administrative.inbox': (c, [horizonDays]) => c.services.administrative.inbox(c.language(), { horizonDays: num(horizonDays, 14) }),
  'administrative.dailyPlan': (c) => c.services.administrative.dailyPlan(c.language()),
  // Invoices
  'invoices.list': (c, [filter, options]) => c.services.invoices.list((optStr(filter) ?? 'open') as InvoiceFilter, obj(options) as { direction?: 'incoming' | 'outgoing' | null; companyId?: string | null; projectId?: string | null; limit?: number }),
  'invoices.get': (c, [id]) => c.services.invoices.get(str(id, 'id')),
  'invoices.renderHtml': (c, [id]) => c.services.invoices.renderHtml(str(id, 'id'), c.language()).catch(() => null),
  // Companies, contacts, profile, styles
  'companies.listCompanies': (c, [kind]) => c.services.companies.listCompanies((optStr(kind) as 'client' | 'supplier' | 'both' | 'other' | null) ?? null),
  'companies.getCompany': (c, [id]) => c.services.companies.getCompany(str(id, 'id')),
  'companies.listContacts': (c, [companyId]) => c.services.companies.listContacts(optStr(companyId)),
  'companies.profile': (c) => c.services.companies.profile(),
  'companies.updateProfile': (c, [patch]) => c.services.companies.updateProfile(obj(patch) as Parameters<CoreServices['companies']['updateProfile']>[0]),
  'companies.communicationPreferences': (c) => c.services.companies.communicationPreferences(),
  'companies.setStyle': (c, [target, style]) => c.services.companies.setStyle(obj(target) as Parameters<CoreServices['companies']['setStyle']>[0], str(style, 'style') as Parameters<CoreServices['companies']['setStyle']>[1]),
  // Projects
  'projects.list': (c, [status]) => c.services.projects.list((optStr(status) as 'open' | 'all' | 'active' | 'on_hold' | 'done' | 'archived' | null) ?? 'open'),
  'projects.overview': (c, [id]) => c.services.projects.overview(str(id, 'id'), c.language()),
  'projects.health': (c, [id]) => c.services.projects.health(str(id, 'id')),
  'projects.summaries': async (c) => {
    const list = await c.services.projects.list('open');
    const out = [];
    for (const project of list) {
      const health = await c.services.projects.health(project.id);
      out.push({ project, health, attention: c.services.projects.attentionLines(health, c.language()) });
    }
    return out;
  },
  'tasks.complete': (c, [id]) => c.services.tasks.complete(str(id, 'id')),
  'tasks.reopen': (c, [id]) => c.services.tasks.reopen(str(id, 'id')),
  // Email
  'emails.search': (c, [options]) => c.services.emails.search(obj(options) as Parameters<CoreServices['emails']['search']>[0]),
  'emails.get': (c, [id]) => c.services.emails.get(str(id, 'id')),
  'emails.latestDraftFor': (c, [emailId]) => c.services.db.emailDrafts.latestForEmail(str(emailId, 'emailId')),
  'emails.listDrafts': (c) => c.services.emails.listDrafts(),
  'emails.import': (c, [input]) => c.services.emails.import(obj(input) as unknown as Parameters<CoreServices['emails']['import']>[0]),
  // Documents, time, expenses, proposals, workflows, audit
  'documents.list': (c, [options]) => c.services.documents.list(obj(options) as Parameters<CoreServices['documents']['list']>[0]),
  'timesheets.summary': (c, [range]) => c.services.timesheets.summary(obj(range) as Parameters<CoreServices['timesheets']['summary']>[0]),
  'timesheets.list': (c, [options]) => c.services.timesheets.list(obj(options) as Parameters<CoreServices['timesheets']['list']>[0]),
  'expenses.list': (c, [options]) => c.services.expenses.list(obj(options) as Parameters<CoreServices['expenses']['list']>[0]),
  'suggestions.list': (c, [options]) => c.services.suggestions.list(obj(options) as Parameters<CoreServices['suggestions']['list']>[0]),
  'workflows.list': (c) => c.services.workflows.list(),
  'workflows.setEnabled': (c, [id, enabled]) => c.services.workflows.setEnabled(str(id, 'id'), bool(enabled)),
  'workflows.listRuns': (c, [limit]) => c.services.workflows.listRuns(num(limit, 50)),
  'audit.listRecent': (c, [limit]) => c.services.audit.listRecent(num(limit, 100)),
  'history.listRecent': (c, [limit]) => c.services.history.listRecent(num(limit, 50)),
  'settings.signature': async (c) => c.services.settings.get().userName,
  // Operational settings live where Alfred lives: in connected mode the app writes them here.
  'settings.ops': async (c) => c.services.settings.get().ops,
  'settings.updateOps': async (c, [patch]) => {
    const p = obj(patch);
    const allowed: Record<string, unknown> = {};
    if (p.autonomy === 'ASSISTANT' || p.autonomy === 'PROACTIVE' || p.autonomy === 'OPERATOR') allowed.autonomy = p.autonomy;
    if (typeof p.pickupSlaMinutes === 'number' && p.pickupSlaMinutes > 0) allowed.pickupSlaMinutes = Math.round(p.pickupSlaMinutes);
    if (typeof p.briefingTime === 'string' && /^\d{2}:\d{2}$/.test(p.briefingTime)) allowed.briefingTime = p.briefingTime;
    if (typeof p.eveningTime === 'string' && /^\d{2}:\d{2}$/.test(p.eveningTime)) allowed.eveningTime = p.eveningTime;
    if (typeof p.emailPollMinutes === 'number' && p.emailPollMinutes > 0) allowed.emailPollMinutes = Math.round(p.emailPollMinutes);
    if (typeof p.approvalExpiryDays === 'number' && p.approvalExpiryDays > 0) allowed.approvalExpiryDays = Math.round(p.approvalExpiryDays);
    const next = await c.services.settings.update({ ops: allowed });
    return next.ops;
  },
  // Ops extras used by screens
  'ops.quotes.list': (c, [status]) => c.ops.quotes.list((optStr(status) as Parameters<OpsServices['quotes']['list']>[0]) ?? 'open'),
  'ops.crm.timeline': (c, [companyId]) => c.ops.crm.timeline(str(companyId, 'companyId')),
  'ops.costs.today': (c) => c.ops.costs.today(),
};

export type RemoteMethod = keyof typeof REMOTE_METHODS;

export function isRemoteMethod(method: string): method is RemoteMethod {
  return Object.prototype.hasOwnProperty.call(REMOTE_METHODS, method);
}

export async function invokeRemote(ctx: RemoteContext, method: string, args: unknown[]): Promise<unknown> {
  if (!isRemoteMethod(method)) throw new DomainError('INVALID_ARGUMENTS', `Unknown remote method ${method}`);
  const fn = REMOTE_METHODS[method]!;
  const result = await fn(ctx, Array.isArray(args) ? args : []);
  return result === undefined ? null : result;
}

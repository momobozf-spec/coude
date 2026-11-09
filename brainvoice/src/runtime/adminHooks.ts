import { useAsyncData } from './hooks';
import { adminCall } from './remote';
import type { AdminDashboard, AdminInboxItem, ProjectHealth, ProjectOverview } from '@core/admin/types';
import type { AdminDocument, AuditEntry, Company, CompanyProfile, Contact, EmailDraft, EmailMessage, Expense, Invoice, Project, Suggestion, TimeEntry, Workflow } from '@core/domain/admin';
import type { InvoiceFilter } from '@core/services/admin/InvoiceService';
import type { TimesheetSummary } from '@core/services/admin/TimesheetService';

/**
 * Data hooks for the Butler screens (refetch on every executed command via dataVersion).
 * Every read goes through `adminCall`, so the same screen shows this phone's data in local
 * mode and the Alfred server's data in connected mode.
 */

export function useAdminDashboard() {
  return useAsyncData<AdminDashboard>(() => adminCall('administrative.dashboard'));
}

export function useAdminInbox() {
  return useAsyncData<AdminInboxItem[]>(() => adminCall('administrative.inbox', 14));
}

export function useInvoices(filter: InvoiceFilter, direction: 'incoming' | 'outgoing' | null) {
  return useAsyncData<Invoice[]>(() => adminCall('invoices.list', filter, { direction }), [filter, direction]);
}

export function useInvoice(id: string | null) {
  return useAsyncData<Invoice | null>(() => (id ? adminCall('invoices.get', id) : Promise.resolve(null)), [id]);
}

export function useInvoiceHtml(id: string | null) {
  return useAsyncData<string | null>(async () => {
    if (!id) return null;
    const invoice = await adminCall<Invoice | null>('invoices.get', id);
    if (!invoice || invoice.direction !== 'outgoing') return null;
    return adminCall<string | null>('invoices.renderHtml', id);
  }, [id]);
}

export function useCompanies(kind: 'client' | 'supplier' | null) {
  return useAsyncData<Company[]>(() => adminCall('companies.listCompanies', kind), [kind]);
}

export function useCompany(id: string | null) {
  return useAsyncData<{ company: Company; contacts: Contact[] } | null>(async () => {
    if (!id) return null;
    const company = await adminCall<Company | null>('companies.getCompany', id);
    if (!company) return null;
    return { company, contacts: await adminCall<Contact[]>('companies.listContacts', id) };
  }, [id]);
}

export function useProjects() {
  return useAsyncData<Project[]>(() => adminCall('projects.list', 'open'));
}

export function useProjectSummaries() {
  return useAsyncData<{ project: Project; health: ProjectHealth; attention: string[] }[]>(() => adminCall('projects.summaries'));
}

export function useProjectOverview(id: string | null) {
  return useAsyncData<ProjectOverview | null>(() => (id ? adminCall('projects.overview', id) : Promise.resolve(null)), [id]);
}

export function useEmails(view: 'needs_reply' | 'unhandled' | 'all') {
  return useAsyncData<EmailMessage[]>(() => adminCall('emails.search', { view, limit: 100 }), [view]);
}

export function useEmail(id: string | null) {
  return useAsyncData<{ email: EmailMessage; draft: EmailDraft | null } | null>(async () => {
    if (!id) return null;
    const email = await adminCall<EmailMessage | null>('emails.get', id);
    if (!email) return null;
    return { email, draft: await adminCall<EmailDraft | null>('emails.latestDraftFor', id) };
  }, [id]);
}

export function useDrafts() {
  return useAsyncData<EmailDraft[]>(() => adminCall('emails.listDrafts'));
}

export function useDocuments() {
  return useAsyncData<AdminDocument[]>(() => adminCall('documents.list', { limit: 200 }));
}

export function useTimesheet(from: string, to: string) {
  return useAsyncData<TimesheetSummary>(() => adminCall('timesheets.summary', { from, to }), [from, to]);
}

export function useTimeEntries(from: string, to: string) {
  return useAsyncData<TimeEntry[]>(() => adminCall('timesheets.list', { from, to, status: 'all' }), [from, to]);
}

export function useExpenses() {
  return useAsyncData<Expense[]>(() => adminCall('expenses.list', { limit: 200 }));
}

export function useSuggestions() {
  return useAsyncData<Suggestion[]>(() => adminCall('suggestions.list', { status: 'proposed' }));
}

export function useBusinessProfile() {
  return useAsyncData<CompanyProfile>(() => adminCall('companies.profile'));
}

export function useWorkflows() {
  return useAsyncData<Workflow[]>(() => adminCall('workflows.list'));
}

export function useAuditLog() {
  return useAsyncData<AuditEntry[]>(() => adminCall('audit.listRecent', 100));
}

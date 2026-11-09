import type { ToolContext } from '../ToolRegistry';
import type { Company, Contact, Project } from '../../domain/admin';
import { DomainError, type Language } from '../../types/common';

/** Helpers shared by the tool handlers: focus-aware resolution and localized phrases. */

export type Tri = { nl: string; en: string; fr: string };
export const L = (language: Language, t: Tri): string => t[language];

export async function resolveProject(ctx: ToolContext, args: { project?: string | null; projectId?: string | null }, options: { required?: boolean; allowFocus?: boolean } = {}): Promise<Project | null> {
  const { services, focus } = ctx;
  if (args.projectId) return services.projects.require(args.projectId);
  if (args.project) return services.projects.resolve(args.project);
  if (options.allowFocus !== false && focus.projectId) {
    const focused = await services.projects.get(focus.projectId);
    if (focused) return focused;
  }
  if (options.required) {
    const recent = await services.projects.mostRecent();
    if (recent) return recent;
    throw new DomainError('NOT_FOUND', 'No project found', { details: { hint: 'project' } });
  }
  return null;
}

export async function resolveCompany(ctx: ToolContext, query: string | null | undefined, options: { required?: boolean; allowFocus?: boolean; kind?: Company['kind'] | null } = {}): Promise<Company | null> {
  const { services, focus } = ctx;
  if (query) return services.companies.resolveCompany(query, options.kind ?? null);
  if (options.allowFocus !== false && focus.companyId) return services.companies.getCompany(focus.companyId);
  if (options.required) throw new DomainError('NOT_FOUND', 'No client given');
  return null;
}

export async function resolveContact(ctx: ToolContext, query: string | null | undefined): Promise<Contact | null> {
  if (query) {
    const match = await ctx.services.companies.findContact(query);
    if (match.best && !match.ambiguous) return match.best;
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several contacts match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.name })) } });
    return null;
  }
  if (ctx.focus.contactId) return ctx.services.companies.getContact(ctx.focus.contactId);
  return null;
}

export function requireFocus<T extends string | string[]>(value: T | null | undefined, what: Tri, language: Language): T {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    throw new DomainError('INVALID_ARGUMENTS', L(language, what), { details: { missingFocus: true } });
  }
  return value;
}

export const NO_EMAIL_FOCUS: Tri = { nl: 'Welke mail bedoel je? Open eerst een mail.', en: 'Which email do you mean? Open one first.', fr: 'Quel mail ? Ouvre-le d’abord.' };
export const NO_DRAFT_FOCUS: Tri = { nl: 'Er is geen concept om aan te passen. Laat me eerst een antwoord opstellen.', en: 'There is no draft to work on. Ask me to draft a reply first.', fr: 'Il n’y a pas de brouillon. Demande-moi d’abord une réponse.' };
export const NO_INVOICE_FOCUS: Tri = { nl: 'Welke factuur bedoel je?', en: 'Which invoice do you mean?', fr: 'Quelle facture ?' };
export const NO_EXPENSE_FOCUS: Tri = { nl: 'Welke onkost bedoel je? Lees eerst een bon in.', en: 'Which expense do you mean? Capture a receipt first.', fr: 'Quelle dépense ? Lis d’abord un ticket.' };
export const NO_DOCUMENT_FOCUS: Tri = { nl: 'Welk document bedoel je?', en: 'Which document do you mean?', fr: 'Quel document ?' };
export const NO_SUGGESTIONS: Tri = { nl: 'Er zijn geen openstaande voorstellen.', en: 'There are no pending proposals.', fr: 'Aucune proposition en attente.' };

export function plural(n: number, singular: Tri, pluralForm: Tri, language: Language): string {
  return `${n} ${L(language, n === 1 ? singular : pluralForm)}`;
}

import type { TeamRole } from '../domain/ops';
import type { Language } from '../types/common';

/**
 * AI team roles (§151–§152) are orchestration profiles, not separate agents: every role
 * works through the same Tool Registry, permission levels, approvals and audit log. A
 * profile only narrows which tools a role may call and how its work is framed.
 */

export interface RoleProfile {
  role: TeamRole;
  name: Record<Language, string>;
  description: Record<Language, string>;
  /** Tool-name prefixes this role may execute; '*' = all catalog tools. */
  allowedToolPrefixes: readonly string[];
  /** Short system framing for LLM-backed work. */
  framing: string;
}

export const ROLE_PROFILES: Record<TeamRole, RoleProfile> = {
  CHIEF_OF_STAFF: {
    role: 'CHIEF_OF_STAFF',
    name: { nl: 'Alfred (chef-staf)', en: 'Alfred (chief of staff)', fr: 'Alfred (chef de cabinet)' },
    description: { nl: 'Verdeelt werk, bewaakt prioriteiten en vat samen.', en: 'Routes work, keeps priorities and summarises.', fr: 'Répartit le travail, garde les priorités et résume.' },
    allowedToolPrefixes: ['*'],
    framing: 'You are Alfred, chief of staff. You prepare work for the user and never take consequential actions without an explicit approval.',
  },
  ADMIN_ASSISTANT: {
    role: 'ADMIN_ASSISTANT',
    name: { nl: 'Administratief assistent', en: 'Administrative assistant', fr: 'Assistant administratif' },
    description: { nl: 'E-mail, facturen, documenten, opvolging, agenda.', en: 'Email, invoices, documents, follow-ups, calendar.', fr: 'E-mail, factures, documents, suivis, agenda.' },
    allowedToolPrefixes: ['admin.', 'email.', 'invoice.', 'timesheet.', 'expense.', 'document.', 'followup.', 'company.', 'contact.', 'style.', 'profile.', 'suggestions.', 'quote.', 'crm.', 'ticket.', 'workflow.', 'automation.'],
    framing: 'You are the administrative assistant. You prepare replies, invoices and follow-ups; sending or issuing always goes through an approval.',
  },
  PROJECT_MANAGER: {
    role: 'PROJECT_MANAGER',
    name: { nl: 'Projectmanager', en: 'Project manager', fr: 'Chef de projet' },
    description: { nl: 'Projecten, taken, mijlpalen, blockers, beslissingen.', en: 'Projects, tasks, milestones, blockers, decisions.', fr: 'Projets, tâches, jalons, blocages, décisions.' },
    allowedToolPrefixes: ['project.', 'meeting.', 'admin.', 'followup.', 'suggestions.', 'ticket.'],
    framing: 'You are the project manager. You keep projects moving: next steps, blockers, risks and decisions, always as proposals.',
  },
  SOFTWARE_ENGINEER: {
    role: 'SOFTWARE_ENGINEER',
    name: { nl: 'Software engineer', en: 'Software engineer', fr: 'Ingénieur logiciel' },
    description: { nl: 'Repo inspecteren, wijzigingen voorbereiden, tests draaien.', en: 'Inspect the repo, prepare changes, run tests.', fr: 'Inspecter le dépôt, préparer des changements, lancer les tests.' },
    allowedToolPrefixes: ['repo.', 'ticket.', 'project.'],
    framing: 'You are the software engineer. You only use the bounded repository tools; you never run arbitrary shell commands and every commit or PR is prepared, not pushed.',
  },
  RESEARCH_ANALYST: {
    role: 'RESEARCH_ANALYST',
    name: { nl: 'Research analist', en: 'Research analyst', fr: 'Analyste de recherche' },
    description: { nl: 'Onderzoekt, vergelijkt en vat bronnen samen.', en: 'Researches, compares and summarises sources.', fr: 'Recherche, compare et résume les sources.' },
    allowedToolPrefixes: ['admin.', 'project.', 'document.', 'email.search', 'email.open', 'ticket.', 'advisory.'],
    framing: 'You are the research analyst. You separate facts from assumptions, cite what you used and state what you could not verify.',
  },
  CREATIVE_ASSISTANT: {
    role: 'CREATIVE_ASSISTANT',
    name: { nl: 'Creatief assistent', en: 'Creative assistant', fr: 'Assistant créatif' },
    description: { nl: 'Teksten, posts, scripts en ideeën als concept.', en: 'Copy, posts, scripts and ideas as drafts.', fr: 'Textes, posts, scripts et idées en brouillon.' },
    allowedToolPrefixes: ['ticket.', 'document.create', 'content.'],
    framing: 'You are the creative assistant. Everything you produce is a draft for the user to review; nothing is published by you.',
  },
};

export function roleAllowsTool(role: TeamRole, tool: string): boolean {
  const prefixes = ROLE_PROFILES[role].allowedToolPrefixes;
  return prefixes.some((p) => p === '*' || tool === p || tool.startsWith(p));
}

export function roleName(role: TeamRole, language: Language): string {
  return ROLE_PROFILES[role].name[language];
}

// ---------------------------------------------------------------------------
// Routing (§152): deterministic keyword scoring, visible in Mission Control as the reason
// ---------------------------------------------------------------------------

interface RoleCue {
  role: TeamRole;
  patterns: RegExp[];
  weight: number;
}

const CUES: RoleCue[] = [
  { role: 'SOFTWARE_ENGINEER', weight: 3, patterns: [/\b(repo|repository|git|commit|pull request|\bpr\b|branch|bug|bugfix|typescript|lint|tsc|unit ?test|tests?\b|build|deploy|refactor|compile|npm|package\.json|endpoint|api route|stack ?trace|exception|codebase|code)\b/i] },
  { role: 'RESEARCH_ANALYST', weight: 2, patterns: [/\b(research|onderzoek|zoek uit|vergelijk|compare|analy[sz]e|analyse|market|markt|benchmark|concurrent|competitor|bronnen|sources|rapport|report|samenvatting van|summar(y|ise|ize) (the|this|de|dit)|literature|whitepaper|recherche|comparer)\b/i] },
  { role: 'CREATIVE_ASSISTANT', weight: 2, patterns: [/\b(linkedin|post|blog|artikel|article|script|slogan|tagline|caption|nieuwsbrief|newsletter|copy|brand|logo|design|ontwerp|creative|creatief|video|podcast|tweet|instagram|social)\b/i] },
  { role: 'PROJECT_MANAGER', weight: 2, patterns: [/\b(project|milestone|mijlpaal|blocker|blokkade|risico|risk|beslissing|decision|sprint|planning|roadmap|stand ?up|retro|deadline|dependency|afhankelijkheid|stakeholder|projet|jalon|blocage)\b/i] },
  { role: 'ADMIN_ASSISTANT', weight: 2, patterns: [/\b(mail|e-?mail|factuur|facturen|invoice|invoices|offerte|quote|quotation|betaling|payment|betaal|klant|client|customer|leverancier|supplier|document|contract|verzekering|insurance|timesheet|uren|hours|onkost|expense|bon|receipt|agenda|meeting|afspraak|appointment|opvolging|follow[- ]?up|herinner|remind|antwoord|reply|facture|devis|paiement|rappel)\b/i] },
];

export interface RoutingDecision {
  role: TeamRole;
  reason: string;
  scores: Partial<Record<TeamRole, number>>;
}

/** Picks the role for a ticket from its text; the chief of staff keeps anything without a clear signal. */
export function routeTicket(text: string, hints: { emailId?: string | null; projectId?: string | null; source?: string | null } = {}): RoutingDecision {
  const scores: Partial<Record<TeamRole, number>> = {};
  const matched: Partial<Record<TeamRole, string[]>> = {};
  for (const cue of CUES) {
    for (const pattern of cue.patterns) {
      const m = pattern.exec(text);
      if (m) {
        scores[cue.role] = (scores[cue.role] ?? 0) + cue.weight;
        (matched[cue.role] ??= []).push(m[0].toLowerCase());
      }
    }
  }
  if (hints.emailId) scores.ADMIN_ASSISTANT = (scores.ADMIN_ASSISTANT ?? 0) + 2;
  if (hints.projectId) scores.PROJECT_MANAGER = (scores.PROJECT_MANAGER ?? 0) + 1;
  if (hints.source === 'email') scores.ADMIN_ASSISTANT = (scores.ADMIN_ASSISTANT ?? 0) + 2;
  let best: TeamRole = 'CHIEF_OF_STAFF';
  let bestScore = 0;
  for (const role of ['ADMIN_ASSISTANT', 'PROJECT_MANAGER', 'SOFTWARE_ENGINEER', 'RESEARCH_ANALYST', 'CREATIVE_ASSISTANT'] as const) {
    const score = scores[role] ?? 0;
    if (score > bestScore) {
      best = role;
      bestScore = score;
    }
  }
  const cues = matched[best]?.slice(0, 3).join(', ');
  const reason = best === 'CHIEF_OF_STAFF' ? 'no specialist signal – kept by the chief of staff' : `${cues ? `cues: ${cues}` : 'source hint'} (score ${bestScore})`;
  return { role: best, reason, scores };
}

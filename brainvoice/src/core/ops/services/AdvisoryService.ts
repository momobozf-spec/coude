import { z } from 'zod';

import type { AIGateway } from '../../ai/AIGateway';
import { clampForPrompt, UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../../butler/safety';
import type { Database } from '../../db/Database';
import { ADVISORY_ROLES, type AdvisoryPerspective, type AdvisoryRole, type AdvisorySession, type AdvisorySynthesis } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import type { FollowUpService } from '../../services/admin/FollowUpService';
import type { InvoiceService } from '../../services/admin/InvoiceService';
import type { ProjectService } from '../../services/admin/ProjectService';
import type { Language } from '../../types/common';
import { newId } from '../../util/id';

const PerspectiveSchema = z.object({
  position: z.string(),
  arguments: z.array(z.string()).max(6),
  risks: z.array(z.string()).max(6),
  questions: z.array(z.string()).max(6),
  confidence: z.number().min(0).max(1),
});

const SynthesisSchema = z.object({
  agreements: z.array(z.string()).max(8),
  disagreements: z.array(z.string()).max(8),
  recommendation: z.string().nullable(),
  openQuestions: z.array(z.string()).max(8),
});

const ROLE_FRAMING: Record<AdvisoryRole, string> = {
  STRATEGIST: 'You are the Strategist: long-term positioning, options, second-order effects. Argue for the most ambitious viable path.',
  CRITIC: 'You are the Critic: find the weakest assumption, what could go wrong, what is missing. Be concrete and fair, not contrarian for its own sake.',
  OPERATOR: 'You are the Operator: feasibility, sequencing, cost, time, who does what next week. Prefer small reversible steps.',
  ANALYST: 'You are the Analyst: numbers, evidence, what the data in the brief supports and what it does not. Separate facts from assumptions.',
};

const TEMPLATE_QUESTIONS: Record<AdvisoryRole, Record<Language, string[]>> = {
  STRATEGIST: {
    nl: ['Welke opties zijn er naast de voor de hand liggende?', 'Wat verandert dit over 12 maanden?', 'Welke deur sluit deze keuze?'],
    en: ['Which options exist beyond the obvious one?', 'What does this change in 12 months?', 'Which door does this choice close?'],
    fr: ['Quelles options existent au-delà de l’évidente ?', 'Qu’est-ce que cela change dans 12 mois ?', 'Quelle porte ce choix ferme-t-il ?'],
  },
  CRITIC: {
    nl: ['Welke aanname is het zwakst?', 'Wat gebeurt er als het misloopt?', 'Wat ontbreekt in dit verhaal?'],
    en: ['Which assumption is the weakest?', 'What happens if it fails?', 'What is missing from this picture?'],
    fr: ['Quelle hypothèse est la plus faible ?', 'Que se passe-t-il en cas d’échec ?', 'Que manque-t-il dans ce tableau ?'],
  },
  OPERATOR: {
    nl: ['Wat is de eerste omkeerbare stap?', 'Wat kost het in tijd en geld?', 'Wie doet wat volgende week?'],
    en: ['What is the first reversible step?', 'What does it cost in time and money?', 'Who does what next week?'],
    fr: ['Quelle est la première étape réversible ?', 'Combien cela coûte en temps et en argent ?', 'Qui fait quoi la semaine prochaine ?'],
  },
  ANALYST: {
    nl: ['Welke cijfers onderbouwen dit?', 'Wat weten we niet?', 'Hoe meten we of het werkt?'],
    en: ['Which numbers support this?', 'What do we not know?', 'How do we measure whether it works?'],
    fr: ['Quels chiffres soutiennent cela ?', 'Que ne savons-nous pas ?', 'Comment mesurer si cela fonctionne ?'],
  },
};

/**
 * Advisory Board (§177): four perspectives over one neutral brief, then a synthesis that
 * lists agreements *and* disagreements. Without cloud AI the board only returns its
 * standard questions (method 'template') – never fabricated analysis or fake consensus.
 */
export class AdvisoryService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly ai: AIGateway,
    private readonly deps: { projects: ProjectService; invoices: InvoiceService; followUps: FollowUpService },
  ) {}

  async buildBrief(question: string, language: Language, extraContext: string | null = null): Promise<string> {
    const [projects, overdue, open, waiting] = await Promise.all([this.deps.projects.list('open'), this.deps.invoices.list('overdue', { direction: 'outgoing' }), this.deps.invoices.list('open', { direction: 'outgoing' }), this.deps.followUps.waitingFor()]);
    const lines = [
      `Question: ${question}`,
      `Language: ${language}`,
      `Date: ${this.clock.today()}`,
      `Facts from the system (not assumptions):`,
      `- Active projects: ${projects.length}${projects.length ? ` (${projects.slice(0, 6).map((p) => p.name).join(', ')})` : ''}`,
      `- Open outgoing invoices: ${open.length}, overdue: ${overdue.length}`,
      `- Waiting-for items: ${waiting.length}`,
    ];
    if (extraContext) lines.push('Context given by the user:', wrapUntrusted('context', clampForPrompt(extraContext, 3000)));
    return lines.join('\n');
  }

  async convene(question: string, options: { ticketId?: string | null; language: Language; context?: string | null }): Promise<AdvisorySession> {
    const brief = await this.buildBrief(question, options.language, options.context ?? null);
    let perspectives: AdvisoryPerspective[];
    let synthesis: AdvisorySynthesis;
    let method: AdvisorySession['method'] = 'template';
    if (this.ai.isAvailable()) {
      try {
        perspectives = [];
        for (const role of ADVISORY_ROLES) {
          const out = await this.ai.structured({ system: `${ROLE_FRAMING[role]}\nAnswer in ${options.language}. Use only the facts in the brief; say explicitly when something is an assumption. ${UNTRUSTED_CONTENT_RULES}`, user: brief, maxTokens: 900 }, PerspectiveSchema);
          perspectives.push({ role, ...out });
        }
        const synth = await this.ai.structured(
          {
            system: `You chair an advisory board. Summarise where the four perspectives agree and where they disagree. Never invent consensus: if they disagree, say so and recommend nothing or a way to resolve it. Answer in ${options.language}.`,
            user: `${brief}\n\nPerspectives:\n${perspectives.map((p) => `${p.role}: ${p.position}\n  arguments: ${p.arguments.join('; ')}\n  risks: ${p.risks.join('; ')}\n  questions: ${p.questions.join('; ')}\n  confidence: ${p.confidence}`).join('\n')}`,
            maxTokens: 900,
          },
          SynthesisSchema,
        );
        synthesis = synth;
        method = 'llm';
      } catch {
        ({ perspectives, synthesis } = this.template(options.language));
      }
    } else {
      ({ perspectives, synthesis } = this.template(options.language));
    }
    const session: AdvisorySession = { id: newId(), ticketId: options.ticketId ?? null, question, brief, perspectives, synthesis, method, createdAt: this.clock.nowISO() };
    await this.db.advisory.insert(session);
    return session;
  }

  private template(language: Language): { perspectives: AdvisoryPerspective[]; synthesis: AdvisorySynthesis } {
    const note = { nl: 'Geen analyse beschikbaar (cloud-AI staat uit) – alleen de standaardvragen van deze rol.', en: 'No analysis available (cloud AI is off) – only this role’s standard questions.', fr: 'Pas d’analyse disponible (IA cloud désactivée) – seulement les questions standard de ce rôle.' }[language];
    const perspectives = ADVISORY_ROLES.map((role) => ({ role, position: note, arguments: [], risks: [], questions: TEMPLATE_QUESTIONS[role][language], confidence: 0 }));
    return { perspectives, synthesis: { agreements: [], disagreements: [], recommendation: null, openQuestions: perspectives.flatMap((p) => p.questions) } };
  }

  get(id: string): Promise<AdvisorySession | null> {
    return this.db.advisory.getById(id);
  }

  forTicket(ticketId: string): Promise<AdvisorySession | null> {
    return this.db.advisory.getByTicket(ticketId);
  }

  listRecent(limit = 20): Promise<AdvisorySession[]> {
    return this.db.advisory.listRecent(limit);
  }
}

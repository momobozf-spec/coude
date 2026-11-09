import { z } from 'zod';

import type { OpsServices } from './index';
import type { JobQueue } from './queue/JobQueue';
import type { RepoTools } from './providers/RepoTools';
import { roleAllowsTool, ROLE_PROFILES } from './roles';
import type { AdvisoryService } from './services/AdvisoryService';
import type { ApprovalService } from './services/ApprovalService';
import type { QuestionService } from './services/QuestionService';
import type { TicketService } from './services/TicketService';
import { permissionNeedsApproval, type OpsSettings } from './settings';
import type { ButlerAdapters } from '../butler/adapters';
import { getTool } from '../butler/catalog';
import { EMPTY_FOCUS, isFocusFresh, mergeFocus, type ButlerFocus } from '../butler/focus';
import { clampForPrompt, UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../butler/safety';
import type { ToolOutcome, ToolRegistry } from '../butler/ToolRegistry';
import type { ActionRouter } from '../commands/ActionRouter';
import type { EntityRef, LinkableType, ToolPermission } from '../domain/admin';
import type { Approval, Job, Ticket, TicketEvidence, TicketOutcome, TicketPlanStep, TicketResult } from '../domain/ops';
import type { EmailProvider } from '../email/EmailProvider';
import { formatCents } from '../finance/money';
import type { ConversationState } from '../intent/ContextResolver';
import type { IntentEngine } from '../intent/IntentEngine';
import type { Command, CommandBatch } from '../intent/schema';
import type { Logger } from '../logging/logger';
import type { Clock } from '../services/Clock';
import type { CoreServices } from '../services';
import { DomainError, type Language } from '../types/common';
import { newId } from '../util/id';

export interface OrchestratorDeps {
  services: CoreServices;
  tools: ToolRegistry;
  butlerAdapters: ButlerAdapters;
  engine: IntentEngine;
  router: ActionRouter;
  queue: JobQueue;
  tickets: TicketService;
  approvals: ApprovalService;
  questions: QuestionService;
  advisory: AdvisoryService;
  repo: () => RepoTools;
  /** The connected mailbox; when it can send, reply tickets end with an `email.send` approval card. */
  emailProvider?: () => EmailProvider;
  clock: Clock;
  settings: () => OpsSettings;
  logger?: Logger;
}

const LINKABLE: readonly string[] = ['EMAIL', 'CONTACT', 'COMPANY', 'PROJECT', 'TASK', 'INVOICE', 'DOCUMENT', 'MEETING', 'EXPENSE', 'TIME_ENTRY', 'FOLLOW_UP', 'NOTE', 'DECISION', 'EVENT', 'SUGGESTION', 'DRAFT', 'TICKET', 'APPROVAL', 'QUESTION', 'QUOTE'];
const PREPARING_TOOLS: readonly string[] = ['email.draftReply', 'email.refineDraft', 'email.compose', 'email.suggest', 'meeting.extractActions', 'meeting.debrief', 'quote.create', 'invoice.create', 'repo.prepareCommit', 'repo.preparePR'];
const ANSWER_KEYS: readonly string[] = ['project', 'client', 'company', 'contact', 'from', 'topic', 'query', 'person', 'who', 'title', 'instruction'];

const KnowledgeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), bullets: z.array(z.string()).max(8) })).max(8),
  assumptions: z.array(z.string()).max(6),
  openQuestions: z.array(z.string()).max(6),
});

const AnswerSchema = z.object({ answer: z.string() });

/**
 * AlfredOrchestrator (§151): the single orchestrator that turns a ticket into tool
 * calls. It reuses the intent engine for understanding and the ToolRegistry for
 * execution; sensitive/external steps become durable approvals, missing information
 * becomes a blocking question, and specialist roles only narrow which tools may run.
 * Email tickets follow a fixed plan derived from their classification – the email body
 * is never parsed as a command (§162).
 */
export class AlfredOrchestrator {
  private ops: OpsServices | null = null;

  constructor(private readonly deps: OrchestratorDeps) {}

  /** The operations layer passes itself in after construction so tools can reach tickets, approvals, quotes… */
  attachOps(ops: OpsServices): void {
    this.ops = ops;
  }

  async process(ticketId: string, job: Job, workerId: string): Promise<void> {
    const { tickets } = this.deps;
    let ticket = await tickets.require(ticketId);
    if (ticket.status === 'COMPLETED' || ticket.status === 'FAILED' || ticket.status === 'CANCELLED') return;
    if (ticket.status === 'WAITING_APPROVAL' && !job.payload.approvalId) return;
    if (ticket.status === 'WAITING_QUESTION' && !job.payload.questionId) return;
    ticket = await tickets.transition(ticketId, 'WORKING', { actor: `worker:${workerId}`, message: `run ${ticket.attempts + 1} (${String(job.payload.reason ?? 'start')})`, assignedWorker: workerId, allowFrom: ['QUEUED', 'WORKING', 'INBOX', 'SCHEDULED', 'BLOCKED', 'WAITING_APPROVAL', 'WAITING_QUESTION'] });
    ticket = await tickets.save({ ...ticket, attempts: ticket.attempts + 1 });
    const actor = `worker:${workerId}`;

    try {
      // 1. Resumes: an approval decision or an answered question.
      if (typeof job.payload.approvalId === 'string') {
        const approval = await this.deps.approvals.require(job.payload.approvalId);
        if (approval.status === 'EDIT_REQUESTED') {
          await this.reprepare(ticket, approval, actor);
          return;
        }
        if (approval.status !== 'APPROVED') {
          await tickets.note(ticket.id, `approval ${approval.id} is ${approval.status}; nothing executed`, actor);
          if (approval.status === 'PENDING') await tickets.transition(ticket.id, 'WAITING_APPROVAL', { actor });
          return;
        }
        ticket = await this.executeApproved(ticket, approval, job, actor);
      } else if (typeof job.payload.questionId === 'string') {
        ticket = await this.applyAnswer(ticket, job.payload.questionId, actor);
        if (isTerminal(ticket)) return;
      }

      // 2. Planning happens once per ticket; resumes continue the stored plan (never re-plan after an approval).
      if (ticket.plan.length === 0 && ticket.context.planned !== true) {
        const planned = await this.plan(ticket, actor);
        if (planned.done) return;
        ticket = planned.ticket;
      }

      // 3. Execute pending steps in order; stop at the first approval or question.
      ticket = await this.runSteps(ticket, job, actor);
    } catch (e) {
      const error = DomainError.from(e);
      if (error.code === 'ROLE_NOT_ALLOWED' || error.code === 'REPO_UNAVAILABLE' || error.code === 'AI_UNAVAILABLE' || error.code === 'HOME_NOT_CONNECTED') {
        await tickets.block(ticket.id, error.message, actor);
        return;
      }
      if (['INVALID_ARGUMENTS', 'VALIDATION_FAILED', 'TOOL_NOT_FOUND', 'FINANCIAL_SAFETY', 'PROFILE_INCOMPLETE'].includes(error.code)) {
        await tickets.fail(ticket.id, `${error.code}: ${error.message}`, actor);
        return;
      }
      // Transient: let the queue retry with backoff; the ticket stays WORKING with a note.
      await tickets.note(ticket.id, `transient failure: ${error.message}`, actor, { code: error.code });
      await tickets.transition(ticket.id, 'QUEUED', { actor, message: 'waiting for retry' });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Planning
  // ---------------------------------------------------------------------------

  private async plan(ticket: Ticket, actor: string): Promise<{ ticket: Ticket; done: boolean }> {
    const { tickets } = this.deps;
    const context = ticket.context;
    if (context.emailTicket === true) return { ticket: await this.planEmail(ticket), done: false };
    if (context.askAlfred === true) {
      await this.answerAboutApproval(ticket, actor);
      return { ticket, done: true };
    }
    if (context.advisory === true) {
      const session = await this.deps.advisory.convene(ticket.text, { ticketId: ticket.id, language: ticket.language, context: typeof context.advisoryContext === 'string' ? context.advisoryContext : null });
      const summary = session.method === 'template' ? (ticket.language === 'nl' ? 'Geen analyse mogelijk zonder cloud-AI; de standaardvragen van de raad staan klaar.' : ticket.language === 'fr' ? 'Pas d’analyse sans IA cloud ; les questions standard du conseil sont prêtes.' : 'No analysis possible without cloud AI; the board’s standard questions are ready.') : (session.synthesis.recommendation ?? (session.synthesis.disagreements.length ? 'The board disagrees – see the perspectives.' : 'See the perspectives.'));
      await tickets.complete(ticket.id, { outcome: session.method === 'template' ? 'needs_user' : 'done', summary, detail: [...session.synthesis.agreements.map((a) => `+ ${a}`), ...session.synthesis.disagreements.map((d) => `± ${d}`)], evidence: [{ kind: 'record', label: `advisory session (${session.method})`, ref: null, detail: session.id }] }, actor);
      return { ticket, done: true };
    }
    if (ticket.role === 'SOFTWARE_ENGINEER') {
      await this.runSoftware(ticket, actor);
      return { ticket, done: true };
    }
    if (ticket.role === 'RESEARCH_ANALYST' || ticket.role === 'CREATIVE_ASSISTANT') {
      await this.runKnowledgeWork(ticket, actor);
      return { ticket, done: true };
    }
    return this.planWithEngine(ticket, ticket.text, actor);
  }

  private async planWithEngine(ticket: Ticket, text: string, actor: string): Promise<{ ticket: Ticket; done: boolean }> {
    const { engine, clock, tickets, questions } = this.deps;
    const stored = ticket.context.engineState as ConversationState | undefined;
    const state: ConversationState = stored ?? { pending: null, lastBatch: null, focus: (ticket.context.focus as ButlerFocus | undefined) ?? null };
    const { result, state: next } = await engine.process({ text, source: 'text', language: ticket.language, deviceLanguage: ticket.language, timezone: clock.timezone(), now: clock.now(), state, online: true });
    await tickets.setContext(ticket.id, { engineState: next, usedLLM: result.usedLLM });
    if (result.decision === 'clarify' && result.clarification) {
      await questions.ask({ ticketId: ticket.id, question: result.clarification.question, context: tr(ticket.language, { nl: 'Alfred mist informatie om dit uit te voeren.', en: 'Alfred needs this to carry out the request.', fr: 'Alfred a besoin de cette information pour continuer.' }), allowFreeText: true });
      return { ticket, done: true };
    }
    if (result.decision === 'unknown' || !result.batch) {
      await tickets.setContext(ticket.id, { unknownQuestion: true });
      await questions.ask({
        ticketId: ticket.id,
        question: tr(ticket.language, { nl: 'Ik begrijp dit verzoek niet goed. Wat wil je ermee doen?', en: 'I do not understand this request well. What should I do with it?', fr: 'Je ne comprends pas bien cette demande. Que faire ?' }),
        context: ticket.text.slice(0, 200),
        options: [
          { id: 'note', label: tr(ticket.language, { nl: 'Bewaar als notitie', en: 'Save as a note', fr: 'Garder comme note' }) },
          { id: 'task', label: tr(ticket.language, { nl: 'Maak er een taak van', en: 'Turn it into a task', fr: 'En faire une tâche' }) },
          { id: 'cancel', label: tr(ticket.language, { nl: 'Annuleer', en: 'Cancel', fr: 'Annuler' }) },
        ],
        allowFreeText: true,
      });
      return { ticket, done: true };
    }
    const steps: TicketPlanStep[] = result.batch.commands.map((command) => {
      if (command.intent === 'BUTLER_TOOL') return { id: newId(), tool: command.tool, args: command.args, permission: command.permission, status: 'pending', summary: null, approvalId: null, commandId: command.id };
      return { id: newId(), tool: `capture:${command.intent}`, args: { command }, permission: 'write', status: 'pending', summary: null, approvalId: null, commandId: command.id };
    });
    if (!steps.length) {
      await tickets.complete(ticket.id, { outcome: 'nothing_to_do', summary: tr(ticket.language, { nl: 'Niets uit te voeren.', en: 'Nothing to execute.', fr: 'Rien à exécuter.' }), detail: [], evidence: [] }, actor);
      return { ticket, done: true };
    }
    await tickets.setPlan(ticket.id, steps);
    await tickets.setContext(ticket.id, { planned: true });
    await tickets.note(ticket.id, `plan: ${steps.map((s) => s.tool).join(' → ')}`, actor, { parser: result.usedLLM ? 'llm' : 'deterministic' });
    return { ticket: await tickets.require(ticket.id), done: false };
  }

  /** Fixed plans per classification (§161). The body is data for the tools, never an instruction. */
  private async planEmail(ticket: Ticket): Promise<Ticket> {
    const { tickets } = this.deps;
    const emailId = ticket.emailId;
    if (!emailId) throw new DomainError('INVALID_ARGUMENTS', 'Email ticket without email id');
    const classification = String(ticket.context.classification ?? 'UNKNOWN');
    const suspicious = ticket.context.injectionSuspected === true;
    const step = (tool: string, args: Record<string, unknown>): TicketPlanStep => ({ id: newId(), tool, args, permission: getTool(tool)?.permission ?? 'write', status: 'pending', summary: null, approvalId: null, commandId: null });
    const steps: TicketPlanStep[] = [step('email.briefing', { emailId })];
    if (!suspicious) {
      steps.push(step('email.suggest', { emailId }));
      if (classification === 'NEEDS_REPLY' || classification === 'TASK_REQUEST') {
        const instruction = tr(ticket.language, { nl: 'Beantwoord de vragen van de afzender beleefd en duidelijk; beloof niets dat ik niet kan toezeggen en vraag door waar informatie ontbreekt.', en: 'Answer the sender’s questions politely and clearly; promise nothing I cannot commit to and ask back where information is missing.', fr: 'Réponds poliment et clairement aux questions de l’expéditeur ; ne promets rien que je ne peux tenir et demande les informations manquantes.' });
        steps.push(step('email.draftReply', { emailId, instruction, guideline: true }));
        // With a mailbox that can send, the reply becomes an approval card (external); nothing leaves without it.
        if (this.deps.emailProvider?.().capabilities().canSend) steps.push(step('email.send', {}));
      }
    } else {
      await tickets.note(ticket.id, 'instruction-like text found in the email was ignored (treated as data only)', 'alfred', { injectionSuspected: true });
    }
    await tickets.setPlan(ticket.id, steps);
    await tickets.setContext(ticket.id, { planned: true });
    return tickets.require(ticket.id);
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  private async runSteps(ticket: Ticket, job: Job, actor: string): Promise<Ticket> {
    const { tickets, approvals, settings } = this.deps;
    const autonomy = settings().autonomy;
    const plan = [...ticket.plan];
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]!;
      if (step.status !== 'pending') continue;
      if (!step.tool.startsWith('capture:') && !roleAllowsTool(ticket.role, step.tool)) throw new DomainError('ROLE_NOT_ALLOWED', `${ROLE_PROFILES[ticket.role].name.en} may not use ${step.tool}`);
      if (permissionNeedsApproval(step.permission, autonomy)) {
        const approval = await approvals.request({ ticketId: ticket.id, jobId: job.id, kind: step.tool === 'home.run' ? 'home' : step.tool.startsWith('repo.') ? 'commit' : 'tool', tool: step.tool, args: step.args, permission: step.permission, card: await this.buildCard(ticket, step, i, plan.length) });
        plan[i] = { ...step, status: 'awaiting_approval', approvalId: approval.id };
        await tickets.setPlan(ticket.id, plan);
        return tickets.require(ticket.id);
      }
      const executed = await this.executeStep(ticket, step, job, false, actor);
      if (executed.question) {
        await tickets.setPlan(ticket.id, plan);
        return tickets.require(ticket.id);
      }
      plan[i] = executed.step;
      await tickets.setPlan(ticket.id, plan);
      ticket = await tickets.require(ticket.id);
    }
    return this.finish(ticket, plan, actor);
  }

  private async executeApproved(ticket: Ticket, approval: Approval, job: Job, actor: string): Promise<Ticket> {
    const { tickets } = this.deps;
    const plan = [...ticket.plan];
    const index = plan.findIndex((s) => s.approvalId === approval.id);
    const step: TicketPlanStep = index >= 0 ? { ...plan[index]!, args: approval.args, status: 'pending' } : { id: newId(), tool: approval.tool, args: approval.args, permission: approval.permission, status: 'pending', summary: null, approvalId: approval.id, commandId: null };
    const executed = await this.executeStep(ticket, step, job, true, actor);
    if (index >= 0) plan[index] = executed.step;
    else plan.push(executed.step);
    await tickets.setPlan(ticket.id, plan);
    await tickets.note(ticket.id, `executed after approval ${approval.id}: ${executed.step.summary ?? step.tool}`, actor, { approvalId: approval.id, tool: step.tool }, 'tool');
    return tickets.require(ticket.id);
  }

  private async executeStep(ticket: Ticket, step: TicketPlanStep, job: Job, confirmed: boolean, actor: string): Promise<{ step: TicketPlanStep; question: boolean }> {
    const { services, tools, butlerAdapters, router, clock, tickets, questions } = this.deps;
    const nowISO = clock.nowISO();
    const focus = isFocusFresh(ticket.context.focus as ButlerFocus | undefined, nowISO) ? (ticket.context.focus as ButlerFocus) : EMPTY_FOCUS;
    try {
      if (step.tool.startsWith('capture:')) {
        const command = step.args.command as Command;
        const batch: CommandBatch = { id: newId(), commands: [command], originalText: ticket.text, transcript: null, language: ticket.language, source: 'text', createdAt: nowISO };
        const [result] = await router.execute(batch);
        if (!result || !result.ok) throw result?.error ?? new DomainError('UNKNOWN', 'command failed');
        const ref = result.createdItem && LINKABLE.includes(result.createdItem.type) ? ({ type: result.createdItem.type as LinkableType, id: result.createdItem.id } as EntityRef) : null;
        await tickets.note(ticket.id, result.summary, actor, { tool: step.tool, ref }, 'tool');
        return { step: { ...step, status: 'done', summary: result.summary }, question: false };
      }
      const outcome: ToolOutcome = await tools.execute(step.tool, step.args, { services, adapters: butlerAdapters, clock, language: ticket.language, focus, confirmed, batchId: job.id, originalText: ticket.text, logger: this.deps.logger, ops: this.ops });
      if (outcome.focus) await tickets.setContext(ticket.id, { focus: mergeFocus(focus, outcome.focus, nowISO) });
      const ref = outcome.createdItem && LINKABLE.includes(outcome.createdItem.type) ? ({ type: outcome.createdItem.type as LinkableType, id: outcome.createdItem.id } as EntityRef) : null;
      await tickets.note(ticket.id, `${step.tool}: ${outcome.summary}`, actor, { tool: step.tool, ref, detail: outcome.detail.slice(0, 5) }, 'tool');
      return { step: { ...step, status: 'done', summary: outcome.summary, detail: outcome.detail.slice(0, 8) }, question: false };
    } catch (e) {
      const error = DomainError.from(e);
      if (error.code === 'CONFIRMATION_REQUIRED') throw new DomainError('APPROVAL_REQUIRED', error.message);
      if ((error.code === 'AMBIGUOUS_COMMAND' || error.code === 'NOT_FOUND') && !ticket.context.pendingStepId) {
        const candidates = Array.isArray(error.details?.candidates) ? (error.details.candidates as { id: string; title: string }[]) : [];
        await tickets.setContext(ticket.id, { pendingStepId: step.id });
        await questions.ask({
          ticketId: ticket.id,
          question: error.code === 'AMBIGUOUS_COMMAND' ? tr(ticket.language, { nl: 'Welke bedoel je?', en: 'Which one do you mean?', fr: 'Lequel veux-tu dire ?' }) : tr(ticket.language, { nl: `Ik vond dit niet: ${error.message}. Wat bedoel je precies?`, en: `I could not find this: ${error.message}. What exactly do you mean?`, fr: `Je n’ai pas trouvé : ${error.message}. Que veux-tu dire exactement ?` }),
          context: `${step.tool}`,
          options: candidates.slice(0, 6).map((c) => ({ id: c.id, label: c.title })),
          allowFreeText: true,
        });
        return { step, question: true };
      }
      throw error;
    }
  }

  private async finish(ticket: Ticket, plan: TicketPlanStep[], actor: string): Promise<Ticket> {
    const done = plan.filter((s) => s.status === 'done');
    const evidence: TicketEvidence[] = done.map((s) => ({ kind: s.tool.startsWith('capture:') ? 'record' : PREPARING_TOOLS.includes(s.tool) ? 'draft' : 'tool', label: `${s.tool}${s.summary ? `: ${s.summary}` : ''}`, ref: null }));
    // A step that reached the outside world (e.g. email.send after approval) makes the ticket done, not merely prepared.
    const executed = done.filter((s) => s.permission === 'external');
    const prepared = executed.length === 0 && done.some((s) => PREPARING_TOOLS.includes(s.tool));
    const outcome: TicketOutcome = prepared ? 'prepared' : done.length ? 'done' : 'nothing_to_do';
    const summary = prepared ? tr(ticket.language, { nl: 'Voorbereid – wacht op jouw beslissing om te verzenden of goed te keuren.', en: 'Prepared – waiting for your decision to send or approve.', fr: 'Préparé – en attente de ta décision pour envoyer ou approuver.' }) : (executed.length ? executed : done).map((s) => s.summary).filter(Boolean).join(' · ') || tr(ticket.language, { nl: 'Afgewerkt.', en: 'Done.', fr: 'Terminé.' });
    const result: TicketResult = { outcome, summary, detail: done.flatMap((s) => [`${s.tool}: ${s.summary ?? ''}`, ...(s.detail ?? []).map((line) => `  ${line}`)]), evidence };
    if (ticket.context.askAlfred === true && typeof ticket.context.approvalId === 'string') await this.deps.approvals.addAlfredNote(ticket.context.approvalId, summary).catch(() => undefined);
    return this.deps.tickets.complete(ticket.id, result, actor);
  }

  // ---------------------------------------------------------------------------
  // Answers, edits, cards
  // ---------------------------------------------------------------------------

  private async applyAnswer(ticket: Ticket, questionId: string, actor: string): Promise<Ticket> {
    const { questions, tickets, services } = this.deps;
    const question = await questions.require(questionId);
    if (question.status !== 'ANSWERED') return ticket;
    const answer = question.answerText ?? '';
    if (ticket.context.unknownQuestion === true) {
      await tickets.setContext(ticket.id, { unknownQuestion: false });
      if (question.answerOptionId === 'note') {
        const note = await services.notes.create({ type: 'NOTE', content: ticket.text, language: ticket.language });
        await tickets.complete(ticket.id, { outcome: 'done', summary: tr(ticket.language, { nl: 'Bewaard als notitie.', en: 'Saved as a note.', fr: 'Gardé comme note.' }), detail: [], evidence: [{ kind: 'record', label: note.title, ref: { type: 'NOTE', id: note.id } }] }, actor);
        return tickets.require(ticket.id);
      }
      if (question.answerOptionId === 'task') {
        const task = await services.tasks.create({ title: ticket.text.slice(0, 120), source: 'text' });
        await tickets.complete(ticket.id, { outcome: 'done', summary: tr(ticket.language, { nl: 'Taak aangemaakt.', en: 'Task created.', fr: 'Tâche créée.' }), detail: [], evidence: [{ kind: 'record', label: task.title, ref: { type: 'TASK', id: task.id } }] }, actor);
        return tickets.require(ticket.id);
      }
      if (question.answerOptionId === 'cancel') {
        await tickets.cancel(ticket.id, 'user', 'cancelled from question');
        return tickets.require(ticket.id);
      }
      // Free text: the user rephrased the request.
      const planned = await this.planWithEngine(ticket, answer, actor);
      return tickets.require(planned.ticket.id);
    }
    if (typeof ticket.context.pendingStepId === 'string') {
      const plan = ticket.plan.map((s) => (s.id === ticket.context.pendingStepId ? applyAnswerToStep(s, question.answerOptionId, answer) : s));
      await tickets.setPlan(ticket.id, plan);
      await tickets.setContext(ticket.id, { pendingStepId: null });
      return tickets.require(ticket.id);
    }
    // Clarification of the engine's pending command.
    const planned = await this.planWithEngine(ticket, answer, actor);
    return tickets.require(planned.ticket.id);
  }

  /** EDIT on an approval: refine the content and present a new card (supersedes the old one). */
  private async reprepare(ticket: Ticket, approval: Approval, actor: string): Promise<void> {
    const { services, tickets, approvals } = this.deps;
    const instruction = approval.editInstruction ?? '';
    let args = approval.args;
    let note = tr(ticket.language, { nl: 'Aangepast volgens je instructie.', en: 'Adjusted following your instruction.', fr: 'Ajusté selon ton instruction.' });
    if (approval.tool === 'email.send') {
      const draftId = typeof approval.args.draftId === 'string' ? approval.args.draftId : (ticket.context.focus as ButlerFocus | undefined)?.draftId ?? null;
      if (draftId && instruction) {
        const refined = await services.emails.refineDraft(draftId, instruction);
        args = { ...approval.args, draftId: refined.id };
      }
    } else {
      note = tr(ticket.language, { nl: `Je instructie is genoteerd (“${instruction}”); pas de inhoud aan in het detail of keur goed.`, en: `Your instruction was recorded (“${instruction}”); edit the content in the detail or approve.`, fr: `Ton instruction a été notée (« ${instruction} ») ; modifie le contenu ou approuve.` });
    }
    const index = ticket.plan.findIndex((s) => s.approvalId === approval.id);
    const step = index >= 0 ? ticket.plan[index]! : { id: newId(), tool: approval.tool, args, permission: approval.permission, status: 'pending' as const, summary: null, approvalId: null, commandId: null };
    const next = await approvals.request({ ticketId: ticket.id, kind: approval.kind, tool: approval.tool, args, permission: approval.permission, card: { ...(await this.buildCard(ticket, { ...step, args }, Math.max(index, 0), ticket.plan.length)), why: `${note}` }, supersedes: approval });
    const plan = [...ticket.plan];
    if (index >= 0) plan[index] = { ...step, args, status: 'awaiting_approval', approvalId: next.id };
    else plan.push({ ...step, args, status: 'awaiting_approval', approvalId: next.id });
    await tickets.setPlan(ticket.id, plan);
    await tickets.note(ticket.id, `new approval ${next.id} after edit`, actor, { supersedes: approval.id });
  }

  private async answerAboutApproval(ticket: Ticket, actor: string): Promise<void> {
    const { services, approvals, tickets } = this.deps;
    const approvalId = String(ticket.context.approvalId ?? '');
    const approval = approvalId ? await approvals.get(approvalId) : null;
    if (!approval) {
      await tickets.fail(ticket.id, 'approval not found', actor);
      return;
    }
    const facts = [`WHAT: ${approval.card.what}`, `WHY: ${approval.card.why}`, `SOURCE: ${approval.card.source}`, `IMPACT: ${approval.card.impact}`, `TOOL: ${approval.tool} ${JSON.stringify(approval.args).slice(0, 300)}`, approval.card.content ? `CONTENT:\n${approval.card.content.slice(0, 1500)}` : ''].filter(Boolean).join('\n');
    let answer = tr(ticket.language, { nl: `Dit is wat er gebeurt als je goedkeurt:\n${facts}`, en: `This is what happens when you approve:\n${facts}`, fr: `Voici ce qui se passe si tu approuves :\n${facts}` });
    if (services.ai.isAvailable()) {
      try {
        const out = await services.ai.structured({ system: `You are Alfred. Answer the user's question about a pending approval using only the facts given. Never claim anything was sent or executed. Answer in ${ticket.language}. ${UNTRUSTED_CONTENT_RULES}`, user: `${wrapUntrusted('question', clampForPrompt(ticket.text, 1000))}\n\nFacts:\n${facts}`, maxTokens: 500 }, AnswerSchema);
        answer = out.answer;
      } catch {
        // deterministic answer stays
      }
    }
    await approvals.addAlfredNote(approval.id, answer);
    await tickets.complete(ticket.id, { outcome: 'done', summary: answer.slice(0, 200), detail: [answer], evidence: [{ kind: 'note', label: 'answer added to the approval', ref: { type: 'APPROVAL', id: approval.id } }] }, actor);
  }

  private async buildCard(ticket: Ticket, step: TicketPlanStep, index: number, total: number): Promise<Approval['card']> {
    const { services } = this.deps;
    const language = ticket.language;
    const definition = getTool(step.tool);
    let what = step.tool;
    if (definition) {
      try {
        const preview = definition.describe(definition.schema.parse(step.args), language);
        what = `${preview.label}: ${preview.title}${preview.lines.length ? ` – ${preview.lines.slice(0, 3).join(' · ')}` : ''}`;
      } catch {
        what = `${step.tool} ${JSON.stringify(step.args).slice(0, 120)}`;
      }
    } else if (step.tool.startsWith('capture:')) {
      what = `${step.tool.slice(8)}: ${String((step.args.command as Command | undefined)?.originalText ?? '').slice(0, 120)}`;
    }
    const sourceEmail = ticket.emailId ? await services.emails.get(ticket.emailId) : null;
    const source = sourceEmail ? `${tr(language, { nl: 'E-mail van', en: 'Email from', fr: 'E-mail de' })} ${sourceEmail.from.name ?? sourceEmail.from.email}: “${sourceEmail.subject}”` : `${ticket.source}${ticket.sourceRef ? ` ${ticket.sourceRef}` : ''}: “${ticket.text.slice(0, 160)}”`;
    const why = `${tr(language, { nl: 'Ticket', en: 'Ticket', fr: 'Ticket' })} “${ticket.title}” – ${tr(language, { nl: 'stap', en: 'step', fr: 'étape' })} ${index + 1}/${total}`;
    const impact = impactOf(step.permission, step.tool, language);
    const content = await this.cardContent(step, ticket);
    return { what, why, source, impact, content };
  }

  private async cardContent(step: TicketPlanStep, ticket: Ticket): Promise<string | null> {
    const { services } = this.deps;
    const focus = ticket.context.focus as ButlerFocus | undefined;
    try {
      if (step.tool === 'email.send') {
        const draftId = typeof step.args.draftId === 'string' ? step.args.draftId : focus?.draftId ?? null;
        const draft = draftId ? await services.emails.getDraft(draftId) : null;
        return draft ? `To: ${draft.to.map((t) => t.email).join(', ')}\nSubject: ${draft.subject}\n\n${draft.body}` : null;
      }
      if (step.tool === 'invoice.issue' || step.tool === 'invoice.markPaid' || step.tool === 'invoice.generatePdf') {
        const invoiceId = typeof step.args.invoiceId === 'string' ? step.args.invoiceId : focus?.invoiceId ?? null;
        const invoice = invoiceId ? await services.invoices.get(invoiceId) : null;
        return invoice ? `${invoice.counterpartyName} – ${formatCents(invoice.totalCents, invoice.currency, ticket.language)} (${invoice.lines.length} ${tr(ticket.language, { nl: 'lijnen', en: 'lines', fr: 'lignes' })}, ${invoice.status})` : null;
      }
      if (step.tool.startsWith('capture:')) return String((step.args.command as Command | undefined)?.originalText ?? '');
      if (step.tool === 'workflow.resume') {
        const run = typeof step.args.runId === 'string' ? await services.workflows.getRun(step.args.runId) : null;
        if (!run) return null;
        const remaining = run.steps.slice(run.nextStep).map((s, i) => `${i + 1}. ${s.action}${'title' in s && s.title ? `: ${s.title}` : 'message' in s ? `: ${s.message}` : ''}`);
        return [`${run.workflowName} – ${run.eventSummary}`, ...run.log.slice(-3).map((l) => `✓ ${l}`), ...remaining].join('\n');
      }
      const json = JSON.stringify(step.args, null, 1);
      return json.length > 1500 ? `${json.slice(0, 1497)}…` : json;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Specialist roles
  // ---------------------------------------------------------------------------

  private async runSoftware(ticket: Ticket, actor: string): Promise<void> {
    const { tickets } = this.deps;
    const repo = this.deps.repo();
    if (!(await repo.isAvailable())) throw new DomainError('REPO_UNAVAILABLE');
    const evidence: TicketEvidence[] = [];
    const detail: string[] = [];
    const summary = await repo.inspect();
    detail.push(`repo ${summary.name ?? summary.root} (${summary.fileCount} files, branch ${summary.branch ?? '?'})`);
    const keywords = ticket.text.split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 4).slice(0, 3);
    for (const keyword of keywords) {
      const hits = await repo.search(keyword, { limit: 5 }).catch(() => []);
      if (hits.length) {
        detail.push(`"${keyword}": ${hits.map((h) => `${h.path}:${h.line}`).join(', ')}`);
        evidence.push({ kind: 'file', label: `search ${keyword}`, detail: hits.map((h) => `${h.path}:${h.line}`).join('\n') });
      }
    }
    for (const [label, run] of [['typecheck', () => repo.runTypecheck()], ['tests', () => repo.runTests()]] as const) {
      const result = await run().catch((e: unknown) => ({ command: label, exitCode: null, stdout: '', stderr: e instanceof Error ? e.message : String(e), durationMs: 0, truncated: false }));
      detail.push(`${label}: exit ${result.exitCode ?? 'n/a'} (${Math.round(result.durationMs / 1000)}s)`);
      evidence.push({ kind: 'test', label: `${label} exit ${result.exitCode ?? 'n/a'}`, detail: `${result.command}\n${(result.stdout + result.stderr).slice(-1500)}` });
    }
    const diff = await repo.gitDiff().catch(() => '');
    if (diff.trim()) evidence.push({ kind: 'file', label: 'working tree diff', detail: diff.slice(0, 4000) });
    await tickets.complete(ticket.id, { outcome: 'prepared', summary: tr(ticket.language, { nl: 'Repo geïnspecteerd en gecontroleerd; wijzigingen worden niet autonoom gemaakt – zie bewijs.', en: 'Repository inspected and checked; changes are not made autonomously – see evidence.', fr: 'Dépôt inspecté et vérifié ; aucune modification autonome – voir les preuves.' }), detail, evidence }, actor);
  }

  private async runKnowledgeWork(ticket: Ticket, actor: string): Promise<void> {
    const { services, tickets } = this.deps;
    if (!services.ai.isAvailable()) throw new DomainError('AI_UNAVAILABLE', tr(ticket.language, { nl: 'Deze rol heeft cloud-AI nodig (Instellingen → AI).', en: 'This role needs cloud AI (Settings → AI).', fr: 'Ce rôle nécessite l’IA cloud (Réglages → IA).' }));
    const profile = ROLE_PROFILES[ticket.role];
    const facts = await this.deps.advisory.buildBrief(ticket.text, ticket.language);
    const out = await services.ai.structured({ system: `${profile.framing} Produce a draft for the user to review. Separate facts (from the brief) from assumptions. Answer in ${ticket.language}. ${UNTRUSTED_CONTENT_RULES}`, user: `${wrapUntrusted('request', clampForPrompt(ticket.text, 3000))}\n\n${facts}`, maxTokens: 1500 }, KnowledgeSchema);
    const content = [out.summary, '', ...out.sections.flatMap((s) => [`## ${s.heading}`, ...s.bullets.map((b) => `- ${b}`), '']), out.assumptions.length ? `${tr(ticket.language, { nl: 'Aannames', en: 'Assumptions', fr: 'Hypothèses' })}:\n${out.assumptions.map((a) => `- ${a}`).join('\n')}` : '', out.openQuestions.length ? `${tr(ticket.language, { nl: 'Open vragen', en: 'Open questions', fr: 'Questions ouvertes' })}:\n${out.openQuestions.map((q) => `- ${q}`).join('\n')}` : ''].filter((l) => l !== undefined).join('\n');
    const note = await services.notes.create({ type: 'NOTE', title: out.title, content, language: ticket.language, tags: [ticket.role.toLowerCase(), 'alfred-draft'] });
    await tickets.complete(ticket.id, { outcome: 'prepared', summary: `${out.title}: ${out.summary.slice(0, 160)}`, detail: out.assumptions.map((a) => `assumption: ${a}`), evidence: [{ kind: 'draft', label: out.title, ref: { type: 'NOTE', id: note.id } }] }, actor);
  }
}

function applyAnswerToStep(step: TicketPlanStep, optionId: string | null, text: string): TicketPlanStep {
  const definition = getTool(step.tool);
  const shape = definition ? ((definition.schema as z.ZodObject<z.ZodRawShape>).shape ?? {}) : {};
  const key = ANSWER_KEYS.find((k) => k in shape) ?? null;
  const args = { ...step.args };
  if (key) args[key] = optionId ?? text;
  if (optionId && `${key}Id` in shape) args[`${key}Id`] = optionId;
  return { ...step, args, status: 'pending' };
}

function impactOf(permission: ToolPermission, tool: string, language: Language): string {
  if (permission === 'external') return tr(language, { nl: 'Verlaat het toestel (e-mail/verzending) – kan niet ongedaan gemaakt worden.', en: 'Leaves the device (email/sending) – cannot be undone.', fr: 'Quitte l’appareil (e-mail/envoi) – irréversible.' });
  if (permission === 'sensitive') return tool.startsWith('home.') ? tr(language, { nl: 'Fysieke actie in huis.', en: 'Physical action at home.', fr: 'Action physique à la maison.' }) : tr(language, { nl: 'Financieel of juridisch record (factuurnummer, betaling, goedkeuring).', en: 'Financial or legal record (invoice number, payment, approval).', fr: 'Enregistrement financier ou juridique (numéro de facture, paiement, approbation).' });
  return tr(language, { nl: 'Maakt of wijzigt lokale gegevens; kan ongedaan gemaakt worden.', en: 'Creates or changes local records; can be undone.', fr: 'Crée ou modifie des données locales ; réversible.' });
}

function isTerminal(ticket: Ticket): boolean {
  return ticket.status === 'COMPLETED' || ticket.status === 'FAILED' || ticket.status === 'CANCELLED' || ticket.status === 'WAITING_QUESTION' || ticket.status === 'WAITING_APPROVAL';
}

function tr(language: Language, t: Record<Language, string>): string {
  return t[language];
}

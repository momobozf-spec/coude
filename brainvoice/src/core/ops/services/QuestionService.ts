import type { OutboxService } from './OutboxService';
import type { TicketService } from './TicketService';
import type { Database } from '../../db/Database';
import type { AgentQuestion, QuestionOption, QuestionStatus } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';
import type { OpsSettings } from '../settings';

export interface AskInput {
  ticketId: string;
  question: string;
  context?: string | null;
  options?: QuestionOption[];
  allowFreeText?: boolean;
}

/**
 * Blocking agent questions (§158). One open question per ticket – Alfred batches what
 * he needs into a single question instead of spamming – and the answer resumes the
 * ticket through the queue.
 */
export class QuestionService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly tickets: TicketService,
    private readonly outbox: OutboxService,
    private readonly settings: () => OpsSettings,
  ) {}

  async ask(input: AskInput): Promise<AgentQuestion> {
    const existing = await this.db.questions.openForTicket(input.ticketId);
    if (existing) return existing;
    const nowISO = this.clock.nowISO();
    const question: AgentQuestion = {
      id: newId(),
      ticketId: input.ticketId,
      question: input.question.trim(),
      context: input.context ?? null,
      options: input.options ?? [],
      allowFreeText: input.allowFreeText ?? true,
      status: 'OPEN',
      answerText: null,
      answerOptionId: null,
      createdAt: nowISO,
      answeredAt: null,
      expiresAt: this.clock.now().plus({ days: Math.max(1, this.settings().approvalExpiryDays) }).toISO({ suppressMilliseconds: true }),
    };
    if (!question.question) throw new DomainError('VALIDATION_FAILED', 'A question needs text');
    await this.db.questions.insert(question);
    await this.tickets.transition(input.ticketId, 'WAITING_QUESTION', { actor: 'alfred', eventType: 'question_asked', message: question.question, data: { questionId: question.id } });
    await this.outbox.publish('question.asked', { questionId: question.id, ticketId: input.ticketId, question: question.question });
    return question;
  }

  async answer(id: string, answer: { optionId?: string | null; text?: string | null }, actor = 'user'): Promise<AgentQuestion> {
    const question = await this.require(id);
    const option = answer.optionId ? question.options.find((o) => o.id === answer.optionId) : null;
    if (answer.optionId && !option) throw new DomainError('INVALID_ARGUMENTS', `Unknown option ${answer.optionId}`);
    const text = answer.text?.trim() || null;
    if (!option && !text) throw new DomainError('VALIDATION_FAILED', 'Pick an option or type an answer');
    if (!option && text && !question.allowFreeText) throw new DomainError('VALIDATION_FAILED', 'This question only accepts one of its options');
    const nowISO = this.clock.nowISO();
    const ok = await this.db.questions.answer(id, { answerText: text ?? option?.label ?? null, answerOptionId: option?.id ?? null, nowISO });
    if (!ok) throw new DomainError('TICKET_STATE', `Question ${id} is ${question.status}, not open`);
    const ticket = await this.tickets.transition(question.ticketId, 'QUEUED', { actor, eventType: 'question_answered', message: text ?? option?.label ?? '', data: { questionId: id, optionId: option?.id ?? null }, allowFrom: ['WAITING_QUESTION', 'BLOCKED', 'QUEUED'] });
    await this.tickets.enqueueProcessing(ticket, { reason: `question:${id}`, payload: { questionId: id } });
    await this.outbox.publish('question.answered', { questionId: id, ticketId: question.ticketId });
    return this.require(id);
  }

  async cancelForTicket(ticketId: string): Promise<number> {
    const open = await this.db.questions.list({ ticketId, status: 'OPEN' });
    for (const q of open) await this.db.questions.update({ ...q, status: 'CANCELLED' });
    return open.length;
  }

  async expireDue(): Promise<number> {
    const nowISO = this.clock.nowISO();
    const expired = await this.db.questions.listExpired(nowISO);
    for (const q of expired) {
      await this.db.questions.update({ ...q, status: 'EXPIRED' });
      const ticket = await this.db.tickets.getById(q.ticketId);
      if (ticket?.status === 'WAITING_QUESTION') await this.tickets.block(ticket.id, `question expired: ${q.question}`, 'system');
    }
    return expired.length;
  }

  list(status: QuestionStatus | 'all' = 'OPEN', limit = 100): Promise<AgentQuestion[]> {
    return this.db.questions.list({ status, limit });
  }

  forTicket(ticketId: string): Promise<AgentQuestion[]> {
    return this.db.questions.list({ ticketId, status: 'all' });
  }

  get(id: string): Promise<AgentQuestion | null> {
    return this.db.questions.getById(id);
  }

  async require(id: string): Promise<AgentQuestion> {
    const question = await this.db.questions.getById(id);
    if (!question) throw new DomainError('NOT_FOUND', `Question ${id} not found`);
    return question;
  }

  countOpen(): Promise<number> {
    return this.db.questions.countOpen();
  }
}

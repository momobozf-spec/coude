import {
  TaskStatus,
  type IsoDate,
  type IsoDateTime,
  type TaskDetail,
  type TaskStatus as TaskStatusValue,
} from '@orbit/types';
import { nextOccurrenceAfterCompletion } from '../recurrence/engine';

/**
 * Wat er gebeurt als je een taak afvinkt.
 *
 * Bij een herhalende taak maken we *geen* nieuwe rij aan maar schuiven we de
 * deadline van dezelfde taak door. Dat is bewust:
 *
 * - de taak houdt zijn id, dus links vanuit notities, bijlagen en subtaken
 *   blijven wijzen naar het ding dat de gebruiker "die ene wekelijkse taak" noemt;
 * - een dagelijkse taak levert anders 365 rijen per jaar op, per gebruiker;
 * - de geschiedenis blijft bewaard in het activiteitenlog, waar hij thuishoort.
 *
 * De prijs is dat "Voltooid" losse voorkomens niet als aparte regels toont; dat
 * is dezelfde afweging die Todoist en Things maken.
 */

export type CompletionKind = 'COMPLETED' | 'RESCHEDULED';

export interface TaskCompletionPlan {
  kind: CompletionKind;
  status: TaskStatusValue;
  completedAt: IsoDateTime | null;
  dueDate: IsoDate | null;
  /** De deadline waar de taak vandaan komt; gaat mee in het activiteitenlog. */
  previousDueDate: IsoDate | null;
  /** Vinkjes gaan uit bij een nieuwe ronde van een herhalende taak. */
  resetChecklist: boolean;
  /** De reeks liep af met dit voorkomen. */
  recurrenceFinished: boolean;
}

export interface CompletionContext {
  /** De kalenderdag waarop de gebruiker afvinkte, in diens eigen tijdzone. */
  completedOn: IsoDate;
  now: IsoDateTime;
}

export function planTaskCompletion(
  task: Pick<TaskDetail, 'dueDate' | 'recurrence' | 'status'>,
  ctx: CompletionContext,
): TaskCompletionPlan {
  const previousDueDate = task.dueDate;

  if (!task.recurrence || !task.dueDate) {
    return {
      kind: 'COMPLETED',
      status: TaskStatus.Done,
      completedAt: ctx.now,
      dueDate: task.dueDate,
      previousDueDate,
      resetChecklist: false,
      recurrenceFinished: false,
    };
  }

  const next = nextOccurrenceAfterCompletion(task.recurrence, task.dueDate, ctx.completedOn);

  if (!next) {
    return {
      kind: 'COMPLETED',
      status: TaskStatus.Done,
      completedAt: ctx.now,
      dueDate: task.dueDate,
      previousDueDate,
      resetChecklist: false,
      recurrenceFinished: true,
    };
  }

  return {
    kind: 'RESCHEDULED',
    status: TaskStatus.Todo,
    completedAt: null,
    dueDate: next,
    previousDueDate,
    resetChecklist: true,
    recurrenceFinished: false,
  };
}

export interface TaskReopenPlan {
  status: TaskStatusValue;
  completedAt: null;
}

export function planTaskReopen(): TaskReopenPlan {
  return { status: TaskStatus.Todo, completedAt: null };
}

/** Voortgang van een taak met subtaken; gebruikt in de lijst en op het detailscherm. */
export function subtaskProgress(subtasks: readonly { status: TaskStatusValue }[]): {
  total: number;
  done: number;
  percent: number;
} {
  const total = subtasks.length;
  const done = subtasks.filter((subtask) => subtask.status === TaskStatus.Done).length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * Een taak telt als achterstallig zodra de dag voorbij is, niet zodra het
 * tijdstip voorbij is. Een taak van 09:00 die je om 10:00 afvinkt was gewoon
 * op tijd; pas de volgende dag is hij te laat.
 */
export function isOverdue(
  task: Pick<TaskDetail, 'dueDate' | 'status'>,
  today: IsoDate,
): boolean {
  if (!task.dueDate) return false;
  if (task.status === TaskStatus.Done || task.status === TaskStatus.Cancelled) return false;
  return task.dueDate < today;
}

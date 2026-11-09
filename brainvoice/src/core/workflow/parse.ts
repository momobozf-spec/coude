import type { DateTime } from 'luxon';

import type { WorkflowCondition, WorkflowStep, WorkflowTrigger } from '../domain/admin';
import type { Language, Recurrence } from '../types/common';

/**
 * Natural-language configuration of workflows and recurring administration (§129–§130).
 * Pure functions so the AdminParser and the WorkflowService share one grammar.
 */

export interface ParsedWorkflow {
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
  sourceText: string;
}

export interface RecurringAdminPlan {
  title: string;
  schedule: 'month_end' | 'month_start' | 'weekly' | 'daily';
  weekday: number | null;
  firstDate: string;
  recurrence: Recurrence;
}

const NUMBER_WORDS: Record<string, number> = { een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, veertien: 14, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, quatorze: 14 };

export function numberWord(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
}

export const DAY_WORD = String.raw`(?<n>\d+|een|één|twee|drie|vier|vijf|zes|zeven|tien|veertien|one|two|three|four|five|six|seven|ten|fourteen|un|une|deux|trois|quatre|cinq|sept|dix|quatorze)`;

const INVOICE_REMINDER_RULES: RegExp[] = [
  new RegExp(String.raw`\b(?:als|wanneer|telkens als|elke keer dat|zodra)\s+ik\s+(?:een\s+)?factuur\s+(?:ontvang|binnenkrijg|krijg)\b.*\b(?:herinner|verwittig|waarschuw)\s+(?:mij|me)\s+${DAY_WORD}\s+dag(?:en)?\s+(?:voor|vóór|op voorhand van)\s+(?:de\s+)?(?:vervaldatum|vervaldag|betaaldatum)`, 'iu'),
  new RegExp(String.raw`\b(?:if|when|whenever|each time|every time)\s+i\s+(?:receive|get)\s+(?:an\s+)?invoice\b.*\bremind\s+me\s+${DAY_WORD}\s+days?\s+before\s+(?:the\s+)?(?:due date|deadline|it is due|it's due)`, 'iu'),
  new RegExp(String.raw`\b(?:quand|lorsque|chaque fois que|si|dès que)\s+je\s+re[cç]ois\s+(?:une\s+)?facture\b.*\brappelle[- ]moi\s+${DAY_WORD}\s+jours?\s+avant\s+(?:la\s+date\s+d'|l')?(?:échéance|echeance)`, 'iu'),
];

const INVOICE_TASK_RULES: RegExp[] = [
  /\b(?:als|wanneer|zodra)\s+ik\s+(?:een\s+)?factuur\s+(?:ontvang|binnenkrijg|krijg)\b.*\b(?:maak|zet)\s+(?:er\s+)?(?:een\s+)?taak\b/iu,
  /\b(?:if|when|whenever)\s+i\s+(?:receive|get)\s+(?:an\s+)?invoice\b.*\b(?:create|add|make)\s+(?:a\s+)?task\b/iu,
  /\b(?:quand|lorsque|si|dès que)\s+je\s+re[cç]ois\s+(?:une\s+)?facture\b.*\b(?:crée|cree|ajoute)\s+(?:une\s+)?tâche\b/iu,
];

const RECURRING_RULES: { re: RegExp; schedule: RecurringAdminPlan['schedule'] }[] = [
  { re: /\b(?:op\s+)?(?:het\s+)?(?:einde|eind)\s+van\s+(?:elke|iedere|de)\s+maand\b|\b(?:at\s+)?(?:the\s+)?end\s+of\s+(?:every|each|the)\s+month\b|\b(?:à\s+la\s+)?fin\s+de\s+(?:chaque|du)\s+mois\b|\bmaandelijks\b|\bmonthly\b|\bmensuellement\b|\belke\s+maand\b|\bevery\s+month\b|\bchaque\s+mois\b/iu, schedule: 'month_end' },
  { re: /\b(?:het\s+)?begin\s+van\s+(?:elke|iedere|de)\s+maand\b|\b(?:at\s+)?(?:the\s+)?(?:start|beginning)\s+of\s+(?:every|each|the)\s+month\b|\bdébut\s+de\s+(?:chaque|du)\s+mois\b/iu, schedule: 'month_start' },
  { re: /\belke\s+week\b|\bwekelijks\b|\b(?:every|each)\s+week\b|\bweekly\b|\bchaque\s+semaine\b|\btoutes\s+les\s+semaines\b|\b(?:elke|iedere)\s+(?:maandag|dinsdag|woensdag|donderdag|vrijdag)\b|\bevery\s+(?:monday|tuesday|wednesday|thursday|friday)\b|\bchaque\s+(?:lundi|mardi|mercredi|jeudi|vendredi)\b/iu, schedule: 'weekly' },
  { re: /\belke\s+dag\b|\bdagelijks\b|\bevery\s+day\b|\bdaily\b|\bchaque\s+jour\b|\btous\s+les\s+jours\b/iu, schedule: 'daily' },
];

const WEEKDAYS: Record<string, number> = { maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 7, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7 };

/** "Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum." → workflow definition (null = not a workflow sentence). */
export function parseWorkflowText(text: string, language: Language): ParsedWorkflow | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  for (const re of INVOICE_REMINDER_RULES) {
    const m = re.exec(normalized);
    if (m) {
      const days = numberWord(m.groups?.n) ?? 3;
      return {
        name: { nl: `Factuurherinnering ${days} dagen voor vervaldatum`, en: `Invoice reminder ${days} days before due date`, fr: `Rappel de facture ${days} jours avant l'échéance` }[language],
        description: normalized,
        trigger: { type: 'invoice.received' },
        conditions: [{ field: 'invoice.dueDate', op: 'exists' }],
        steps: [{ action: 'link_counterparty' }, { action: 'create_reminder', dateField: 'invoice.dueDate', offsetDays: -days }],
        sourceText: normalized,
      };
    }
  }
  for (const re of INVOICE_TASK_RULES) {
    if (re.test(normalized)) {
      return {
        name: { nl: 'Taak bij ontvangen factuur', en: 'Task for received invoice', fr: 'Tâche pour facture reçue' }[language],
        description: normalized,
        trigger: { type: 'invoice.received' },
        conditions: [],
        steps: [{ action: 'link_counterparty' }, { action: 'create_task', title: { nl: 'Factuur betalen: {invoice.counterpartyName}', en: 'Pay invoice: {invoice.counterpartyName}', fr: 'Payer la facture : {invoice.counterpartyName}' }[language], dateField: 'invoice.dueDate', offsetDays: 0 }],
        sourceText: normalized,
      };
    }
  }
  return null;
}

/** "Herinner mij op het einde van elke maand mijn facturen op te maken." → recurring task plan. */
export function parseRecurringText(text: string, language: Language, now: DateTime, timezone: string): RecurringAdminPlan | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  if (!/^(?:herinner|verwittig|remind|rappelle)/i.test(normalized) && !/\b(?:elke|iedere|every|each|chaque|tous les|maandelijks|wekelijks|dagelijks|monthly|weekly|daily)\b/i.test(lower)) return null;
  const rule = RECURRING_RULES.find((r) => r.re.test(lower));
  if (!rule) return null;
  let title = normalized
    .replace(/^(?:herinner|verwittig)\s+(?:mij|me)\s+(?:er\s*aan\s+)?/i, '')
    .replace(/^remind\s+me\s+/i, '')
    .replace(/^rappelle[- ]moi\s+(?:de\s+|d')?/i, '')
    .replace(rule.re, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .replace(/^(?:om|to|de|d')\s+/i, '');
  if (language === 'nl') {
    title = title.replace(/\bop te maken\b/i, 'opmaken').replace(/\bte\s+(\w+)$/i, '$1').replace(/^mijn\s+/i, '').replace(/^om\s+/i, '');
  }
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const weekdayMatch = /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.exec(lower);
  const weekday = weekdayMatch ? (WEEKDAYS[weekdayMatch[1]?.toLowerCase() ?? ''] ?? null) : null;
  const today = now.setZone(timezone).startOf('day');
  let firstDate: DateTime;
  let recurrence: Recurrence;
  switch (rule.schedule) {
    case 'month_end':
      firstDate = today.endOf('month');
      recurrence = { frequency: 'MONTHLY', interval: 1, bySetPosition: -1 };
      break;
    case 'month_start':
      firstDate = today.day === 1 ? today : today.plus({ months: 1 }).startOf('month');
      recurrence = { frequency: 'MONTHLY', interval: 1, bySetPosition: 1 };
      break;
    case 'weekly': {
      const wd = (weekday ?? 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      firstDate = today.weekday <= wd ? today.set({ weekday: wd }) : today.plus({ weeks: 1 }).set({ weekday: wd });
      recurrence = { frequency: 'WEEKLY', interval: 1, byWeekday: [wd] };
      break;
    }
    case 'daily':
    default:
      firstDate = today;
      recurrence = { frequency: 'DAILY', interval: 1 };
      break;
  }
  const fallback: Record<Language, string> = { nl: 'Administratie', en: 'Administration', fr: 'Administration' };
  return { title: title || fallback[language], schedule: rule.schedule, weekday, firstDate: firstDate.toISODate() ?? today.toISODate() ?? '', recurrence };
}

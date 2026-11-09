import type { DateTime } from 'luxon';

import { computeNextRun, describeSpec } from './nextRun';
import type { ScheduleSpec } from '../../domain/ops';
import type { Language } from '../../types/common';
import { capitalizeFirst, collapseWhitespace } from '../../util/text';

/**
 * Natural-language automations (§163): "Elke maandag om 9u: geef me de open facturen",
 * "Every weekday at 8, send me my priorities", "Chaque lundi à 9h, résume mes mails".
 * The recurrence phrase is removed from the sentence; what remains is the request that
 * becomes a ticket at every run. The user sees a preview before anything is activated.
 */

export interface AutomationPreview {
  name: string;
  spec: ScheduleSpec;
  timezone: string;
  /** The request Alfred will carry out at every run. */
  action: string;
  description: string;
  nextRunAt: string | null;
  sourceText: string;
}

const WEEKDAYS: Record<string, number> = {
  maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 7,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7,
};

const RECUR = /(?:^|[\s,])(?<prefix>elke|iedere|every|each|tous les|toutes les|chaque)\s+(?<unit>werkdag|werkdagen|weekday|weekdays|jour ouvrable|jours ouvrables|dag|day|jour|jours|ochtend|morgen|morning|matin|avond|evening|soir|week|semaine|maand|month|mois|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|(?<n>\d+)\s*(?<iunit>minuten|minutes|min|uur|hours?|heures?|h))\b/iu;
const TIME = /(?:^|\s)(?:om|at|à|a|rond|around|vers)\s+(?<h>\d{1,2})(?:(?:[:.h]|u)(?<m>\d{2})?)?\s*(?<ap>am|pm|uur|u|h)?(?=[\s,.:;]|$)/iu;

export function parseAutomationText(text: string, language: Language, now: DateTime, timezone: string): AutomationPreview | null {
  const source = collapseWhitespace(text.trim());
  const recur = RECUR.exec(source);
  if (!recur?.groups) return null;
  const unit = recur.groups.unit?.toLowerCase() ?? '';
  let spec: ScheduleSpec | null = null;
  let defaultAt = '09:00';

  if (recur.groups.n) {
    const n = Number(recur.groups.n);
    const iunit = (recur.groups.iunit ?? '').toLowerCase();
    const minutes = /^(uur|hour|hours|heure|heures|h)$/.test(iunit) ? n * 60 : n;
    if (n > 0) spec = { kind: 'interval', everyMinutes: Math.max(5, minutes) };
  } else if (WEEKDAYS[unit]) {
    spec = { kind: 'weekly', weekdays: [WEEKDAYS[unit]!] };
  } else if (/^(werkdag|werkdagen|weekday|weekdays|jour ouvrable|jours ouvrables)$/.test(unit)) {
    spec = { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] };
  } else if (/^(week|semaine)$/.test(unit)) {
    spec = { kind: 'weekly', weekdays: [1] };
  } else if (/^(maand|month|mois)$/.test(unit)) {
    spec = { kind: 'cron', cron: '0 9 1 * *' };
  } else if (/^(ochtend|morgen|morning|matin)$/.test(unit)) {
    spec = { kind: 'daily' };
    defaultAt = '08:00';
  } else if (/^(avond|evening|soir)$/.test(unit)) {
    spec = { kind: 'daily' };
    defaultAt = '18:00';
  } else if (/^(dag|day|jour|jours)$/.test(unit)) {
    spec = { kind: 'daily' };
  }
  if (!spec) return null;

  let rest = source.replace(recur[0], recur[0].startsWith(' ') || recur[0].startsWith(',') ? ' ' : '');
  const time = TIME.exec(rest);
  if (time?.groups && (spec.kind === 'daily' || spec.kind === 'weekly' || spec.kind === 'cron')) {
    let hour = Number(time.groups.h);
    const minute = Number(time.groups.m ?? '0');
    const ap = (time.groups.ap ?? '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const at = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (spec.kind === 'cron') spec = { kind: 'cron', cron: `${minute} ${hour} 1 * *` };
      else spec = { ...spec, at };
    }
    rest = rest.replace(time[0], ' ');
  } else if (spec.kind === 'daily' || spec.kind === 'weekly') {
    spec = { ...spec, at: defaultAt };
  }

  let action = collapseWhitespace(rest.replace(/^\s*(?:alfred|butler)[,:]?\s*/i, '').replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, ''));
  action = action.replace(/^(?:dan|then|puis)\s+/i, '');
  if (action.length < 3) return null;
  const nextRun = computeNextRun(spec, now, timezone);
  return {
    name: capitalizeFirst(action).slice(0, 80),
    spec,
    timezone,
    action: capitalizeFirst(action),
    description: `${describeSpec(spec, language)} – ${capitalizeFirst(action)}`,
    nextRunAt: nextRun?.toISO({ suppressMilliseconds: true }) ?? null,
    sourceText: source,
  };
}

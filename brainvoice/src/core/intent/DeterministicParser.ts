import type { DateTime } from 'luxon';

import { classifyText, detectPriority, suggestTitle } from './Classifier';
import { extractLocation, extractPeople, recase } from './EntityResolver';
import type { AssistantIntent, Command, CommandBatch, CommandOf, When } from './schema';
import { CLAUSE_STARTERS, FILLERS, LEADING_CONNECTORS, TITLE_NOISE, TRIGGERS, type TriggerIntent, type TriggerRule } from './triggers';
import { DateResolver, dateResolver as defaultResolver, type DateResolution, type ResolveContext, type TimePolicy } from '../date/DateResolver';
import type { InputSource, Language } from '../types/common';
import { newId } from '../util/id';
import { alternation, collapseWhitespace, escapeRegex, normalizeText, sentenceCase, trimPunctuation } from '../util/text';

/**
 * DeterministicParser – rule-based intent parsing for nl / en / fr.
 *
 * It handles the common, well-formed commands offline and with predictable
 * results. Anything it cannot classify falls back to a low-confidence note,
 * which the IntentEngine may hand to the LLM parser.
 */

export interface ParseInput {
  text: string;
  language: Language;
  now: DateTime;
  timezone: string;
  source: InputSource;
  transcript?: string | null;
}

/** Normalised (lower-case) and cased views of the same text; indices line up. */
interface Working {
  n: string;
  c: string;
}

interface CompiledRule {
  rule: TriggerRule;
  regex: RegExp;
  strip: RegExp[] | null;
}

/** Rules whose match covers the whole clause: only these fragments are removed from the title. */
const STRIP_OVERRIDES: Record<Language, { pattern: string; strip: string[] }[]> = {
  en: [
    {
      pattern: `\\b(?:put|add|schedule|plan|book|create|set up|block)\\b.*\\b(?:in|to|on|into)\\s+(?:my\\s+|the\\s+)?(?:calendar|agenda|schedule)\\b`,
      strip: ['^(?:please\\s+)?(?:put|add|schedule|plan|book|create|set up|block)\\s+(?:a\\s+|an\\s+|the\\s+)?'],
    },
  ],
  nl: [
    {
      pattern: `\\b(?:zet|plan|voeg|maak|boek|noteer|schrijf|blokkeer)\\b.*\\b(?:in|op|aan|toe aan)\\s+(?:mijn\\s+|de\\s+|m'n\\s+)?(?:agenda|kalender|planning)\\b`,
      strip: ['^(?:zet|plan|voeg|maak|boek|noteer|schrijf|blokkeer)\\s+(?:een\\s+|de\\s+|het\\s+)?'],
    },
    { pattern: `\\bmaak\\s+(?:mij|me)\\b.*\\bwakker\\b`, strip: ['\\bmaak\\s+(?:mij|me)\\b', '\\bwakker\\b'] },
  ],
  fr: [
    {
      pattern: `\\b(?:mets|met|ajoute|planifie|programme|note|inscris|enregistre|bloque)\\b.*\\b(?:dans|sur|à|a|au)\\s+(?:mon\\s+|l'|le\\s+)?(?:agenda|calendrier|planning)\\b`,
      strip: ['^(?:mets|met|ajoute|planifie|programme|note|inscris|enregistre|bloque)\\s+(?:une?\\s+|le\\s+|la\\s+)?'],
    },
  ],
};

const CONJUNCTION: Record<Language, string> = { en: 'and', nl: 'en', fr: 'et' };
const LIST_SPLIT: Record<Language, RegExp> = {
  en: /\s*,\s*|\s+and\s+(?:then\s+)?/iu,
  nl: /\s*,\s*|\s+en\s+(?:dan\s+|ook\s+)?/iu,
  fr: /\s*,\s*|\s+et\s+(?:puis\s+|ensuite\s+)?/iu,
};
const ABOUT: Record<Language, RegExp> = {
  en: /\s+(?:about|regarding|concerning|re)\s+(.+)$/iu,
  nl: /\s+(?:over|omtrent|in verband met|ivm|i\.v\.m\.)\s+(.+)$/iu,
  fr: /\s+(?:à propos de|a propos de|concernant|au sujet de|sur)\s+(.+)$/iu,
};
const THIS_WEEK: Record<Language, RegExp> = { en: /\bthis week\b/iu, nl: /\bdeze week\b/iu, fr: /\bcette semaine\b/iu };
const SHOPPING_WORDS: Record<Language, RegExp> = { en: /^(?:shopping|grocery|groceries)$/iu, nl: /^(?:boodschappen|winkel)$/iu, fr: /^(?:courses)$/iu };
const TASK_WORDS: Record<Language, RegExp> = { en: /^(?:to-?do|todo|task|tasks)$/iu, nl: /^(?:todo|to-?do|taken)$/iu, fr: /^(?:tâches|taches|choses à faire|à faire)$/iu };
const ALL_DAY: Record<Language, RegExp> = { en: /\b(?:all day|whole day|entire day)\b/iu, nl: /\b(?:hele dag|de hele dag|ganse dag)\b/iu, fr: /\b(?:toute la journée|toute la journee|journée entière|journee entiere)\b/iu };
const QUESTION_START: Record<Language, RegExp> = {
  en: /^(?:why|how|what|when|where|who|which|should|could|can|is|are|does|do)\b/iu,
  nl: /^(?:waarom|hoe|wat|wanneer|waar|wie|welke|moet|kan|is|zijn|zou)\b/iu,
  fr: /^(?:pourquoi|comment|que|quoi|quand|où|ou|qui|quel|quelle|est-ce|faut-il|peut-on)\b/iu,
};
const TARGET_LEAD: Record<Language, RegExp> = {
  en: /^(?:the|my|our|this|that|a|an)\s+/iu,
  nl: /^(?:de|het|mijn|m'n|onze|deze|die|dit|dat|een)\s+/iu,
  fr: /^(?:le|la|les|mon|ma|mes|ce|cet|cette|un|une|l')\s*/iu,
};
const DURATION_WORDS: Record<Language, RegExp> = {
  en: /(\d+(?:[.,]\d+)?|a|an|one|two|three|four|five|ten|fifteen|twenty|twenty-five|thirty|forty-five|sixty|ninety)\s*(?:-\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/iu,
  nl: /(\d+(?:[.,]\d+)?|een|één|twee|drie|vier|vijf|tien|vijftien|twintig|vijfentwintig|dertig|vijfenveertig|zestig|negentig)\s*(seconden|seconde|sec|minuten|minuut|min|uur|uren)\b/iu,
  fr: /(\d+(?:[.,]\d+)?|une?|deux|trois|quatre|cinq|dix|quinze|vingt|vingt-cinq|trente|quarante-cinq|soixante|quatre-vingt-dix)\s*(secondes?|sec|minutes?|min|heures?)\b/iu,
};
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30, 'forty-five': 45, sixty: 60, ninety: 90,
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, tien: 10, vijftien: 15, twintig: 20, vijfentwintig: 25, dertig: 30, vijfenveertig: 45, zestig: 60, negentig: 90,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, dix: 10, quinze: 15, vingt: 20, 'vingt-cinq': 25, trente: 30, 'quarante-cinq': 45, soixante: 60, 'quatre-vingt-dix': 90,
};

function policyFor(intent: TriggerIntent): TimePolicy {
  return intent === 'CREATE_ALARM' ? 'morning' : 'business';
}

function prepareCased(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeSpansBoth(w: Working, spans: readonly { start: number; end: number }[]): Working {
  if (spans.length === 0) return w;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let n = '';
  let c = '';
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue;
    n += w.n.slice(cursor, span.start) + ' ';
    c += w.c.slice(cursor, span.start) + ' ';
    cursor = span.end;
  }
  n += w.n.slice(cursor);
  c += w.c.slice(cursor);
  return { n: collapseWhitespace(n), c: collapseWhitespace(c) };
}

function removeRegexBoth(w: Working, regex: RegExp): Working {
  const spans: { start: number; end: number }[] = [];
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(w.n)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return removeSpansBoth(w, spans);
}

export class DeterministicParser {
  private readonly compiled = new Map<Language, CompiledRule[]>();

  constructor(private readonly resolver: DateResolver = defaultResolver) {}

  parse(input: ParseInput): CommandBatch | null {
    const n = normalizeText(input.text);
    if (!n) return null;
    let c = prepareCased(input.text);
    if (c.length !== n.length) c = n;
    const language = input.language;

    const sentences = this.splitSentences({ n, c });
    const commands: Command[] = [];
    for (const sentence of sentences) {
      const { clauses, sharedPrefix } = this.splitClauses(sentence, language);
      for (const clause of clauses) {
        const parsed = this.parseClause(clause, sharedPrefix, input, commands);
        for (const cmd of parsed) commands.push(cmd);
      }
    }
    if (commands.length === 0) return null;
    const merged = this.mergeFollowUps(commands, language);
    return {
      id: newId(),
      commands: merged,
      originalText: input.text,
      transcript: input.transcript ?? null,
      language,
      source: input.source,
      createdAt: input.now.toISO() ?? new Date().toISOString(),
    };
  }

  /**
   * "I just had an idea. An app for …" – the second sentence is the body of the idea,
   * not a separate note. Free-text sentences following a note/idea are merged into it.
   */
  private mergeFollowUps(commands: Command[], language: Language): Command[] {
    const merged: Command[] = [];
    for (const cmd of commands) {
      const prev = merged[merged.length - 1];
      if (prev && (prev.intent === 'CAPTURE_IDEA' || prev.intent === 'CAPTURE_NOTE') && cmd.intent === 'CAPTURE_NOTE' && cmd.warnings.includes('fallback')) {
        const prevEmpty = prev.content.trim().length === 0 || prev.content === prev.originalText;
        const content = prevEmpty ? cmd.content : `${prev.content.replace(/[.!?]+$/u, '')}. ${cmd.content}`;
        const people = Array.from(new Set([...prev.people, ...cmd.people]));
        const cls = classifyText(content, { isIdea: prev.intent === 'CAPTURE_IDEA', people });
        merged[merged.length - 1] = {
          ...prev,
          content,
          title: suggestTitle(content, language),
          originalText: `${prev.originalText}. ${cmd.originalText}`,
          people,
          category: prev.intent === 'CAPTURE_IDEA' ? cls.category : cls.category === 'Uncategorized' ? null : cls.category,
          tags: cls.tags,
        };
        continue;
      }
      merged.push(cmd);
    }
    return merged;
  }

  // ---------------------------------------------------------------------------
  // Splitting
  // ---------------------------------------------------------------------------

  private splitSentences(w: Working): Working[] {
    const out: Working[] = [];
    const re = /[.!?]+\s+(?=[\p{L}])/gu;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(w.n)) !== null) {
      const end = m.index + m[0].length;
      // do not split decimals such as "8.30 uur" (no whitespace after the dot there anyway)
      out.push({ n: w.n.slice(cursor, m.index), c: w.c.slice(cursor, m.index) });
      cursor = end;
    }
    out.push({ n: w.n.slice(cursor), c: w.c.slice(cursor) });
    return out.map((s) => ({ n: trimPunctuation(s.n), c: trimPunctuation(s.c) })).filter((s) => s.n.length > 0);
  }

  private splitClauses(sentence: Working, language: Language): { clauses: Working[]; sharedPrefix: string | null } {
    const starters = alternation(CLAUSE_STARTERS[language]);
    const conj = CONJUNCTION[language];
    const boundary = new RegExp(`(?:\\s*[,;]\\s*(?:${conj}\\s+)?|\\s+${conj}\\s+)(?=${starters})`, 'giu');
    const clauses: Working[] = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = boundary.exec(sentence.n)) !== null) {
      if (m.index <= cursor) continue;
      clauses.push({ n: sentence.n.slice(cursor, m.index), c: sentence.c.slice(cursor, m.index) });
      cursor = m.index + m[0].length;
    }
    clauses.push({ n: sentence.n.slice(cursor), c: sentence.c.slice(cursor) });

    let sharedPrefix: string | null = null;
    if (clauses.length > 1) {
      const first = clauses[0];
      if (first) {
        const starterAt = new RegExp(starters, 'iu').exec(first.n);
        if (starterAt && starterAt.index > 0) {
          const prefix = first.n.slice(0, starterAt.index).trim();
          const ex = this.resolver.extract(prefix, this.ctx(language, undefined, undefined));
          if (ex.resolution && ex.remainingText.split(' ').filter(Boolean).length <= 1) sharedPrefix = prefix;
        }
      }
    }
    return { clauses: clauses.map((cl) => ({ n: cl.n.trim(), c: cl.c.trim() })).filter((cl) => cl.n.length > 0), sharedPrefix };
  }

  // ---------------------------------------------------------------------------
  // Rule matching
  // ---------------------------------------------------------------------------

  private rules(language: Language): CompiledRule[] {
    const cached = this.compiled.get(language);
    if (cached) return cached;
    const overrides = STRIP_OVERRIDES[language];
    const compiled = TRIGGERS[language].map((rule) => {
      const override = overrides.find((o) => o.pattern === rule.pattern);
      return {
        rule,
        regex: new RegExp(rule.pattern, 'iu'),
        strip: override ? override.strip.map((s) => new RegExp(s, 'iu')) : null,
      };
    });
    this.compiled.set(language, compiled);
    return compiled;
  }

  private matchRule(n: string, language: Language): { compiled: CompiledRule; match: RegExpExecArray } | null {
    for (const compiled of this.rules(language)) {
      const match = compiled.regex.exec(n);
      if (match) return { compiled, match };
    }
    return null;
  }

  private ctx(language: Language, now: DateTime | undefined, timezone: string | undefined, policy: TimePolicy = 'business', preferFuture = true): ResolveContext {
    const nowValue = now ?? DateResolver.now(timezone ?? 'UTC');
    return { now: nowValue, timezone: timezone ?? nowValue.zoneName ?? 'UTC', language, timePolicy: policy, preferFuture };
  }

  private extractBoth(w: Working, rc: ResolveContext): { resolution: DateResolution | null; remaining: Working } {
    const ex = this.resolver.extract(w.n, rc);
    return { resolution: ex.resolution, remaining: removeSpansBoth(w, ex.spans) };
  }

  // ---------------------------------------------------------------------------
  // Clause → command(s)
  // ---------------------------------------------------------------------------

  private parseClause(clause: Working, sharedPrefix: string | null, input: ParseInput, previous: Command[]): Command[] {
    const language = input.language;
    const original = clause;
    const defaultCtx = this.ctx(language, input.now, input.timezone, 'business');

    let working: Working = clause;
    let hit = this.matchRule(working.n, language);
    if (!hit) {
      const pre = this.extractBoth(working, defaultCtx);
      const second = this.matchRule(pre.remaining.n, language);
      if (second) {
        hit = second;
        working = pre.remaining;
      }
    }

    if (!hit) return this.fallback(original, sharedPrefix, input);

    const { compiled, match } = hit;
    const intent = compiled.rule.intent;
    const groups = match.groups ?? {};

    // Strip the trigger from the working text unless the rule uses named capture groups.
    const usesGroups = 'target' in groups || 'query' in groups || 'rest' in groups || 'num' in groups;
    if (compiled.strip) {
      for (const re of compiled.strip) working = removeRegexBoth(working, re);
    } else if (!usesGroups) {
      working = removeSpansBoth(working, [{ start: match.index, end: match.index + match[0].length }]);
    }

    const policy = policyFor(intent);
    const preferFuture = intent !== 'SEARCH_NOTES';
    const rc = this.ctx(language, input.now, input.timezone, policy, preferFuture);

    let resolution: DateResolution | null = null;
    let remaining = working;
    if (intent !== 'CAPTURE_NOTE' && intent !== 'CAPTURE_IDEA') {
      const ex = this.extractBoth(working, rc);
      resolution = ex.resolution ?? this.resolver.extract(original.n, rc).resolution;
      remaining = ex.remaining;
      if ((!resolution || !resolution.date) && sharedPrefix) {
        const combined = this.resolver.extract(`${sharedPrefix} ${original.n}`, rc).resolution;
        if (combined) resolution = combined;
      }
    }

    const base = {
      language,
      originalText: original.c,
      parser: 'deterministic' as const,
      requiresConfirmation: true,
      missingFields: [] as string[],
      clarificationQuestion: null,
      warnings: [] as string[],
    };
    const confidence = compiled.rule.confidence;
    const when = toWhen(resolution, input.timezone);
    const people = extractPeople(original.c, language);

    switch (intent) {
      case 'ALERT_OFFSET': {
        const n = parseCount(groups.num);
        const unit = (groups.unit ?? '').toLowerCase();
        const minutes = /^(?:h|u)/.test(unit) ? n * 60 : n;
        const prevEvent = [...previous].reverse().find((cmd): cmd is CommandOf<'CREATE_CALENDAR_EVENT'> => cmd.intent === 'CREATE_CALENDAR_EVENT');
        if (prevEvent) {
          prevEvent.alerts.push({ offsetMinutes: -minutes });
          return [];
        }
        const prevTimed = [...previous].reverse().find((cmd): cmd is CommandOf<'CREATE_REMINDER' | 'CREATE_TASK'> => (cmd.intent === 'CREATE_REMINDER' || cmd.intent === 'CREATE_TASK') && cmd.when !== null);
        if (prevTimed?.when?.iso) {
          const shifted = shiftWhen(prevTimed.when, -minutes, input.timezone);
          return [{ ...base, id: newId(), intent: 'CREATE_REMINDER', confidence: 0.85, title: prevTimed.title, when: shifted, notes: null, people: [] }];
        }
        return [{ ...base, id: newId(), intent: 'UNKNOWN', confidence: 0.3, text: original.c }];
      }
      case 'CREATE_TIMER': {
        let seconds: number | null = resolution?.durationMinutes ? Math.round(resolution.durationMinutes * 60) : null;
        let label = this.buildTitle(remaining, language);
        if (seconds === null) {
          const dm = DURATION_WORDS[language].exec(original.n);
          if (dm) {
            const count = parseCount(dm[1]);
            const unit = (dm[2] ?? '').toLowerCase();
            seconds = /^(?:sec|s)/.test(unit) ? Math.round(count) : /^(?:h|u)/.test(unit) ? Math.round(count * 3600) : Math.round(count * 60);
            label = this.buildTitle(removeRegexBoth(remaining, DURATION_WORDS[language]), language);
          }
        }
        return [{ ...base, id: newId(), intent: 'CREATE_TIMER', confidence, durationSeconds: seconds, label: label || null }];
      }
      case 'CREATE_ALARM': {
        const label = this.buildTitle(remaining, language);
        return [{ ...base, id: newId(), intent: 'CREATE_ALARM', confidence, when, label: label || null }];
      }
      case 'CREATE_REMINDER': {
        const title = this.buildTitle(remaining, language, { stripArticles: false });
        return [{ ...base, id: newId(), intent: 'CREATE_REMINDER', confidence: title ? confidence : confidence - 0.15, title: title || fallbackTitle(language, 'CREATE_REMINDER'), when, notes: null, people }];
      }
      case 'CREATE_CALENDAR_EVENT': {
        let title = this.buildTitle(remaining, language, { stripArticles: true });
        let notes: string | null = null;
        const about = ABOUT[language].exec(title);
        if (about && about[1] && about.index > 2) {
          notes = sentenceCase(about[1]);
          title = title.slice(0, about.index).trim();
        }
        const loc = extractLocation(title, language);
        title = loc.title || title;
        const duration = resolution?.durationMinutes ?? null;
        return [
          {
            ...base,
            id: newId(),
            intent: 'CREATE_CALENDAR_EVENT',
            confidence: title ? confidence : confidence - 0.15,
            title: title || fallbackTitle(language, 'CREATE_CALENDAR_EVENT'),
            when,
            durationMinutes: duration,
            location: loc.location,
            notes,
            people,
            alerts: [],
            allDay: ALL_DAY[language].test(original.n),
          },
        ];
      }
      case 'CREATE_TASK': {
        const listRaw = groups.list ?? null;
        const listName = listRaw ? (SHOPPING_WORDS[language].test(listRaw) ? 'shopping' : TASK_WORDS[language].test(listRaw) ? null : listRaw) : null;
        let body: Working = remaining;
        if (groups.rest !== undefined) {
          const restIndex = match.index + match[0].indexOf(groups.rest);
          body = { n: groups.rest, c: original.c.slice(restIndex, restIndex + groups.rest.length) };
          const ex = this.extractBoth(body, rc);
          body = ex.remaining;
        }
        const prio = detectPriority(body.n, language);
        if (prio.matched) body = removeRegexBoth(body, new RegExp(escapeRegex(prio.matched), 'iu'));
        const items = this.splitList(body, language);
        const cls = classifyText(original.n, { people });
        return items.map((item) => {
          const title = this.buildTitle(item, language, { stripArticles: false });
          return {
            ...base,
            id: newId(),
            intent: 'CREATE_TASK' as const,
            confidence: title ? confidence : confidence - 0.2,
            title: title || fallbackTitle(language, 'CREATE_TASK'),
            description: null,
            when,
            priority: prio.priority,
            category: listName === 'shopping' ? 'Shopping' : cls.category === 'Uncategorized' ? null : cls.category,
            tags: cls.tags,
            people: extractPeople(item.c, language),
            listName,
          };
        });
      }
      case 'CAPTURE_NOTE':
      case 'CAPTURE_IDEA': {
        const content = this.buildContent(working, language);
        const isIdea = intent === 'CAPTURE_IDEA';
        const cls = classifyText(content, { isIdea, people });
        const title = suggestTitle(recase(content.toLowerCase(), working.c), language);
        if (isIdea) {
          return [{ ...base, id: newId(), intent: 'CAPTURE_IDEA', confidence, title: title || fallbackTitle(language, 'CAPTURE_IDEA'), content: content || original.c, category: cls.category, tags: cls.tags, people }];
        }
        const isQuestion = /\?$/.test(original.n) || QUESTION_START[language].test(content);
        const isThought = compiled.rule.confidence <= 0.65 || /^(?:thought|gedachte|pensée|pensee)/iu.test(original.n);
        return [
          {
            ...base,
            id: newId(),
            intent: 'CAPTURE_NOTE',
            confidence,
            title: title || fallbackTitle(language, 'CAPTURE_NOTE'),
            content: content || original.c,
            category: cls.category === 'Uncategorized' ? null : cls.category,
            tags: cls.tags,
            people,
            noteType: isQuestion ? 'QUESTION' : isThought ? 'THOUGHT' : 'NOTE',
          },
        ];
      }
      case 'COMPLETE_TASK': {
        const target = recase(this.cleanTarget(groups.target ?? remaining.n, language), original.c);
        return [{ ...base, id: newId(), intent: 'COMPLETE_TASK', confidence, targetQuery: target || original.c }];
      }
      case 'UPDATE_TASK': {
        const target = recase(this.cleanTarget(groups.target ?? '', language), original.c);
        const rest = groups.rest ?? '';
        const restRes = this.resolver.extract(rest, rc).resolution;
        const restWhen = toWhen(restRes, input.timezone);
        const changes: CommandOf<'UPDATE_TASK'>['changes'] = {};
        if (restWhen) changes.when = restWhen;
        else if (rest.trim()) changes.title = sentenceCase(recase(rest.trim(), original.c));
        return [{ ...base, id: newId(), intent: 'UPDATE_TASK', confidence, targetQuery: target || original.c, changes }];
      }
      case 'DELETE_EVENT': {
        const targetRaw = groups.target ?? remaining.n;
        const targetEx = this.resolver.extract(targetRaw, rc);
        const target = recase(this.cleanTarget(targetEx.remainingText, language), original.c);
        return [{ ...base, id: newId(), intent: 'DELETE_EVENT', confidence, targetQuery: target || original.c, when: toWhen(targetEx.resolution, input.timezone) }];
      }
      case 'SEARCH_NOTES': {
        const rawQuery = groups.query ?? remaining.n;
        const qEx = this.resolver.extract(rawQuery, rc);
        const dateRes = qEx.resolution ?? resolution;
        let query = this.cleanTarget(qEx.remainingText, language);
        query = query.replace(/\?+$/u, '').trim();
        const typesWord = (groups.types ?? '').toLowerCase();
        const types: CommandOf<'SEARCH_NOTES'>['filters']['types'] = [];
        if (/^id/.test(typesWord)) types.push('IDEA');
        else if (/^(?:note|noti)/.test(typesWord)) types.push('NOTE');
        else if (/^(?:thought|gedacht|pens)/.test(typesWord)) types.push('THOUGHT');
        else if (/^(?:task|taak|taken|tâche|tache)/.test(typesWord)) types.push('TASK');
        else if (/^(?:reminder|herinnering|rappel)/.test(typesWord)) types.push('REMINDER');
        if (/^(?:buy|get|order|pick up|kopen|halen|bestellen|acheter|commander)$/iu.test(query)) types.push('TASK');
        const person = extractPeople(recase(query, original.c), language, { allowSentenceStart: true })[0] ?? null;
        return [
          {
            ...base,
            id: newId(),
            intent: 'SEARCH_NOTES',
            confidence: query ? confidence : confidence - 0.3,
            query: recase(query, original.c) || original.c,
            filters: {
              from: dateRes?.date ?? null,
              to: dateRes?.endDate ?? dateRes?.date ?? null,
              category: null,
              person,
              types,
            },
          },
        ];
      }
      case 'GET_AGENDA': {
        let rangeDays = 1;
        if (resolution?.isRange && resolution.date && resolution.endDate) rangeDays = daysBetween(resolution.date, resolution.endDate) + 1;
        if (THIS_WEEK[language].test(original.n)) rangeDays = 7;
        return [{ ...base, id: newId(), intent: 'GET_AGENDA', confidence, when, rangeDays }];
      }
      case 'GET_TASKS': {
        const today = input.now.setZone(input.timezone).toISODate();
        const tomorrow = input.now.setZone(input.timezone).plus({ days: 1 }).toISODate();
        let filter: CommandOf<'GET_TASKS'>['filter'] = 'today';
        if (when?.date === tomorrow) filter = 'tomorrow';
        else if (when?.date && when.date !== today) filter = 'date';
        else if (THIS_WEEK[language].test(original.n) || (resolution?.isRange && resolution.endDate)) filter = 'upcoming';
        return [{ ...base, id: newId(), intent: 'GET_TASKS', confidence, when, filter }];
      }
      case 'UPDATE_EVENT':
      case 'UNKNOWN':
      default:
        return [{ ...base, id: newId(), intent: 'UNKNOWN', confidence: 0.3, text: original.c }];
    }
  }

  private fallback(original: Working, sharedPrefix: string | null, input: ParseInput): Command[] {
    const language = input.language;
    const rc = this.ctx(language, input.now, input.timezone, 'business');
    const ex = this.extractBoth(original, rc);
    let resolution = ex.resolution;
    if ((!resolution || !resolution.date) && sharedPrefix) resolution = this.resolver.extract(`${sharedPrefix} ${original.n}`, rc).resolution ?? resolution;
    const when = toWhen(resolution, input.timezone);
    const people = extractPeople(original.c, language);
    const base = {
      id: newId(),
      language,
      originalText: original.c,
      parser: 'deterministic' as const,
      requiresConfirmation: true,
      missingFields: [] as string[],
      clarificationQuestion: null,
      warnings: ['fallback'],
    };
    const words = ex.remaining.n.split(' ').filter(Boolean).length;
    if (when?.time && words > 0 && words <= 8) {
      const title = this.buildTitle(ex.remaining, language, { stripArticles: true });
      return [{ ...base, intent: 'CREATE_CALENDAR_EVENT', confidence: 0.66, title: title || fallbackTitle(language, 'CREATE_CALENDAR_EVENT'), when, durationMinutes: resolution?.durationMinutes ?? null, location: null, notes: null, people, alerts: [], allDay: false }];
    }
    if (when?.date && words > 0 && words <= 8) {
      const title = this.buildTitle(ex.remaining, language, { stripArticles: false });
      return [{ ...base, intent: 'CREATE_TASK', confidence: 0.66, title: title || fallbackTitle(language, 'CREATE_TASK'), description: null, when, priority: 'normal', category: null, tags: [], people, listName: null }];
    }
    const content = this.buildContent(original, language);
    const cls = classifyText(content, { people });
    const isQuestion = /\?$/.test(original.n) || QUESTION_START[language].test(original.n);
    return [
      {
        ...base,
        intent: 'CAPTURE_NOTE',
        confidence: 0.7,
        title: suggestTitle(content, language) || fallbackTitle(language, 'CAPTURE_NOTE'),
        content: content || original.c,
        category: cls.category === 'Uncategorized' ? null : cls.category,
        tags: cls.tags,
        people,
        noteType: isQuestion ? 'QUESTION' : 'THOUGHT',
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------

  private buildTitle(w: Working, language: Language, opts: { stripArticles?: boolean } = {}): string {
    let t = w.n;
    for (const noise of TITLE_NOISE[language]) {
      t = t.replace(new RegExp(`(?<![\\p{L}])${escapeRegex(noise)}(?![\\p{L}])`, 'giu'), ' ');
    }
    t = t.replace(new RegExp(`(?<![\\p{L}'])(?:${alternation(FILLERS[language])})(?![\\p{L}'])`, 'giu'), ' ');
    t = collapseWhitespace(t);
    if (language === 'nl') {
      // "om Yakup te bellen" → "Yakup bellen"; "om melk te kopen" → "melk kopen"
      t = t.replace(/^(?:om\s+)?(.+?)\s+te\s+(\S+)$/u, '$1 $2');
    }
    const connectors = LEADING_CONNECTORS[language].filter((cn) => opts.stripArticles !== false || !/^(?:a|an|the|een|het|de|un|une|le|la|l')$/.test(cn));
    let changed = true;
    while (changed) {
      changed = false;
      t = trimPunctuation(t);
      for (const cn of connectors) {
        if (cn.endsWith("'") ? t.startsWith(cn) : t === cn || t.startsWith(`${cn} `)) {
          t = t.slice(cn.length).trim();
          changed = true;
        }
      }
    }
    t = t.replace(/\s+(?:to|om|te|à|a|de|and|en|et|for|voor|pour)$/u, '');
    t = trimPunctuation(collapseWhitespace(t));
    if (!t) return '';
    return sentenceCase(recase(t, w.c));
  }

  private buildContent(w: Working, language: Language): string {
    let t = w.c;
    const lead = language === 'en' ? /^(?:that|this|the following|about)\s+/iu : language === 'nl' ? /^(?:dat|dit|het volgende|over)\s+/iu : /^(?:que|qu'|ceci|ça|ca|la chose suivante|sur)\s+/iu;
    t = t.replace(lead, '');
    t = trimPunctuation(collapseWhitespace(t));
    return sentenceCase(t);
  }

  private cleanTarget(raw: string, language: Language): string {
    let t = collapseWhitespace(raw);
    t = t.replace(TARGET_LEAD[language], '');
    t = t.replace(new RegExp(`(?<![\\p{L}'])(?:${alternation(FILLERS[language])})(?![\\p{L}'])`, 'giu'), ' ');
    return trimPunctuation(collapseWhitespace(t));
  }

  private splitList(body: Working, language: Language): Working[] {
    const parts = body.n.split(LIST_SPLIT[language]).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return [body];
    if (!parts.every((p) => p.split(' ').length >= 2)) return [body];
    const out: Working[] = [];
    let cursor = 0;
    for (const part of parts) {
      const idx = body.n.indexOf(part, cursor);
      if (idx < 0) return [body];
      out.push({ n: part, c: body.c.slice(idx, idx + part.length) });
      cursor = idx + part.length;
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function parseCount(raw: string | undefined): number {
  if (!raw) return 0;
  const t = raw.trim().toLowerCase();
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return NUMBER_WORDS[t] ?? 0;
}

export function toWhen(res: DateResolution | null, timezone: string): When | null {
  if (!res) return null;
  if (!res.date && !res.time && !res.recurrence) return null;
  return {
    date: res.date,
    time: res.time,
    endDate: res.endDate,
    endTime: res.endTime,
    iso: res.iso,
    endIso: res.endIso,
    timezone,
    hasExplicitDate: res.hasExplicitDate,
    hasExplicitTime: res.hasExplicitTime,
    recurrence: res.recurrence,
    phrase: res.matchedText.length ? res.matchedText.join(' ') : null,
  };
}

function shiftWhen(when: When, minutes: number, timezone: string): When {
  if (!when.iso) return when;
  // Lazy import avoided: DateResolver re-export gives us Luxon through combineDateTime.
  const shifted = new Date(new Date(when.iso).getTime() + minutes * 60_000);
  const iso = shifted.toISOString();
  return { ...when, iso, phrase: when.phrase, date: iso.slice(0, 10), time: null, timezone };
}

function daysBetween(a: string, b: string): number {
  const da = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const db = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

const FALLBACK_TITLES: Record<Language, Partial<Record<AssistantIntent, string>>> = {
  en: { CREATE_REMINDER: 'Reminder', CREATE_CALENDAR_EVENT: 'Event', CREATE_TASK: 'Task', CAPTURE_NOTE: 'Note', CAPTURE_IDEA: 'Idea' },
  nl: { CREATE_REMINDER: 'Herinnering', CREATE_CALENDAR_EVENT: 'Afspraak', CREATE_TASK: 'Taak', CAPTURE_NOTE: 'Notitie', CAPTURE_IDEA: 'Idee' },
  fr: { CREATE_REMINDER: 'Rappel', CREATE_CALENDAR_EVENT: 'Événement', CREATE_TASK: 'Tâche', CAPTURE_NOTE: 'Note', CAPTURE_IDEA: 'Idée' },
};

function fallbackTitle(language: Language, intent: AssistantIntent): string {
  return FALLBACK_TITLES[language][intent] ?? 'Item';
}

export const deterministicParser = new DeterministicParser();

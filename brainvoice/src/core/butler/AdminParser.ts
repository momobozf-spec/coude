import { DateTime } from 'luxon';

import { getTool, type ToolName } from './catalog';
import type { ButlerFocus } from './focus';
import { dateResolver, type DateResolver, type ResolveContext } from '../date/DateResolver';
import type { Audience, CommunicationStyle } from '../domain/admin';
import { parseAmountToCents } from '../finance/money';
import type { Command, CommandBatch, CommandOf } from '../intent/schema';
import type { InputSource, Language } from '../types/common';
import { newId } from '../util/id';
import { capitalizeFirst, collapseWhitespace, trimPunctuation } from '../util/text';
import { parseAutomationText } from '../ops/schedule/automationParser';
import { numberWord, parseRecurringText, parseWorkflowText } from '../workflow/parse';

/** Imperatives that mean "Alfred, do this" (automation) rather than "remind me to" (recurring task). */
const ALFRED_ACTION = /^(?:geef|toon|stuur|laat|maak|verstuur|bereid|controleer|check|vat|verzamel|send|show|give|prepare|draft|summari[sz]e|run|review|collect|donne|montre|envoie|prépare|résume|fais|vérifie|rassemble)\b/iu;

/**
 * AdminParser – deterministic understanding of administrative and project-management
 * commands (§132) in Dutch, English and French. It produces BUTLER_TOOL commands whose
 * arguments are validated against the Tool Catalog. Follow-ups ("maak het
 * professioneler", "stuur", "dit was voor project X") resolve through the conversation
 * focus. Anything it does not recognise returns null so the regular parsers (and the
 * LLM) get their turn.
 */

export interface AdminParseInput {
  text: string;
  language: Language;
  now: DateTime;
  timezone: string;
  source: InputSource;
  transcript?: string | null;
  focus: ButlerFocus | null;
}

interface BuildContext {
  language: Language;
  now: DateTime;
  timezone: string;
  focus: ButlerFocus | null;
  text: string;
  resolver: DateResolver;
}

type Args = Record<string, unknown>;

interface Missing {
  missing: string;
  question: string;
  args: Args;
}

interface Rule {
  tool: ToolName;
  confidence?: number;
  patterns: Partial<Record<Language, RegExp[]>>;
  /** Returns args, a Missing marker, or null when the match should be ignored. */
  build?: (m: RegExpExecArray, c: BuildContext) => Args | Missing | null;
}

const PERSON = String.raw`[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?`;
const NAME = String.raw`[\p{L}\d][\p{L}\d&!.'’+\-]*(?:\s+[\p{L}\d&!.'’+\-]+)*?`;
const MONTHS: Record<string, number> = { januari: 1, january: 1, janvier: 1, februari: 2, february: 2, février: 2, fevrier: 2, maart: 3, march: 3, mars: 3, april: 4, avril: 4, mei: 5, may: 5, mai: 5, juni: 6, june: 6, juin: 6, juli: 7, july: 7, juillet: 7, augustus: 8, august: 8, août: 8, aout: 8, september: 9, septembre: 9, oktober: 10, october: 10, octobre: 10, november: 11, novembre: 11, december: 12, décembre: 12, decembre: 12 };
const MONTH_RE = new RegExp(String.raw`\b(${Object.keys(MONTHS).join('|')})\b`, 'iu');

const TONE: { re: RegExp; style: CommunicationStyle }[] = [
  { re: /\b(vriendelijk|friendly|amical|amicale|gentiment|warm)\b/i, style: 'professional_friendly' },
  { re: /\b(formeel|formal|formel|formelle)\b/i, style: 'formal' },
  { re: /\b(professioneel|zakelijk|professional|professionnel|professionnelle)\b/i, style: 'professional' },
  { re: /\b(kort|beknopt|short|briefly|concise|brièvement|court)\b/i, style: 'concise' },
  { re: /\b(informeel|informal|casual|informel|décontracté)\b/i, style: 'informal' },
  { re: /\b(direct|rechtstreeks|directly|directement)\b/i, style: 'direct' },
];

const AUDIENCE_WORDS: { re: RegExp; audience: Audience }[] = [
  { re: /\brecruiter|recruteur|headhunter|rekruteerder/i, audience: 'recruiter' },
  { re: /\bklant|cliënt|client|customer/i, audience: 'client' },
  { re: /\bcollega|colleague|collègue|collegue/i, audience: 'colleague' },
  { re: /\bleverancier|supplier|fournisseur/i, audience: 'supplier' },
];

const STYLE_WORDS: { re: RegExp; style: CommunicationStyle }[] = [
  { re: /professioneel\s+(?:maar|en)\s+vriendelijk|professional(?:ly)?\s+(?:but|and)\s+friendly|professionnel(?:le)?\s+(?:mais|et)\s+amical/i, style: 'professional_friendly' },
  { re: /professioneel\s+en\s+duidelijk|professional(?:ly)?\s+and\s+clear(?:ly)?|professionnel(?:le)?\s+et\s+clair/i, style: 'professional_clear' },
  { re: /professioneel\s+en\s+direct|professional(?:ly)?\s+and\s+direct(?:ly)?|professionnel(?:le)?\s+et\s+direct/i, style: 'professional_direct' },
  { re: /kort(?:er)?\s+en\s+informeel|short(?:er)?\s+and\s+(?:more\s+)?informal|court\s+et\s+informel/i, style: 'informal_short' },
  { re: /\bformeel|formal(?:ly)?|formel(?:le)?\b/i, style: 'formal' },
  { re: /\binformeel|informal(?:ly)?|informel(?:le)?\b/i, style: 'informal' },
  { re: /\bvriendelijk|friendly|amical(?:e)?\b/i, style: 'friendly' },
  { re: /\bkort|beknopt|concise(?:ly)?|brief(?:ly)?|court|concis\b/i, style: 'concise' },
  { re: /\bdirect(?:ly)?\b/i, style: 'direct' },
  { re: /\bprofessioneel|zakelijk|professional(?:ly)?|professionnel(?:le)?\b/i, style: 'professional' },
];

const UNIT_WORDS: { re: RegExp; unit: 'day' | 'hour' | 'piece' | 'month' | 'km' }[] = [
  { re: /^(?:werkdagen|werkdag|dagen|dag|days?|jours?|mandagen|mandag|man-?days?)$/i, unit: 'day' },
  { re: /^(?:uur|uren|u|hours?|hrs?|h|heures?)$/i, unit: 'hour' },
  { re: /^(?:maanden|maand|months?|mois)$/i, unit: 'month' },
  { re: /^(?:km|kilometer|kilometers|kilomètres?)$/i, unit: 'km' },
  { re: /^(?:stuks?|pieces?|pcs|pièces?|units?|eenheden)$/i, unit: 'piece' },
];

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const PRICE = String.raw`(?:€\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|euro|eur)|\d[\d.,]*)`;
const LINE_A = new RegExp(String.raw`(?<qty>${NUMBER})\s*(?<unit>werkdagen|werkdag|dagen|dag|days?|jours?|mandagen|uur|uren|u|hours?|hrs?|h|heures?|maanden|maand|months?|mois|km|stuks?|pieces?|pièces?)\b\s*(?:(?<desc>[^€\d]+?)\s+)?(?:aan|à|a|at|of|voor|pour|x|×|@|tegen)\s*(?<price>${PRICE})(?:\s*(?:per|par|/|p\.|elk|each|chacun)\s*\w+)?`, 'iu');
const LINE_B = new RegExp(String.raw`^(?<price>€\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|euro|eur))\s*(?:voor|for|pour)\s+(?<desc>.+)$`, 'iu');
const LINE_C = new RegExp(String.raw`^(?<desc>.+?)\s*[:,]?\s*(?:voor|for|pour|aan|à|at)?\s*(?<price>€\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|euro|eur))$`, 'iu');
const QTY_SPLIT = /\s*(?:,|\sen\s|\sand\s|\set\s|\s\+\s|;)\s*/i;

export function parseInvoiceLines(text: string): { description: string; quantity: number; unit: 'day' | 'hour' | 'piece' | 'month' | 'km'; unitPriceCents: number }[] {
  const lines: { description: string; quantity: number; unit: 'day' | 'hour' | 'piece' | 'month' | 'km'; unitPriceCents: number }[] = [];
  for (const part of text.split(QTY_SPLIT).map((p) => p.trim()).filter(Boolean)) {
    const a = LINE_A.exec(part);
    if (a?.groups) {
      const qty = Number((a.groups.qty ?? '0').replace(',', '.'));
      const unit = UNIT_WORDS.find((u) => u.re.test(a.groups?.unit ?? ''))?.unit ?? 'piece';
      const price = parseAmountToCents(a.groups.price ?? '');
      if (qty > 0 && price && price.cents > 0) {
        const desc = a.groups.desc?.trim() ? capitalizeFirst(a.groups.desc.trim()) : `${a.groups.qty} ${a.groups.unit}`;
        lines.push({ description: desc, quantity: qty, unit, unitPriceCents: price.cents });
        continue;
      }
    }
    const b = LINE_B.exec(part) ?? LINE_C.exec(part);
    if (b?.groups) {
      const price = parseAmountToCents(b.groups.price ?? '');
      let desc = trimPunctuation(b.groups.desc ?? '');
      let quantity = 1;
      const counted = /^(\d+(?:[.,]\d+)?)\s+(.+)$/.exec(desc);
      if (counted?.[1] && counted[2]) {
        quantity = Number(counted[1].replace(',', '.'));
        desc = counted[2];
      }
      if (price && price.cents > 0 && desc && quantity > 0) lines.push({ description: capitalizeFirst(desc), quantity, unit: 'piece', unitPriceCents: price.cents });
    }
  }
  return lines;
}

export interface Period {
  from: string;
  to: string;
  label: string;
}

/** "deze maand", "september", "vorige week", "dit jaar", "this month", "le mois dernier" → ISO range in the device zone. */
export function parsePeriod(text: string, now: DateTime, timezone: string): Period | null {
  const lower = text.toLowerCase();
  const today = now.setZone(timezone).startOf('day');
  const range = (from: DateTime, to: DateTime, label: string): Period => ({ from: from.toISODate() ?? '', to: to.toISODate() ?? '', label });
  if (/\b(?:deze|dit|this|cette|ce)\s+(?:week|semaine)\b/.test(lower)) return range(today.startOf('week'), today.endOf('week'), 'this_week');
  if (/\b(?:vorige|afgelopen|last|past)\s+week\b|\bla\s+semaine\s+(?:dernière|derniere|passée|passee)\b/.test(lower)) return range(today.minus({ weeks: 1 }).startOf('week'), today.minus({ weeks: 1 }).endOf('week'), 'last_week');
  if (/\b(?:volgende|next)\s+week\b|\bla\s+semaine\s+prochaine\b/.test(lower)) return range(today.plus({ weeks: 1 }).startOf('week'), today.plus({ weeks: 1 }).endOf('week'), 'next_week');
  if (/\b(?:deze|this)\s+(?:maand|month)\b|\bce\s+mois(?:-ci)?\b/.test(lower)) return range(today.startOf('month'), today.endOf('month'), 'this_month');
  if (/\b(?:vorige|afgelopen|last|past)\s+(?:maand|month)\b|\ble\s+mois\s+(?:dernier|passé|passe)\b/.test(lower)) return range(today.minus({ months: 1 }).startOf('month'), today.minus({ months: 1 }).endOf('month'), 'last_month');
  if (/\b(?:dit|this)\s+(?:jaar|year)\b|\bcette\s+année\b/.test(lower)) return range(today.startOf('year'), today.endOf('year'), 'this_year');
  if (/\b(?:vandaag|today|aujourd'hui)\b/.test(lower)) return range(today, today, 'today');
  const month = MONTH_RE.exec(lower);
  if (month?.[1]) {
    const m = MONTHS[month[1]] ?? today.month;
    const year = m > today.month ? today.year - 1 : today.year;
    const start = DateTime.fromObject({ year, month: m, day: 1 }, { zone: timezone });
    return range(start, start.endOf('month'), 'month');
  }
  return null;
}

/** Trims whitespace and sentence punctuation but keeps a trailing "!" (names such as "GO!"). */
function clean(raw: string | undefined): string {
  return collapseWhitespace((raw ?? '').replace(/^[\s,.;:?\-–—'"«»()]+/, '').replace(/[\s,.;:?\-–—'"«»()]+$/, ''));
}

function stripLead(name: string): string {
  return clean(name.replace(/^(?:klant|cliënt|client|customer|leverancier|supplier|fournisseur|project|projet|de|het|een|the|a|an|le|la|l'|les|un|une|mijn|my|mon|ma|mes)\s+/i, ''));
}

function toneOf(text: string): CommunicationStyle | null {
  for (const t of TONE) if (t.re.test(text)) return t.style;
  return null;
}

function audienceOf(text: string): Audience | null {
  for (const a of AUDIENCE_WORDS) if (a.re.test(text)) return a.audience;
  return null;
}

function rc(c: BuildContext, preferFuture = true): ResolveContext {
  return { now: c.now, timezone: c.timezone, language: c.language, timePolicy: 'business', preferFuture };
}

function dateIn(text: string, c: BuildContext): string | null {
  return c.resolver.extract(text, rc(c)).resolution?.date ?? null;
}

function hasFocus(c: BuildContext, key: keyof ButlerFocus): boolean {
  const v = c.focus?.[key];
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

const Q = {
  lines: { nl: 'Wat moet ik factureren? Bijvoorbeeld "5 werkdagen aan €750 per dag".', en: 'What should I invoice? For example "5 days at €750 per day".', fr: 'Que dois-je facturer ? Par exemple « 5 jours à 750 € par jour ».' },
  notes: { nl: 'Plak of dicteer de meetingnotities.', en: 'Paste or dictate the meeting notes.', fr: 'Colle ou dicte les notes de réunion.' },
  instruction: { nl: 'Wat moet ik antwoorden?', en: 'What should the reply say?', fr: 'Que dois-je répondre ?' },
  project: { nl: 'Over welk project gaat het?', en: 'Which project?', fr: 'Quel projet ?' },
} satisfies Record<string, Record<Language, string>>;

// ---------------------------------------------------------------------------
// Rules (ordered: specific follow-ups first, then questions, then creations)
// ---------------------------------------------------------------------------

const RULES: Rule[] = [
  // ---- Email follow-ups that depend on focus --------------------------------
  { tool: 'email.send', confidence: 0.97, patterns: { nl: [/^(?:ok(?:é|e)?[,.!]?\s*)?(?:stuur|verstuur|verzend)(?:\s+(?:het|hem|die|de mail|het antwoord|maar|dit))*\s*[.!]?$/iu], en: [/^(?:ok(?:ay)?[,.!]?\s*)?(?:send|go ahead and send|send it|send the (?:email|mail|reply)|send it off)(?:\s+(?:it|please|now))*\s*[.!]?$/iu], fr: [/^(?:ok[,.!]?\s*)?(?:envoie|envoyer|envoie-le|envoie le mail|envoie la réponse|envoie-la)(?:\s+(?:maintenant|stp|svp))*\s*[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'draftId') ? {} : null) },
  { tool: 'email.refineDraft', confidence: 0.95, patterns: { nl: [/^(?:maak|zet)\s+(?:het|dit|de mail|het antwoord|hem)\s+(?:iets|wat|een beetje|nog iets|nog wat|veel)?\s*(?<instruction>(?:professione+ler|vriendelijker|korter|formeler|informeler|directer|zakelijker|duidelijker|warmer|strenger|beleefder|langer|bondiger)[^.!?]*)[.!]?$/iu, /^(?:iets|wat|een beetje)\s+(?<instruction>(?:professione+ler|vriendelijker|korter|formeler|informeler|directer|zakelijker)[^.!?]*)[.!]?$/iu, /^(?:voeg\s+(?:er\s+)?(?:ook\s+)?(?:aan\s+)?toe|zeg\s+(?:er\s+)?ook|vermeld\s+(?:ook|ook nog)|schrijf\s+(?:er\s+)?ook)\s+(?:dat\s+)?(?<instruction>.+)$/iu], en: [/^(?:make|keep)\s+(?:it|this|the (?:email|reply|draft))\s+(?:a (?:bit|little)|slightly|much|way)?\s*(?<instruction>(?:more professional|friendlier|more friendly|shorter|more formal|less formal|more informal|more direct|clearer|warmer|more polite|longer|more concise)[^.!?]*)[.!]?$/iu, /^(?:a (?:bit|little)|slightly)\s+(?<instruction>(?:more professional|friendlier|shorter|more formal|more informal|more direct)[^.!?]*)[.!]?$/iu, /^(?:also (?:say|mention|add)|add)\s+(?:that\s+)?(?<instruction>.+)$/iu], fr: [/^(?:rends|fais)[- ]?(?:le|la|ça|ceci)\s+(?:un peu\s+)?(?<instruction>(?:plus professionnel|plus amical|plus court|plus formel|moins formel|plus direct|plus clair|plus chaleureux|plus poli)[^.!?]*)[.!]?$/iu, /^(?:ajoute|dis aussi|mentionne aussi)\s+(?:que\s+)?(?<instruction>.+)$/iu] }, build: (m, c) => (hasFocus(c, 'draftId') ? { instruction: clean(m.groups?.instruction) } : null) },
  { tool: 'email.refineDraft', confidence: 0.9, patterns: { nl: [/^zeg\s+(?:ook\s+)?(?:dat\s+)?(?<instruction>.+)$/iu], en: [/^(?:say|tell (?:him|her|them))\s+(?:that\s+)?(?<instruction>.+)$/iu], fr: [/^(?:dis|dis-lui|dites-lui)\s+(?:que\s+)?(?<instruction>.+)$/iu] }, build: (m, c) => (hasFocus(c, 'draftId') ? { instruction: `dat ${clean(m.groups?.instruction)}`.replace(/^dat dat /, 'dat ') } : null) },
  { tool: 'email.briefing', confidence: 0.95, patterns: { nl: [/^wat\s+(?:wil|wilt|vraagt|verwacht|willen)\s+(?:hij|zij|ze|die|hem|haar|men|de afzender)\s+(?:van\s+(?:mij|me))?\s*\??$/iu, /^wat\s+(?:moet|kan)\s+ik\s+(?:hiermee|ermee|daarmee|met die mail|met deze mail)\s+doen\??$/iu, /^(?:vat\s+(?:die|deze|de)\s+mail\s+samen|samenvatting(?:\s+van\s+(?:die|deze|de)\s+mail)?|waar\s+gaat\s+(?:die|deze|de|dit)\s+(?:mail\s+)?over)\??$/iu], en: [/^what\s+(?:does|do)\s+(?:he|she|they|the sender)\s+(?:want|need|expect|ask)(?:\s+(?:from|of)\s+me)?\??$/iu, /^what\s+(?:is|'s)\s+(?:he|she|they|it)\s+asking(?:\s+(?:for|me))?\??$/iu, /^(?:summari[sz]e\s+(?:this|that|the)\s+(?:email|mail)|what\s+is\s+(?:this|that)\s+(?:email\s+)?about)\??$/iu], fr: [/^(?:qu'est-ce qu'il|qu'est-ce qu'elle|que)\s+(?:veut|veut-il|veut-elle|attend|attend-il|demande|demande-t-il)(?:\s+de\s+moi)?\s*\??$/iu, /^(?:résume|resume)\s+(?:ce|cet)\s+(?:mail|e-mail|email)\??$/iu] }, build: (_m, c) => (hasFocus(c, 'emailId') ? {} : null) },
  { tool: 'email.markHandled', confidence: 0.93, patterns: { nl: [/^(?:markeer|zet)\s+(?:die|deze|de)\s+mail\s+als\s+(?:afgehandeld|behandeld|gedaan|klaar)[.!]?$/iu, /^(?:afgehandeld|behandeld|mail afgehandeld)[.!]?$/iu], en: [/^mark\s+(?:this|that|the)\s+(?:email|mail)\s+as\s+(?:handled|done|processed|dealt with)[.!]?$/iu, /^(?:handled|email handled)[.!]?$/iu], fr: [/^marque\s+ce\s+mail\s+comme\s+(?:traité|traite|fait)[.!]?$/iu, /^(?:traité|traite)[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'emailId') ? {} : null) },

  // ---- Proposal approval (focus) ---------------------------------------------
  { tool: 'suggestions.approve', confidence: 0.95, patterns: { nl: [/^(?:ja|oké|ok|oke|goed|prima|akkoord|top)?[,.!]?\s*(?:maak\s+(?:ze|die|alles|allemaal|alle\s+\w+)\s+(?:aan|maar aan)|voeg\s+(?:ze|alles|allemaal|die)\s+toe|doe\s+(?:maar|het maar|ze maar)|keur\s+(?:ze|alles|allemaal|die)\s+goed|neem\s+(?:ze|alles|allemaal|die)\s+over|pas\s+(?:ze|alles)\s+toe|bevestig(?:\s+(?:alles|ze|allemaal))?|alles\s+goedkeuren|alles\s+aanmaken)[.!]?$/iu, /^(?:alleen|enkel)\s+de\s+(?<kinds>taken|beslissingen|opvolgingen|risico'?s|vragen)[.!]?$/iu], en: [/^(?:yes|ok|okay|sure|fine|great)?[,.!]?\s*(?:create\s+(?:them|all|those)|add\s+(?:them|all|those)|approve\s+(?:them|all|those|everything)|apply\s+(?:them|all)|go\s+ahead|do\s+it|accept\s+(?:them|all)|confirm(?:\s+(?:all|them))?)[.!]?$/iu, /^(?:only|just)\s+the\s+(?<kinds>tasks|decisions|follow-?ups|risks|questions)[.!]?$/iu], fr: [/^(?:oui|ok|d'accord|parfait)?[,.!]?\s*(?:crée-les|crée\s+tout|ajoute-les|ajoute\s+tout|approuve(?:-les|\s+tout)?|applique(?:-les|\s+tout)?|vas-y|accepte(?:-les|\s+tout)?|confirme(?:\s+tout)?)[.!]?$/iu, /^(?:seulement|uniquement)\s+les\s+(?<kinds>tâches|taches|décisions|decisions|suivis|risques|questions)[.!]?$/iu] }, build: (m, c) => {
    if (!hasFocus(c, 'suggestionIds')) return null;
    const kinds = m.groups?.kinds?.toLowerCase();
    if (!kinds) return { all: true };
    const map: Record<string, string> = { taken: 'task', tasks: 'task', tâches: 'task', taches: 'task', beslissingen: 'decision', decisions: 'decision', décisions: 'decision', opvolgingen: 'follow_up', 'follow-ups': 'follow_up', followups: 'follow_up', suivis: 'follow_up', "risico's": 'risk', risicos: 'risk', risks: 'risk', risques: 'risk', vragen: 'question', questions: 'question' };
    const kind = map[kinds];
    return kind ? { kinds: [kind] } : { all: true };
  } },
  { tool: 'suggestions.reject', confidence: 0.93, patterns: { nl: [/^(?:nee|neen|laat\s+maar|verwerp\s+(?:ze|alles|allemaal)|niet\s+(?:toevoegen|aanmaken)|niets\s+aanmaken)[.!]?$/iu], en: [/^(?:no|skip|reject\s+(?:them|all)|don't\s+add\s+them|discard(?:\s+them)?|never\s+mind)[.!]?$/iu], fr: [/^(?:non|laisse\s+tomber|rejette(?:-les|\s+tout)?|n'ajoute\s+rien)[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'suggestionIds') ? { all: true } : null) },

  // ---- Focus-based linking ---------------------------------------------------
  { tool: 'expense.assign', confidence: 0.93, patterns: { nl: [/^(?:dit|dat|deze|die)\s+(?:bon|uitgave|kost|onkost)?\s*(?:was|is)\s+voor\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu], en: [/^(?:this|that)\s+(?:receipt|expense)?\s*(?:was|is)\s+for\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu], fr: [/^(?:c'était|c'etait|c'est|ça\s+c'était)\s+pour\s+(?:le\s+projet\s+)?(?<project>.+?)[.!]?$/iu] }, build: (m, c) => (hasFocus(c, 'expenseId') ? { project: stripLead(m.groups?.project ?? '') } : null) },
  { tool: 'project.assign', confidence: 0.93, patterns: { nl: [/^(?:zet|plaats|klasseer)\s+(?:dit|dat|deze|die|het)(?:\s+(?:taak|mail|document|item))?\s+(?:onder|bij|in)\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu, /^(?:koppel|link)\s+(?:dit|dat|deze|die)\s+aan\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu, /^(?:dit|dat)\s+(?:hoort|is)\s+(?:bij|voor)\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu], en: [/^(?:put|file|move)\s+(?:this|that|it)(?:\s+(?:task|email|document|item))?\s+under\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu, /^(?:link|attach|assign)\s+(?:this|that|it)\s+to\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu, /^(?:this|that)\s+(?:belongs\s+to|is\s+for)\s+(?:project\s+)?(?<project>.+?)[.!]?$/iu], fr: [/^(?:mets|classe|range)\s+(?:ça|ceci|cela|ce)\s+(?:sous|dans)\s+(?:le\s+projet\s+)?(?<project>.+?)[.!]?$/iu, /^(?:lie|associe|rattache)\s+(?:ça|ceci)\s+au\s+projet\s+(?<project>.+?)[.!]?$/iu] }, build: (m, c) => (c.focus && (c.focus.taskId || c.focus.emailId || c.focus.documentId || c.focus.expenseId || c.focus.invoiceId || c.focus.meetingId || c.focus.followUpId) ? { project: stripLead(m.groups?.project ?? '') } : null) },
  { tool: 'project.addTask', confidence: 0.93, patterns: { nl: [/^(?:maak|zet)\s+(?:hier|hiervan|daar|daarvan|er|van\s+(?:dit|deze\s+mail|die\s+mail))\s+(?:een\s+)?taak\s+(?:van|aan)[.!]?$/iu, /^(?:zet|plaats)\s+(?:dit|dat)\s+(?:op|in)\s+mijn\s+(?:takenlijst|to-?do(?:lijst)?)[.!]?$/iu], en: [/^(?:make|create|turn)\s+(?:this|that|it)\s+(?:into\s+)?a\s+task[.!]?$/iu, /^(?:add|put)\s+(?:this|that)\s+(?:as\s+a\s+task|to\s+my\s+(?:tasks|to-?do(?:\s+list)?))[.!]?$/iu], fr: [/^(?:fais|crée)[- ]?en\s+une\s+tâche[.!]?$/iu, /^(?:ajoute|mets)\s+(?:ça|ceci)\s+(?:dans|à)\s+(?:mes\s+tâches|ma\s+liste)[.!]?$/iu] }, build: (_m, c) => (c.focus && (c.focus.emailId || c.focus.documentId || c.focus.suggestionIds.length) ? { fromFocus: true } : null) },
  { tool: 'followup.create', confidence: 0.9, patterns: { nl: [/^(?:ze|hij|zij|die|hun|men)\s+(?:zou|zouden|gaat|gaan|ging|gingen)\s+(?:mij|me)\s+(?<when>.+?)\s+(?:antwoorden|laten\s+weten|terug\s*bellen|iets\s+sturen|bezorgen|contacteren)[.!]?$/iu, /^(?:ze|hij|zij)\s+(?:zou|zouden|gaat|gaan)\s+(?:mij|me)\s+(?<what>[^.!?]+?)\s+(?:sturen|bezorgen|doorsturen|opsturen)(?:\s+(?<when>.+))?[.!]?$/iu, /^ik\s+wacht\s+(?:nog\s+)?op\s+(?<what>.+?)\s+van\s+(?<who>.+?)(?:\s+(?:tegen|voor)\s+(?<when>.+))?[.!]?$/iu], en: [/^(?:they|he|she)\s+(?:said\s+(?:they|he|she)(?:'d|\s+would)|will|would|promised\s+to)\s+(?:answer|reply|get\s+back\s+to\s+me|respond|let\s+me\s+know)(?:\s+(?<when>.+))?[.!]?$/iu, /^(?:they|he|she)\s+(?:will|would|promised\s+to|said\s+(?:they|he|she)(?:'d|\s+would))\s+send\s+(?:me\s+)?(?<what>[^.!?]+?)(?:\s+(?<when>tomorrow|today|next\s+week|this\s+week|by\s+.+|on\s+.+))?[.!]?$/iu, /^i(?:'m|\s+am)\s+(?:still\s+)?waiting\s+for\s+(?<what>.+?)\s+from\s+(?<who>.+?)(?:\s+(?:by|before)\s+(?<when>.+))?[.!]?$/iu], fr: [/^(?:ils|il|elle|elles)\s+(?:devaient|devait|doivent|doit|vont|va)\s+me\s+(?:répondre|repondre|recontacter)(?:\s+(?<when>.+))?[.!]?$/iu, /^j'attends\s+(?<what>.+?)\s+de\s+(?<who>.+?)(?:\s+(?:pour|avant)\s+(?<when>.+))?[.!]?$/iu] }, build: (m, c) => {
    const g = m.groups ?? {};
    const when = g.when ? dateIn(g.when, c) : null;
    const what = g.what ? clean(g.what) : null;
    const title = what ? capitalizeFirst(what) : { nl: 'Antwoord', en: 'Reply', fr: 'Réponse' }[c.language];
    const who = g.who ? stripLead(g.who) : null;
    if (!who && !c.focus?.contactId && !c.focus?.emailId && !c.focus?.companyId && !what) return null;
    return { kind: 'waiting_for', title, who, expectedDate: when ?? (g.when && /week/i.test(g.when) ? (parsePeriod(g.when, c.now, c.timezone)?.to ?? null) : null), useFocus: true };
  } },

  // ---- Questions: email ------------------------------------------------------
  { tool: 'email.needsReply', confidence: 0.96, patterns: { nl: [/^(?:welke|op welke)\s+(?:mails?|e-?mails?|berichten)\s+(?:moet|moeten|dien)\s+(?:ik\s+)?(?:nog\s+)?(?:beantwoorden|beantwoord\s+worden|antwoorden|een\s+antwoord)/iu, /^welke\s+(?:mails?|e-?mails?)\s+(?:wachten|staan)\s+(?:nog\s+)?(?:op\s+(?:een\s+)?antwoord|open)/iu, /^(?:wat|wie)\s+moet\s+ik\s+(?:nog\s+)?(?:allemaal\s+)?(?:terugmailen|beantwoorden)\b/iu], en: [/^(?:what|which)\s+(?:e-?mails?|messages)\s+(?:still\s+)?(?:require|need|await|are\s+waiting\s+for)\s+(?:an?\s+)?(?:answer|reply|response)/iu, /^(?:what|which)\s+(?:e-?mails?)\s+(?:do|should|must)\s+i\s+(?:still\s+)?(?:answer|reply\s+to|respond\s+to)/iu, /^(?:who|what)\s+do\s+i\s+(?:still\s+)?(?:need|have)\s+to\s+(?:reply|respond|answer|write\s+back)\s+to/iu], fr: [/^(?:quels|à\s+quels)\s+(?:mails?|e-?mails?|messages)\s+(?:dois-je|est-ce\s+que\s+je\s+dois|faut-il)\s+(?:encore\s+)?répondre/iu, /^quels\s+(?:mails?|e-?mails?)\s+attendent\s+(?:encore\s+)?une\s+réponse/iu] } },
  { tool: 'email.open', confidence: 0.95, patterns: { nl: [/^(?:open|toon|laat\s+(?:mij|me)\s+zien|geef\s+(?:mij|me))\s+(?:de\s+)?(?:laatste|recentste|nieuwste|vorige)?\s*(?:mail|e-?mail|bericht)\s+(?:van|from)\s+(?:de\s+|die\s+)?(?<from>.+?)[.!?]?$/iu, /^(?:open|toon)\s+(?:die|de)\s+mail\s+(?:van\s+(?:de\s+)?)?(?<from>.+?)[.!?]?$/iu, /^(?:open|toon)\s+(?:de\s+)?(?:mail|e-?mail)\s+over\s+(?<topic>.+?)[.!?]?$/iu], en: [/^(?:open|show(?:\s+me)?|pull\s+up|read)\s+(?:the\s+)?(?:latest|last|most\s+recent|newest)?\s*(?:e-?mail|mail|message)\s+from\s+(?:the\s+)?(?<from>.+?)[.!?]?$/iu, /^(?:open|show)\s+(?:that|the)\s+(?:e-?mail|mail)\s+(?:from\s+(?:the\s+)?)?(?<from>.+?)[.!?]?$/iu, /^(?:open|show)\s+(?:the\s+)?(?:e-?mail|mail)\s+about\s+(?<topic>.+?)[.!?]?$/iu], fr: [/^(?:ouvre|montre(?:-moi)?|affiche)\s+(?:le\s+)?(?:dernier|dernière|récent)?\s*(?:mail|e-?mail|message)\s+(?:de|du|de\s+la)\s+(?<from>.+?)[.!?]?$/iu, /^(?:ouvre|montre)\s+(?:ce|le)\s+mail\s+(?:de\s+)?(?<from>.+?)[.!?]?$/iu] }, build: (m) => {
    const from = clean(m.groups?.from);
    const topic = clean(m.groups?.topic);
    const audience = from ? audienceOf(from) : null;
    if (audience && !/[A-Z]/.test(from.replace(/^(?:de|die|the|le|la)\s+/i, '').charAt(0))) return { audience };
    return from ? { from: from.replace(/^(?:de|die|the|le|la)\s+/i, '') } : topic ? { topic } : null;
  } },

  // ---- Reply drafting --------------------------------------------------------
  { tool: 'email.draftReply', confidence: 0.95, patterns: { nl: [/^(?:beantwoord|antwoord\s+op|reageer\s+op)\s+(?:die|de|deze)\s+(?:mail|e-?mail|bericht)\s+van\s+(?:de\s+)?(?<from>.+?)(?:\s*[:,]\s*(?:zeg\s+)?(?:dat\s+)?(?<instruction>.+)|\s+(?:en\s+)?(?:zeg\s+)?dat\s+(?<instruction2>.+))?[.!]?$/iu, /^(?:antwoord|reageer)\s+(?:eerst\s+|nu\s+|even\s+)?(?:op\s+)?(?:die|de)\s+(?<from>[^.!?]+?)(?:\s*[:,]\s*(?:zeg\s+)?(?:dat\s+)?(?<instruction>.+)|\s+(?:en\s+)?(?:zeg\s+)?dat\s+(?<instruction2>.+))?[.!]?$/iu, /^(?:ok(?:é|e)?[,.!]?\s*)?(?:antwoord|reageer|beantwoord)\s+(?<tone>vriendelijk|kort|professioneel|formeel|beleefd|direct)?\s*(?:hem|haar|ze|hun|daarop|erop|dat)?\s*(?:dat|met|:)\s+(?<instruction>.+)$/iu, /^(?:ok(?:é|e)?[,.!]?\s*)?zeg\s+(?:hem|haar|ze|hun)?\s*(?:dat\s+)?(?<instruction>.+)$/iu], en: [/^(?:reply|respond|answer)\s+(?:to\s+)?(?:that|the|this)\s+(?:e-?mail|mail|message)\s+from\s+(?:the\s+)?(?<from>.+?)(?:\s*[:,]\s*(?:say(?:ing)?\s+)?(?:that\s+)?(?<instruction>.+)|\s+(?:and\s+)?(?:say(?:ing)?\s+)?that\s+(?<instruction2>.+))?[.!]?$/iu, /^(?:reply|respond|answer)\s+(?:to\s+)?(?:first\s+|now\s+)?(?:that|the)\s+(?<from>[^.!?]+?)(?:\s+first)?(?:\s*[:,]\s*(?:say(?:ing)?\s+)?(?:that\s+)?(?<instruction>.+)|\s+(?:and\s+)?(?:say(?:ing)?\s+)?that\s+(?<instruction2>.+))?[.!]?$/iu, /^(?:ok(?:ay)?[,.!]?\s*)?(?:reply|respond|answer)\s+(?<tone>kindly|briefly|professionally|formally|politely|directly|friendly)?\s*(?:him|her|them)?\s*(?:that|saying|with|:)\s+(?<instruction>.+)$/iu, /^(?:ok(?:ay)?[,.!]?\s*)?(?:say|tell\s+(?:him|her|them))\s+(?:that\s+)?(?<instruction>.+)$/iu], fr: [/^(?:réponds|reponds|réponds\s+à|reponds\s+a)\s+(?:à\s+|a\s+)?(?:ce|le|cet)\s+(?:mail|e-?mail|message)\s+(?:de|du)\s+(?:la\s+)?(?<from>.+?)(?:\s*[:,]\s*(?:dis\s+)?(?:que\s+)?(?<instruction>.+)|\s+(?:en\s+disant\s+)?(?:que|qu')\s*(?<instruction2>.+))?[.!]?$/iu, /^(?:ok[,.!]?\s*)?(?:réponds|reponds)\s+(?<tone>gentiment|brièvement|professionnellement|poliment)?\s*(?:lui\s+)?(?:que|en\s+disant\s+que|:)\s+(?<instruction>.+)$/iu, /^(?:ok[,.!]?\s*)?(?:dis|dis-lui|dites-lui)\s+(?:que\s+)?(?<instruction>.+)$/iu] }, build: (m, c) => {
    const g = m.groups ?? {};
    const from = g.from ? clean(g.from) : '';
    const audience = from ? audienceOf(from) : null;
    const instruction = clean(g.instruction ?? g.instruction2 ?? '');
    const style = toneOf(g.tone ?? '');
    const args: Args = { style };
    if (from && audience && !/^[A-Z]/.test(from.replace(/^(?:de|die|the|le|la)\s+/i, ''))) args.audience = audience;
    else if (from) args.from = from.replace(/^(?:de|die|the|le|la)\s+/i, '');
    else if (!hasFocus(c, 'emailId')) return null;
    if (!instruction) return { missing: 'instruction', question: Q.instruction[c.language], args };
    return { ...args, instruction: /^(?:dat|that|que)\s/i.test(instruction) ? instruction : `${{ nl: 'dat', en: 'that', fr: 'que' }[c.language]} ${instruction}` };
  } },
  { tool: 'email.compose', confidence: 0.93, patterns: { nl: [new RegExp(String.raw`^vraag\s+(?:aan\s+)?(?<to>${PERSON})\s+(?<instruction>(?:of|om)\s+.+)$`, 'iu'), new RegExp(String.raw`^(?:mail|e-?mail|stuur)\s+(?<to>${PERSON})\s+(?:een\s+(?:mail|mailtje|bericht)\s+)?(?<instruction>(?:dat|om|of|over|met de vraag)\s+.+)$`, 'iu')], en: [new RegExp(String.raw`^ask\s+(?<to>${PERSON})\s+(?<instruction>(?:if|whether|to|about)\s+.+)$`, 'iu'), new RegExp(String.raw`^(?:e-?mail|send)\s+(?<to>${PERSON})\s+(?:an?\s+(?:e-?mail|mail|message)\s+)?(?<instruction>(?:that|to|about|asking|saying)\s+.+)$`, 'iu')], fr: [new RegExp(String.raw`^demande\s+(?:à|a)\s+(?<to>${PERSON})\s+(?<instruction>(?:si|s'il|de|d')\s*.+)$`, 'iu'), new RegExp(String.raw`^envoie\s+(?:un\s+)?(?:mail|e-?mail|message)\s+(?:à|a)\s+(?<to>${PERSON})\s+(?<instruction>(?:pour|que|disant)\s+.+)$`, 'iu')] }, build: (m) => ({ to: clean(m.groups?.to), instruction: clean(m.groups?.instruction) }) },

  // ---- Questions: waiting / follow-ups ----------------------------------------
  { tool: 'followup.list', confidence: 0.96, patterns: { nl: [/^(?:waar|waarop)\s+wacht\s+ik\s+(?:nog\s+|allemaal\s+)?(?:op)?\s*\??$/iu, /^(?:wie|van\s+wie)\s+(?:moet|moeten)\s+(?:mij|me)\s+(?:nog\s+)?(?:antwoorden|iets\s+(?:sturen|bezorgen)|terugbellen)\??$/iu, /^(?:wie|van\s+wie)\s+(?:verwacht|wacht)\s+ik\s+(?:nog\s+)?(?:een\s+)?antwoord\??$/iu, /^(?:op\s+wie|wie)\s+wacht\s+ik\s+(?:nog)?\??$/iu, /^(?:mijn\s+)?(?:wachtlijst|wachtitems|openstaande\s+opvolgingen)\??$/iu], en: [/^what\s+am\s+i\s+(?:still\s+)?waiting\s+(?:for|on)\??$/iu, /^who\s+(?:still\s+)?(?:owes\s+me|needs\s+to\s+(?:give\s+me|send\s+me|get\s+back\s+to\s+me)|has\s+to\s+(?:answer|reply)(?:\s+me)?|hasn't\s+(?:replied|answered|responded)(?:\s+yet)?)(?:\s+(?:an?\s+)?(?:answer|reply|response))?\??$/iu, /^who\s+am\s+i\s+waiting\s+(?:for|on)\??$/iu, /^(?:my\s+)?waiting\s+(?:list|items)\??$/iu], fr: [/^(?:qu'est-ce\s+que\s+j'attends|j'attends\s+quoi)(?:\s+encore)?\s*\??$/iu, /^qui\s+doit\s+(?:encore\s+)?me\s+(?:répondre|repondre|envoyer|recontacter)\??$/iu, /^(?:de\s+qui|qui)\s+est-ce\s+que\s+j'attends\s+(?:encore\s+)?(?:une\s+réponse)?\??$/iu] }, build: () => ({ kind: 'waiting_for', includeEmails: true }) },

  // ---- Daily / weekly / inbox / deadlines --------------------------------------
  { tool: 'admin.today', confidence: 0.96, patterns: { nl: [/^wat\s+moet\s+ik\s+(?:vandaag|nu|deze\s+ochtend|vanochtend|vanmiddag)\s+(?:allemaal\s+)?doen\??$/iu, /^wat\s+staat\s+er\s+vandaag\s+(?:allemaal\s+)?(?:op\s+(?:het|mijn)\s+programma|te\s+doen)\??$/iu, /^(?:mijn\s+)?(?:dagplanning|planning\s+(?:voor|van)\s+vandaag|prioriteiten\s+(?:voor|van)\s+vandaag)\??$/iu, /^waar\s+(?:moet|begin)\s+ik\s+(?:vandaag\s+)?(?:mee\s+beginnen|eerst\s+aan)\??$/iu], en: [/^what\s+(?:do|should|must)\s+i\s+(?:need\s+to\s+)?(?:do|focus\s+on)\s+(?:today|this\s+morning|now)\??$/iu, /^what(?:'s|\s+is)\s+(?:on\s+)?(?:my\s+)?(?:plan|agenda)\s+for\s+today\??$/iu, /^(?:my\s+)?(?:daily\s+plan|priorities\s+(?:for\s+)?today|plan\s+for\s+today)\??$/iu, /^what\s+should\s+i\s+start\s+with(?:\s+today)?\??$/iu], fr: [/^que\s+dois-je\s+faire\s+(?:aujourd'hui|ce\s+matin|maintenant)\??$/iu, /^qu'est-ce\s+que\s+je\s+dois\s+faire\s+aujourd'hui\??$/iu, /^(?:mon\s+)?(?:plan|planning|priorités)\s+(?:du\s+jour|d'aujourd'hui|pour\s+aujourd'hui)\??$/iu] } },
  { tool: 'admin.inbox', confidence: 0.95, patterns: { nl: [/^(?:wat\s+(?:vraagt|verdient|heeft)\s+(?:mijn\s+)?aandacht(?:\s+nodig)?|wat\s+moet\s+ik\s+(?:nog\s+)?opvolgen|(?:mijn\s+)?(?:administratieve|admin)\s*-?\s*inbox|wat\s+staat\s+er\s+(?:nog\s+)?open\s+(?:qua|aan|in\s+mijn)\s+administratie|administratie\s+overzicht)\??$/iu], en: [/^(?:what\s+(?:needs|requires|deserves)\s+(?:my\s+)?attention|what\s+do\s+i\s+need\s+to\s+follow\s+up(?:\s+on)?|(?:my\s+)?(?:administrative|admin)\s+inbox|what\s+admin(?:istration)?\s+is\s+(?:open|pending|outstanding))\??$/iu], fr: [/^(?:qu'est-ce\s+qui\s+(?:demande|mérite|nécessite)\s+mon\s+attention|(?:ma\s+)?boîte\s+administrative|qu'est-ce\s+que\s+je\s+dois\s+suivre)\??$/iu] } },
  { tool: 'admin.weeklyReview', confidence: 0.95, patterns: { nl: [/^(?:geef\s+(?:mij|me)\s+)?(?:mijn\s+)?(?:project\s*overzicht|weekoverzicht|week\s*review|wekelijkse\s+review|projectreview|overzicht\s+van\s+mijn\s+projecten)(?:\s+(?:voor|van)\s+deze\s+week)?\??$/iu, /^hoe\s+staan\s+mijn\s+projecten\s+(?:ervoor|erbij)(?:\s+deze\s+week)?\??$/iu], en: [/^(?:give\s+me\s+)?(?:my\s+)?(?:weekly\s+(?:project\s+)?review|project\s+overview|week\s+review|project\s+review)(?:\s+for\s+this\s+week)?\??$/iu, /^how\s+are\s+my\s+projects\s+(?:doing|going)(?:\s+this\s+week)?\??$/iu], fr: [/^(?:donne-moi\s+)?(?:ma\s+)?(?:revue\s+hebdomadaire|revue\s+de\s+la\s+semaine|aperçu\s+(?:de\s+mes\s+)?projets)(?:\s+(?:pour|de)\s+cette\s+semaine)?\??$/iu] } },
  { tool: 'admin.deadlines', confidence: 0.95, patterns: { nl: [/^welke\s+deadlines?\s+(?:heb\s+ik|hebben\s+we|zijn\s+er|komen\s+eraan)(?:\s+(?<period>.+?))?\??$/iu, /^(?:wat\s+zijn\s+)?(?:mijn|de)\s+deadlines?(?:\s+(?:van|voor)\s+(?<period>.+?))?\??$/iu], en: [/^(?:what|which)\s+deadlines?\s+(?:do\s+(?:i|we)\s+have|are\s+(?:there|coming\s+up))(?:\s+(?<period>.+?))?\??$/iu, /^(?:what\s+are\s+)?(?:my|the)\s+deadlines?(?:\s+(?:for|of)\s+(?<period>.+?))?\??$/iu], fr: [/^(?:quelles|quels)\s+(?:échéances|echeances|délais|delais|deadlines)\s+(?:ai-je|avons-nous|y\s+a-t-il)(?:\s+(?<period>.+?))?\??$/iu, /^(?:mes|les)\s+(?:échéances|deadlines)(?:\s+(?:de|pour)\s+(?<period>.+?))?\??$/iu] }, build: (m, c) => {
    const period = m.groups?.period ? parsePeriod(m.groups.period, c.now, c.timezone) : null;
    const useProject = /\b(?:we|wij|nous|hebben\s+we|avons-nous|dit\s+project|this\s+project|ce\s+projet)\b/i.test(c.text) && hasFocus(c, 'projectId');
    return { ...(period ? { from: period.from, to: period.to } : {}), ...(useProject ? { projectId: c.focus?.projectId } : {}) };
  } },

  // ---- Invoices ----------------------------------------------------------------
  { tool: 'invoice.paymentStatus', confidence: 0.95, patterns: { nl: [new RegExp(String.raw`^(?:heb|hebben\s+we|heeft\s+(?<payer>${NAME}))\s+(?:ik\s+)?(?<name>${NAME})?\s*(?:al|reeds)?\s*betaald\??$`, 'iu'), new RegExp(String.raw`^is\s+(?:de\s+factuur\s+van\s+)?(?<name>${NAME})\s+(?:al|reeds)?\s*betaald\??$`, 'iu')], en: [new RegExp(String.raw`^(?:have|did)\s+i\s+(?:already\s+)?(?:paid|pay)\s+(?<name>${NAME})(?:\s+(?:already|yet))?\??$`, 'iu'), new RegExp(String.raw`^(?:is|has)\s+(?:the\s+invoice\s+(?:from|of)\s+)?(?<name>${NAME})\s+(?:been\s+)?paid(?:\s+yet)?\??$`, 'iu'), new RegExp(String.raw`^has\s+(?<payer>${NAME})\s+paid(?:\s+(?:me|us|yet|already))*\??$`, 'iu')], fr: [new RegExp(String.raw`^(?:ai-je|est-ce\s+que\s+j'ai)\s+(?:déjà\s+|deja\s+)?payé\s+(?<name>${NAME})\??$`, 'iu'), new RegExp(String.raw`^(?:la\s+facture\s+de\s+)?(?<name>${NAME})\s+est-elle\s+(?:déjà\s+)?payée\??$`, 'iu'), new RegExp(String.raw`^est-ce\s+que\s+(?<payer>${NAME})\s+a\s+(?:déjà\s+)?payé\??$`, 'iu')] }, build: (m) => {
    const name = clean(m.groups?.name ?? m.groups?.payer);
    if (!name || /^(?:ik|we|wij|i|we|je|nous|die|deze|dit|that|this)$/i.test(name)) return null;
    return { query: stripLead(name) };
  } },
  { tool: 'invoice.list', confidence: 0.96, patterns: { nl: [/^welke\s+facturen\s+(?:staan|zijn)\s+(?:er\s+)?(?:nog\s+)?(?:open|onbetaald|niet\s+betaald)\??$/iu, /^(?:toon\s+(?:mij\s+)?)?(?:de\s+|mijn\s+)?(?:openstaande|onbetaalde|open)\s+facturen\??$/iu, /^welke\s+facturen\s+(?:moet|moeten)\s+(?:ik\s+)?(?<period>deze\s+week|vandaag|morgen|binnenkort|deze\s+maand|nog)?\s*(?:nog\s+)?(?:betalen|betaald\s+worden)(?:\s+(?<period2>deze\s+week|vandaag|deze\s+maand|binnenkort))?\??$/iu, /^wat\s+moet\s+ik\s+(?<period>deze\s+week|vandaag|deze\s+maand|binnenkort)?\s*(?:nog\s+)?betalen(?:\s+(?<period2>deze\s+week|vandaag|deze\s+maand))?\??$/iu, /^welke\s+facturen\s+zijn\s+(?:te\s+laat|vervallen|over\s+(?:tijd|datum)|achterstallig)\??$/iu, /^(?:welke\s+facturen\s+(?:moet|moeten)\s+(?:ik\s+)?nog\s+(?:ontvangen|binnenkomen|betaald\s+krijgen)|wie\s+moet\s+(?:mij|me)\s+nog\s+betalen|welke\s+klanten\s+(?:moeten|hebben)\s+(?:nog|niet)\s+betaald)\??$/iu, /^(?:welke\s+)?(?:concept|ontwerp)?facturen(?:\s+in\s+concept)?\s+(?:heb\s+ik|staan\s+er)(?:\s+nog)?\??$/iu], en: [/^(?:what|which)\s+invoices\s+are\s+(?:still\s+)?(?:open|outstanding|unpaid)\??$/iu, /^(?:show\s+(?:me\s+)?)?(?:the\s+|my\s+)?(?:open|outstanding|unpaid)\s+invoices\??$/iu, /^(?:what|which)\s+invoices\s+(?:do|must|should)\s+i\s+(?:still\s+)?pay(?:\s+(?<period>this\s+week|today|tomorrow|soon|this\s+month))?\??$/iu, /^what\s+do\s+i\s+(?:still\s+)?(?:need|have)\s+to\s+pay(?:\s+(?<period>this\s+week|today|this\s+month|soon))?\??$/iu, /^(?:what|which)\s+invoices\s+are\s+(?:overdue|late|past\s+due)\??$/iu, /^(?:who\s+(?:still\s+)?(?:owes\s+me\s+money|has\s+to\s+pay\s+me|hasn't\s+paid)|which\s+(?:clients|customers)\s+(?:still\s+)?(?:owe|haven't\s+paid))\??$/iu, /^(?:what|which)\s+draft\s+invoices\s+(?:do\s+i\s+have|are\s+there)\??$/iu], fr: [/^quelles\s+factures\s+(?:sont|restent)\s+(?:encore\s+)?(?:ouvertes|impayées|impayees)\??$/iu, /^(?:montre(?:-moi)?\s+)?(?:les\s+|mes\s+)?factures\s+(?:ouvertes|impayées|impayees)\??$/iu, /^quelles\s+factures\s+dois-je\s+(?:encore\s+)?payer(?:\s+(?<period>cette\s+semaine|aujourd'hui|ce\s+mois-ci|bientôt))?\??$/iu, /^quelles\s+factures\s+sont\s+en\s+retard\??$/iu, /^qui\s+doit\s+encore\s+me\s+payer\??$/iu] }, build: (m, c) => {
    const lower = c.text.toLowerCase();
    const period = (m.groups?.period ?? m.groups?.period2 ?? '').toLowerCase();
    const pay = /\b(?:betalen|betaald\s+worden|pay|payer)\b/.test(lower);
    const receive = /\b(?:ontvangen|binnenkomen|betaald\s+krijgen|mij\s+nog\s+betalen|me\s+nog\s+betalen|owes?\s+me|pay\s+me|haven't\s+paid|hasn't\s+paid|me\s+payer|klanten|clients|customers)\b/.test(lower);
    const overdue = /\b(?:te\s+laat|vervallen|over\s+tijd|achterstallig|overdue|late|past\s+due|en\s+retard)\b/.test(lower);
    const draft = /\b(?:concept|ontwerp|draft)/.test(lower);
    const filter = draft ? 'draft' : overdue ? 'overdue' : /week|semaine/.test(period) ? 'due_this_week' : /vandaag|morgen|today|tomorrow|binnenkort|soon|bientôt|maand|month|mois/.test(period) ? 'due_soon' : 'open';
    return { filter, direction: receive ? 'outgoing' : pay ? 'incoming' : null };
  } },
  { tool: 'timesheet.invoice', confidence: 0.95, patterns: { nl: [new RegExp(String.raw`^(?:maak|stel|genereer)\s+(?:mijn|de|een)\s+factuur\s+(?:op\s+)?(?:voor|van)\s+(?<period>${Object.keys(MONTHS).join('|')}|deze\s+maand|vorige\s+maand|deze\s+week|vorige\s+week)(?:\s+(?:voor|aan)\s+(?:klant\s+)?(?<client>.+?))?[.!]?$`, 'iu'), new RegExp(String.raw`^factureer\s+(?<period>${Object.keys(MONTHS).join('|')}|deze\s+maand|vorige\s+maand)(?:\s+(?:aan|voor)\s+(?:klant\s+)?(?<client>.+?))?[.!]?$`, 'iu')], en: [new RegExp(String.raw`^(?:create|make|prepare|generate|draft)\s+(?:my|the|an)\s+invoice\s+for\s+(?<period>${Object.keys(MONTHS).join('|')}|this\s+month|last\s+month|this\s+week|last\s+week)(?:\s+(?:for|to)\s+(?:client\s+)?(?<client>.+?))?[.!]?$`, 'iu'), new RegExp(String.raw`^invoice\s+(?<period>${Object.keys(MONTHS).join('|')}|this\s+month|last\s+month)(?:\s+(?:to|for)\s+(?:client\s+)?(?<client>.+?))?[.!]?$`, 'iu')], fr: [new RegExp(String.raw`^(?:crée|cree|fais|prépare|prepare|génère|genere)\s+(?:ma|la|une)\s+facture\s+(?:de|pour|du\s+mois\s+de)\s+(?<period>${Object.keys(MONTHS).join('|')}|ce\s+mois-ci|le\s+mois\s+dernier|cette\s+semaine)(?:\s+pour\s+(?:le\s+client\s+)?(?<client>.+?))?[.!]?$`, 'iu')] }, build: (m, c) => {
    const period = parsePeriod(m.groups?.period ?? '', c.now, c.timezone);
    if (!period) return null;
    return { from: period.from, to: period.to, client: m.groups?.client ? stripLead(m.groups.client) : null };
  } },
  { tool: 'invoice.create', confidence: 0.95, patterns: { nl: [/^(?:maak|stel|genereer|schrijf)\s+(?:een\s+|de\s+)?factuur\s+(?:op\s+)?(?:voor|aan)\s+(?:klant\s+|cliënt\s+)?(?<client>.+?)(?:\s+(?:voor|van|met|:)\s+(?<desc>.+))?\.?$/iu, /^factuur\s+(?:voor|aan)\s+(?:klant\s+)?(?<client>.+?)(?:\s*[:,]\s*(?<desc>.+))?\.?$/iu], en: [/^(?:create|make|draft|write|generate|prepare)\s+(?:an?\s+|the\s+)?invoice\s+(?:for|to)\s+(?:client\s+|customer\s+)?(?<client>.+?)(?:\s+(?:for|of|with|:)\s+(?<desc>.+))?\.?$/iu, /^invoice\s+(?:for|to)\s+(?:client\s+)?(?<client>.+?)(?:\s*[:,]\s*(?<desc>.+))?\.?$/iu], fr: [/^(?:crée|cree|fais|prépare|prepare|rédige|redige|génère|genere)\s+(?:une\s+|la\s+)?facture\s+(?:pour|à|a)\s+(?:le\s+client\s+)?(?<client>.+?)(?:\s+(?:pour|de|avec|:)\s+(?<desc>.+))?\.?$/iu] }, build: (m, c) => {
    const client = stripLead(m.groups?.client ?? '');
    if (!client || /^\d/.test(client)) return null;
    const desc = m.groups?.desc ?? '';
    const lines = desc ? parseInvoiceLines(desc) : [];
    if (lines.length === 0) {
      if (desc && !/\d/.test(desc)) return { missing: 'lines', question: Q.lines[c.language], args: { client, description: capitalizeFirst(clean(desc)) } };
      return { missing: 'lines', question: Q.lines[c.language], args: { client } };
    }
    const period = parsePeriod(desc, c.now, c.timezone);
    return { client, lines, ...(period && period.label !== 'today' ? { servicePeriodStart: period.from, servicePeriodEnd: period.to } : {}) };
  } },
  { tool: 'invoice.get', confidence: 0.94, patterns: { nl: [/^(?:wanneer|wanner)\s+(?:vervalt|moet\s+ik)\s+(?:deze|die|de)\s+factuur(?:\s+betalen)?\??$/iu, /^(?:wat\s+is\s+)?(?:de\s+)?vervaldatum\s+(?:van\s+(?:deze|die|de)\s+factuur)?\??$/iu, /^wanneer\s+(?:vervalt|moet\s+ik)\s+(?:de\s+)?factuur\s+van\s+(?<query>.+?)(?:\s+betalen)?\??$/iu, /^(?:toon|open)\s+(?:de\s+)?factuur(?:\s+van\s+(?<query>.+?))?\??$/iu], en: [/^when\s+(?:is|does)\s+(?:this|that|the)\s+invoice\s+(?:due|expire|need\s+to\s+be\s+paid)\??$/iu, /^(?:what(?:'s|\s+is)\s+)?(?:the\s+)?due\s+date(?:\s+(?:of|for)\s+(?:this|that|the)\s+invoice)?\??$/iu, /^when\s+is\s+the\s+invoice\s+(?:from|of)\s+(?<query>.+?)\s+due\??$/iu, /^(?:show|open)\s+(?:the\s+)?invoice(?:\s+(?:from|of)\s+(?<query>.+?))?\??$/iu], fr: [/^quand\s+(?:expire|arrive\s+à\s+échéance|dois-je\s+payer)\s+cette\s+facture\??$/iu, /^(?:quelle\s+est\s+)?(?:la\s+)?(?:date\s+d')?échéance(?:\s+de\s+cette\s+facture)?\??$/iu, /^quand\s+(?:expire|est\s+due)\s+la\s+facture\s+de\s+(?<query>.+?)\??$/iu] }, build: (m, c) => (m.groups?.query ? { query: stripLead(m.groups.query) } : hasFocus(c, 'invoiceId') ? {} : null) },
  { tool: 'invoice.remind', confidence: 0.95, patterns: { nl: [new RegExp(String.raw`^(?:herinner|verwittig|waarschuw)\s+(?:mij|me)\s+(?<n>\d+|een|één|twee|drie|vier|vijf|zeven|tien)\s+dag(?:en)?\s+(?:voor|vóór|op\s+voorhand\s+van)\s+(?:de\s+)?(?:vervaldag|vervaldatum|betaaldatum)(?:\s+van\s+(?:deze|die|de)\s+factuur(?:\s+van\s+(?<query>.+?))?)?[.!]?$`, 'iu'), /^(?:maak|zet)\s+(?:daarna\s+|dan\s+|ook\s+|even\s+)?(?:een\s+)?(?:reminder|herinnering)\s+(?:voor|op)\s+(?:die|deze|de)\s+factuur(?:\s+van\s+(?<query>.+?))?[.!]?$/iu], en: [new RegExp(String.raw`^remind\s+me\s+(?<n>\d+|one|two|three|four|five|seven|ten)\s+days?\s+before\s+(?:the\s+)?(?:due\s+date|deadline|it(?:'s|\s+is)\s+due)(?:\s+of\s+(?:this|that|the)\s+invoice(?:\s+from\s+(?<query>.+?))?)?[.!]?$`, 'iu'), /^(?:then\s+|also\s+)?(?:create|set|make)\s+(?:a\s+)?reminder\s+for\s+(?:that|this|the)\s+invoice(?:\s+from\s+(?<query>.+?))?[.!]?$/iu], fr: [new RegExp(String.raw`^rappelle-moi\s+(?<n>\d+|un|une|deux|trois|quatre|cinq|sept|dix)\s+jours?\s+avant\s+(?:la\s+date\s+d'|l')?(?:échéance|echeance)(?:\s+de\s+cette\s+facture)?[.!]?$`, 'iu'), /^(?:crée|cree|mets)\s+(?:ensuite\s+)?un\s+rappel\s+pour\s+cette\s+facture[.!]?$/iu] }, build: (m, c) => {
    const query = m.groups?.query ? stripLead(m.groups.query) : null;
    if (!query && !hasFocus(c, 'invoiceId')) return null;
    return { daysBefore: numberWord(m.groups?.n) ?? 3, query };
  } },
  { tool: 'invoice.markPaid', confidence: 0.94, patterns: { nl: [/^(?:markeer|zet)\s+(?:die|deze|de)\s+factuur(?:\s+van\s+(?<query>.+?))?\s+als\s+betaald[.!]?$/iu, /^(?:die|deze|de)\s+factuur(?:\s+van\s+(?<query>.+?))?\s+is\s+betaald[.!]?$/iu, /^ik\s+heb\s+(?:die|deze|de)\s+factuur(?:\s+van\s+(?<query>.+?))?\s+betaald[.!]?$/iu, /^(?<query>[A-Z][^.!?]+?)\s+(?:is|heeft)\s+betaald[.!]?$/u], en: [/^mark\s+(?:this|that|the)\s+invoice(?:\s+from\s+(?<query>.+?))?\s+as\s+paid[.!]?$/iu, /^(?:this|that|the)\s+invoice(?:\s+from\s+(?<query>.+?))?\s+(?:is|has\s+been|was)\s+paid[.!]?$/iu, /^i(?:'ve|\s+have)?\s+paid\s+(?:this|that|the)\s+invoice(?:\s+from\s+(?<query>.+?))?[.!]?$/iu, /^(?<query>[A-Z][^.!?]+?)\s+(?:has\s+)?paid[.!]?$/u], fr: [/^marque\s+cette\s+facture\s+comme\s+payée[.!]?$/iu, /^cette\s+facture\s+est\s+payée[.!]?$/iu, /^j'ai\s+payé\s+cette\s+facture(?:\s+de\s+(?<query>.+?))?[.!]?$/iu] }, build: (m, c) => {
    const query = m.groups?.query ? stripLead(m.groups.query) : null;
    if (!query && !hasFocus(c, 'invoiceId')) return null;
    return { query };
  } },
  { tool: 'invoice.generatePdf', confidence: 0.95, patterns: { nl: [/^(?:maak|genereer|exporteer)\s+(?:de\s+|een\s+)?pdf(?:\s+van\s+(?:die|deze|de)\s+factuur)?[.!]?$/iu, /^(?:factuur\s+(?:als|naar)\s+pdf|pdf\s+genereren)[.!]?$/iu], en: [/^(?:generate|make|create|export)\s+(?:the\s+|a\s+)?pdf(?:\s+(?:of|for)\s+(?:this|that|the)\s+invoice)?[.!]?$/iu, /^(?:export\s+(?:this|the)\s+invoice\s+(?:as|to)\s+pdf|invoice\s+(?:as|to)\s+pdf)[.!]?$/iu], fr: [/^(?:génère|genere|crée|cree|exporte)\s+(?:le\s+|un\s+)?pdf(?:\s+de\s+cette\s+facture)?[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'invoiceId') ? {} : null) },
  { tool: 'invoice.issue', confidence: 0.95, patterns: { nl: [/^(?:bevestig|finaliseer|maak\s+definitief|zet\s+vast|verstuur|geef\s+(?:een\s+)?nummer\s+aan)\s+(?:die|deze|de)\s+factuur[.!]?$/iu, /^factuur\s+(?:definitief\s+maken|bevestigen|finaliseren)[.!]?$/iu], en: [/^(?:finali[sz]e|issue|confirm|lock)\s+(?:this|that|the)\s+invoice[.!]?$/iu], fr: [/^(?:finalise|valide|émets|emets|confirme)\s+cette\s+facture[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'invoiceId') ? {} : null) },
  { tool: 'invoice.cancelDraft', confidence: 0.93, patterns: { nl: [/^(?:annuleer|verwijder|gooi\s+weg)\s+(?:die|deze|de|het)\s+(?:concept)?factuur[.!]?$/iu], en: [/^(?:cancel|discard|delete)\s+(?:this|that|the)\s+(?:draft\s+)?invoice[.!]?$/iu], fr: [/^(?:annule|supprime)\s+(?:ce|cette)\s+(?:brouillon\s+de\s+)?facture[.!]?$/iu] }, build: (_m, c) => (hasFocus(c, 'invoiceId') ? {} : null) },
  { tool: 'invoice.recordIncoming', confidence: 0.93, patterns: { nl: [/^(?:verwerk|registreer|boek|sla\s+op)\s+(?:deze|die|de)\s+(?:inkomende\s+)?factuur(?:\s+van\s+(?<name>.+?))?[.!]?$/iu, /^dit\s+is\s+een\s+factuur(?:\s+van\s+(?<name>.+?))?\s*[:.]\s*(?<text>[\s\S]+)$/iu], en: [/^(?:process|record|book|register|store)\s+(?:this|that|the)\s+(?:incoming\s+)?invoice(?:\s+from\s+(?<name>.+?))?[.!]?$/iu, /^this\s+is\s+an\s+invoice(?:\s+from\s+(?<name>.+?))?\s*[:.]\s*(?<text>[\s\S]+)$/iu], fr: [/^(?:traite|enregistre|comptabilise)\s+cette\s+facture(?:\s+de\s+(?<name>.+?))?[.!]?$/iu, /^voici\s+une\s+facture(?:\s+de\s+(?<name>.+?))?\s*[:.]\s*(?<text>[\s\S]+)$/iu] }, build: (m, c) => {
    const text = m.groups?.text?.trim();
    if (text) return { text };
    return hasFocus(c, 'emailId') || hasFocus(c, 'documentId') ? {} : null;
  } },

  // ---- Timesheets --------------------------------------------------------------
  { tool: 'timesheet.create', confidence: 0.95, patterns: { nl: [new RegExp(String.raw`^(?:noteer|registreer|log|boek|schrijf)\s+(?<q>${NUMBER})\s*(?<unit>uur|uren|u|werkdagen|dagen|dag)\s+(?:voor|op|aan)\s+(?:project\s+|klant\s+)?(?<name>.+?)(?<when>\s+(?:vandaag|gisteren|eergisteren|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|op\s+\d.*|afgelopen\s+\w+|vorige\s+\w+))?[.!]?$`, 'iu'), new RegExp(String.raw`^(?:ik\s+heb\s+)?(?<q>${NUMBER})\s*(?<unit>uur|uren|u|werkdagen|dagen|dag)\s+gewerkt\s+(?:voor|aan|op)\s+(?:project\s+|klant\s+)?(?<name>.+?)(?<when>\s+(?:vandaag|gisteren|eergisteren|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|op\s+\d.*))?[.!]?$`, 'iu')], en: [new RegExp(String.raw`^(?:log|record|note|book|track)\s+(?<q>${NUMBER})\s*(?<unit>hours?|hrs?|h|days?)\s+(?:for|on|to)\s+(?:project\s+|client\s+)?(?<name>.+?)(?<when>\s+(?:today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|on\s+\d.*|last\s+\w+))?[.!]?$`, 'iu'), new RegExp(String.raw`^i\s+worked\s+(?<q>${NUMBER})\s*(?<unit>hours?|hrs?|h|days?)\s+(?:for|on)\s+(?:project\s+|client\s+)?(?<name>.+?)(?<when>\s+(?:today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|on\s+\d.*))?[.!]?$`, 'iu')], fr: [new RegExp(String.raw`^(?:note|enregistre|log)\s+(?<q>${NUMBER})\s*(?<unit>heures?|h|jours?)\s+(?:pour|sur)\s+(?:le\s+projet\s+|le\s+client\s+)?(?<name>.+?)(?<when>\s+(?:aujourd'hui|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|le\s+\d.*))?[.!]?$`, 'iu'), new RegExp(String.raw`^j'ai\s+travaillé\s+(?<q>${NUMBER})\s*(?<unit>heures?|h|jours?)\s+(?:pour|sur)\s+(?:le\s+projet\s+|le\s+client\s+)?(?<name>.+?)(?<when>\s+(?:aujourd'hui|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche))?[.!]?$`, 'iu')] }, build: (m, c) => {
    const g = m.groups ?? {};
    const q = Number((g.q ?? '0').replace(',', '.'));
    const isDay = /^(?:werkdagen|dagen|dag|days?|jours?)$/i.test(g.unit ?? '');
    const minutes = Math.round(q * (isDay ? 480 : 60));
    if (!(minutes > 0)) return null;
    const isClient = /\b(?:klant|client|customer)\s/i.test(m[0]);
    const name = stripLead(g.name ?? '');
    const date = g.when ? dateIn(g.when, { ...c, now: c.now }) : null;
    return { minutes, date: date ?? c.now.setZone(c.timezone).toISODate(), ...(isClient ? { client: name } : { project: name }) };
  } },
  { tool: 'timesheet.summary', confidence: 0.95, patterns: { nl: [/^hoeveel\s+(?<unit>dagen|uur|uren)\s+heb\s+ik\s+(?<period1>deze\s+maand|vorige\s+maand|deze\s+week|vorige\s+week|dit\s+jaar|in\s+\w+)?\s*gewerkt\s+(?:voor|aan|op)\s+(?:(?<kind>klant|project)\s+)?(?<name>.+?)(?:\s+(?<period2>deze\s+maand|vorige\s+maand|deze\s+week|vorige\s+week|dit\s+jaar|in\s+\w+))?\??$/iu], en: [/^how\s+many\s+(?<unit>days|hours)\s+(?:did|have)\s+i\s+work(?:ed)?\s+(?:for|on)\s+(?:(?<kind>client|project)\s+)?(?<name>.+?)(?:\s+(?<period2>this\s+month|last\s+month|this\s+week|last\s+week|this\s+year|in\s+\w+))?\??$/iu, /^how\s+many\s+(?<unit>days|hours)\s+(?<period1>this\s+month|last\s+month|this\s+week|last\s+week)\s+(?:did|have)\s+i\s+work(?:ed)?\s+(?:for|on)\s+(?:(?<kind>client|project)\s+)?(?<name>.+?)\??$/iu], fr: [/^combien\s+(?:de\s+)?(?<unit>jours|heures)\s+ai-je\s+travaillé\s+(?:pour|sur)\s+(?:(?<kind>le\s+client|le\s+projet)\s+)?(?<name>.+?)(?:\s+(?<period2>ce\s+mois-ci|le\s+mois\s+dernier|cette\s+semaine|la\s+semaine\s+dernière|cette\s+année|en\s+\w+))?\??$/iu] }, build: (m, c) => {
    const g = m.groups ?? {};
    const period = parsePeriod(g.period1 ?? g.period2 ?? '', c.now, c.timezone) ?? parsePeriod('deze maand', c.now, c.timezone);
    const isProject = /project|projet/i.test(g.kind ?? '');
    const name = stripLead(g.name ?? '');
    return { ...(isProject ? { project: name } : { client: name }), from: period?.from, to: period?.to, unit: /uur|uren|hours|heures/i.test(g.unit ?? '') ? 'hours' : 'days' };
  } },

  // ---- Expenses ----------------------------------------------------------------
  { tool: 'expense.create', confidence: 0.92, patterns: { nl: [new RegExp(String.raw`^(?:noteer|registreer|voeg\s+toe|boek)\s+(?:een\s+)?(?:uitgave|kost|onkost|onkosten)\s+(?:van\s+)?(?<amount>${PRICE})\s+(?:bij|voor|aan)\s+(?<merchant>.+?)(?:\s+voor\s+(?:project\s+)?(?<project>.+?))?[.!]?$`, 'iu'), new RegExp(String.raw`^(?<amount>€\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|euro|eur))\s+(?:bij|uitgegeven\s+bij|betaald\s+(?:bij|aan))\s+(?<merchant>.+?)(?:\s+voor\s+(?:project\s+)?(?<project>.+?))?[.!]?$`, 'iu')], en: [new RegExp(String.raw`^(?:log|add|record|note)\s+(?:an?\s+)?expense\s+(?:of\s+)?(?<amount>${PRICE})\s+(?:at|for|to)\s+(?<merchant>.+?)(?:\s+for\s+(?:project\s+)?(?<project>.+?))?[.!]?$`, 'iu'), new RegExp(String.raw`^(?:i\s+)?(?:spent|paid)\s+(?<amount>${PRICE})\s+(?:at|on|for)\s+(?<merchant>.+?)(?:\s+for\s+(?:project\s+)?(?<project>.+?))?[.!]?$`, 'iu')], fr: [new RegExp(String.raw`^(?:note|ajoute|enregistre)\s+(?:une\s+)?(?:dépense|depense|note\s+de\s+frais)\s+(?:de\s+)?(?<amount>${PRICE})\s+(?:chez|pour|à)\s+(?<merchant>.+?)(?:\s+pour\s+(?:le\s+projet\s+)?(?<project>.+?))?[.!]?$`, 'iu')] }, build: (m) => {
    const amount = parseAmountToCents(m.groups?.amount ?? '');
    if (!amount) return null;
    return { merchant: capitalizeFirst(clean(m.groups?.merchant)), amountCents: amount.cents, project: m.groups?.project ? stripLead(m.groups.project) : null };
  } },
  { tool: 'expense.list', confidence: 0.94, patterns: { nl: [/^(?:welke\s+|toon\s+(?:mij\s+)?(?:mijn\s+)?)?(?:uitgaven|onkosten|kosten)(?:\s+heb\s+ik)?(?:\s+(?<period>deze\s+maand|vorige\s+maand|deze\s+week|dit\s+jaar|in\s+\w+))?(?:\s+gemaakt)?\??$/iu], en: [/^(?:(?:show|list)\s+(?:me\s+)?(?:my\s+)?|what\s+)?expenses(?:\s+(?:do|did)\s+i\s+have)?(?:\s+(?<period>this\s+month|last\s+month|this\s+week|this\s+year|in\s+\w+))?\??$/iu], fr: [/^(?:(?:montre|liste)\s+(?:mes\s+)?)?(?:dépenses|depenses|notes\s+de\s+frais)(?:\s+(?<period>ce\s+mois-ci|le\s+mois\s+dernier|cette\s+semaine|cette\s+année|en\s+\w+))?\??$/iu] }, build: (m, c) => {
    const period = m.groups?.period ? parsePeriod(m.groups.period, c.now, c.timezone) : null;
    return period ? { from: period.from, to: period.to } : {};
  } },

  // ---- Documents ---------------------------------------------------------------
  { tool: 'document.expiring', confidence: 0.95, patterns: { nl: [/^wanneer\s+(?:loopt|vervalt|eindigt|verloopt)\s+(?:mijn|het|de|m'n)\s+(?<type>contract|verzekering|abonnement|polis|vergunning|certificaat|keuring|licentie)(?:\s+(?:met|van|bij|voor)\s+(?:klant\s+)?(?<name>.+?))?\s+(?:af|op)?\??$/iu, /^(?:welke\s+documenten\s+(?:vervallen|verlopen|lopen\s+af)|wat\s+(?:vervalt|verloopt|loopt\s+af))(?:\s+(?:er\s+)?(?:binnenkort|deze\s+maand|dit\s+jaar))?\??$/iu], en: [/^when\s+(?:does|will)\s+my\s+(?<type>contract|insurance|subscription|policy|licen[cs]e|certificate|inspection)(?:\s+(?:with|from|for|at)\s+(?:client\s+)?(?<name>.+?))?\s+(?:expire|end|run\s+out|renew)\??$/iu, /^(?:which|what)\s+documents\s+(?:expire|are\s+expiring|run\s+out)(?:\s+(?:soon|this\s+month|this\s+year))?\??$/iu, /^what\s+expires\s+soon\??$/iu], fr: [/^quand\s+(?:expire|se\s+termine|prend\s+fin)\s+mon\s+(?<type>contrat|assurance|abonnement|police|permis|certificat)(?:\s+(?:avec|chez|de)\s+(?<name>.+?))?\??$/iu, /^quels\s+documents\s+expirent(?:\s+bientôt)?\??$/iu] }, build: (m) => {
    const typeWord = (m.groups?.type ?? '').toLowerCase();
    const type = /contract|contrat/.test(typeWord) ? 'contract' : /verzekering|insurance|assurance|polis|policy|police/.test(typeWord) ? 'insurance' : /abonnement|subscription/.test(typeWord) ? 'subscription' : /vergunning|licen|permis/.test(typeWord) ? 'license' : /certificaat|certificate|certificat/.test(typeWord) ? 'certificate' : /keuring|inspection/.test(typeWord) ? 'vehicle' : null;
    return { type, client: m.groups?.name ? stripLead(m.groups.name) : null };
  } },
  { tool: 'document.search', confidence: 0.95, patterns: { nl: [/^(?:zoek|vind|toon|waar\s+is|geef\s+(?:mij|me))\s+(?:mijn|het|de|m'n)?\s*(?<type>contract|verzekering|offerte|polis|attest|certificaat|document|factuur|overeenkomst|vergunning)\s+(?:met|van|voor|bij)\s+(?:klant\s+|leverancier\s+)?(?<name>.+?)\??$/iu, /^(?:zoek|vind|toon)\s+(?:de\s+|mijn\s+)?documenten\s+(?:van|voor|over|rond)\s+(?:klant\s+|project\s+)?(?<name>.+?)\??$/iu, /^(?:zoek|vind)\s+(?:het\s+)?document\s+(?:over|met|genaamd)\s+(?<query>.+?)\??$/iu], en: [/^(?:find|search(?:\s+for)?|look\s+up|show|where\s+is|get)\s+(?:my|the)?\s*(?<type>contract|insurance|quote|policy|certificate|document|invoice|agreement|licen[cs]e)\s+(?:with|from|for|of)\s+(?:client\s+|supplier\s+)?(?<name>.+?)\??$/iu, /^(?:find|search|show)\s+(?:the\s+|my\s+)?documents\s+(?:of|for|about|on)\s+(?:client\s+|project\s+)?(?<name>.+?)\??$/iu, /^(?:find|search)\s+(?:the\s+)?document\s+(?:about|named|called)\s+(?<query>.+?)\??$/iu], fr: [/^(?:cherche|trouve|montre|où\s+est|ou\s+est)\s+(?:mon|le|la|ma)?\s*(?<type>contrat|assurance|devis|police|attestation|certificat|document|facture|accord)\s+(?:avec|de|du|pour|chez)\s+(?:le\s+client\s+)?(?<name>.+?)\??$/iu, /^(?:cherche|trouve|montre)\s+(?:les\s+|mes\s+)?documents\s+(?:de|pour|sur)\s+(?:le\s+client\s+|le\s+projet\s+)?(?<name>.+?)\??$/iu] }, build: (m, c) => {
    const typeWord = (m.groups?.type ?? '').toLowerCase();
    const type = /contract|contrat|overeenkomst|agreement/.test(typeWord) ? 'contract' : /verzekering|insurance|assurance|polis|policy|police/.test(typeWord) ? 'insurance' : /offerte|quote|devis/.test(typeWord) ? 'quote' : /attest|certificaat|certificate|certificat|attestation/.test(typeWord) ? 'certificate' : /factuur|invoice|facture/.test(typeWord) ? 'invoice' : /vergunning|licen/.test(typeWord) ? 'license' : null;
    const name = m.groups?.name ? stripLead(m.groups.name) : null;
    const isProject = /\bproject|projet\b/i.test(c.text) && !/\bklant|client|customer\b/i.test(c.text);
    return { type, query: m.groups?.query ? clean(m.groups.query) : null, ...(name ? (isProject ? { project: name } : { client: name }) : {}) };
  } },
  { tool: 'document.remind', confidence: 0.94, patterns: { nl: [new RegExp(String.raw`^(?:ja,?\s*)?(?:herinner|verwittig)\s+(?:mij|me)\s+(?<n>\d+|een|één|twee|drie|zeven|tien|veertien|dertig)\s+(?<unit>dagen|dag|weken|week|maand|maanden)\s+(?:voor|vóór)(?:dat)?\s+(?:dit|dat|het)\s+(?:document|contract|vervalt|afloopt|verloopt)(?:\s+(?:vervalt|afloopt|verloopt))?[.!]?$`, 'iu'), /^(?:ja,?\s*)?maak\s+(?:een\s+)?(?:reminder|herinnering)\s+(?:voor|op)\s+(?:dit|dat|het)\s+(?:document|contract)(?:\s+(?<n>\d+)\s+(?<unit>dagen|weken))?[.!]?$/iu], en: [new RegExp(String.raw`^(?:yes,?\s*)?remind\s+me\s+(?<n>\d+|one|two|three|seven|ten|fourteen|thirty)\s+(?<unit>days?|weeks?|months?)\s+before\s+(?:this|that|the)\s+(?:document|contract)\s+(?:expires|ends|runs\s+out)[.!]?$`, 'iu'), /^(?:yes,?\s*)?(?:create|set)\s+(?:a\s+)?reminder\s+for\s+(?:this|that|the)\s+(?:document|contract)(?:\s+(?<n>\d+)\s+(?<unit>days?|weeks?)\s+before)?[.!]?$/iu], fr: [new RegExp(String.raw`^(?:oui,?\s*)?rappelle-moi\s+(?<n>\d+|un|une|deux|trois|sept|dix|quatorze|trente)\s+(?<unit>jours?|semaines?|mois)\s+avant\s+(?:l'expiration\s+de\s+ce\s+document|que\s+ce\s+(?:document|contrat)\s+(?:n')?expire)[.!]?$`, 'iu')] }, build: (m, c) => {
    if (!hasFocus(c, 'documentId')) return null;
    const n = numberWord(m.groups?.n) ?? (/dertig|thirty|trente/i.test(m.groups?.n ?? '') ? 30 : 14);
    const unit = (m.groups?.unit ?? '').toLowerCase();
    const days = /week|weken|semaine/.test(unit) ? n * 7 : /maand|month|mois/.test(unit) ? n * 30 : n;
    return { daysBefore: days };
  } },

  // ---- Projects: questions -----------------------------------------------------
  { tool: 'company.open', confidence: 0.95, patterns: { nl: [/^wat\s+(?:staat|is)\s+(?:er\s+)?(?:nog\s+|allemaal\s+)?open\s+(?:bij|voor|van)\s+(?:klant|cliënt|leverancier)\s+(?<client>.+?)\??$/iu, /^(?:openstaande\s+(?:zaken|facturen|items)|wat\s+is\s+(?:er\s+)?nog\s+open)\s+(?:bij|van|voor)\s+(?:klant\s+)?(?<client>.+?)\??$/iu], en: [/^what(?:'s|\s+is)\s+(?:still\s+)?(?:open|outstanding|pending)\s+(?:with|for|at)\s+(?:client|customer|supplier)\s+(?<client>.+?)\??$/iu, /^(?:open|outstanding)\s+items\s+(?:for|with)\s+(?:client\s+)?(?<client>.+?)\??$/iu], fr: [/^(?:qu'est-ce\s+qui|que)\s+(?:reste|est\s+encore)\s+(?:ouvert|en\s+cours)\s+(?:chez|pour)\s+(?:le\s+client\s+)?(?<client>.+?)\??$/iu] }, build: (m) => ({ client: stripLead(m.groups?.client ?? '') }) },
  { tool: 'project.status', confidence: 0.95, patterns: { nl: [/^wat\s+(?:staat|is)\s+(?:er\s+)?(?:nog\s+|allemaal\s+)?(?:open|te\s+doen)\s+(?:voor|bij|in|op|rond)\s+(?:project\s+|het\s+|de\s+)?(?<project>.+?)\??$/iu, /^(?:hoe\s+staat\s+(?:het\s+(?:met|ermee)|het)|hoe\s+ver\s+staan\s+we)\s+(?:met\s+)?(?:project\s+|het\s+)?(?<project>.+?)\??$/iu, /^(?:wat\s+is\s+)?(?:de\s+)?(?:status|stand\s+van\s+zaken)\s+(?:van|voor)\s+(?:project\s+|het\s+)?(?<project>.+?)\??$/iu, /^(?:project\s*overzicht|overzicht)\s+(?:van|voor)\s+(?:project\s+)?(?<project>.+?)\??$/iu], en: [/^what(?:'s|\s+is)\s+(?:still\s+)?(?:open|outstanding|left|pending|to\s+do)\s+(?:for|on|in|with)\s+(?:project\s+|the\s+)?(?<project>.+?)\??$/iu, /^how\s+(?:is|'s)\s+(?:project\s+|the\s+)?(?<project>.+?)\s+(?:going|doing|coming\s+along)\??$/iu, /^(?:what(?:'s|\s+is)\s+the\s+)?status\s+(?:of|for)\s+(?:project\s+|the\s+)?(?<project>.+?)\??$/iu, /^project\s+overview\s+(?:of|for)\s+(?<project>.+?)\??$/iu], fr: [/^(?:qu'est-ce\s+qui|que)\s+(?:reste|est\s+encore)\s+(?:ouvert|à\s+faire|a\s+faire)\s+(?:pour|sur|dans)\s+(?:le\s+projet\s+|le\s+)?(?<project>.+?)\??$/iu, /^où\s+en\s+est\s+(?:le\s+projet\s+|le\s+)?(?<project>.+?)\??$/iu, /^(?:quel\s+est\s+le\s+)?statut\s+(?:du\s+projet|de)\s+(?<project>.+?)\??$/iu] }, build: (m) => ({ project: stripLead(m.groups?.project ?? '') }) },
  { tool: 'project.everything', confidence: 0.95, patterns: { nl: [/^(?:toon|geef|laat\s+zien)\s+(?:mij\s+|me\s+)?(?:eens\s+)?alles\s+(?:rond|over|van|omtrent|i\.?v\.?m\.?)\s+(?:project\s+|het\s+)?(?<project>.+?)[.!?]?$/iu, /^alles\s+(?:rond|over)\s+(?:project\s+)?(?<project>.+?)[.!?]?$/iu], en: [/^(?:show|give)\s+(?:me\s+)?everything\s+(?:about|on|around|for|related\s+to)\s+(?:project\s+|the\s+)?(?<project>.+?)[.!?]?$/iu, /^everything\s+(?:about|on)\s+(?:project\s+)?(?<project>.+?)[.!?]?$/iu], fr: [/^(?:montre(?:-moi)?|affiche)\s+tout\s+(?:sur|autour\s+de|concernant|à\s+propos\s+de)\s+(?:le\s+projet\s+|le\s+)?(?<project>.+?)[.!?]?$/iu, /^tout\s+sur\s+(?:le\s+projet\s+)?(?<project>.+?)[.!?]?$/iu] }, build: (m) => ({ project: stripLead(m.groups?.project ?? '') }) },
  { tool: 'project.nextStep', confidence: 0.94, patterns: { nl: [/^wat\s+is\s+(?:de|onze|mijn)\s+volgende\s+stap(?:\s+(?:voor|in|bij)\s+(?:project\s+|het\s+)?(?<project>.+?))?\??$/iu, /^wat\s+(?:moet|kan)\s+(?:er|ik)\s+(?:nu|eerst|als\s+volgende)\s+(?:gebeuren|doen)(?:\s+(?:voor|in|bij)\s+(?:project\s+)?(?<project>.+?))?\??$/iu], en: [/^what(?:'s|\s+is)\s+(?:the|our|my)\s+next\s+step(?:\s+(?:for|on|in)\s+(?:project\s+|the\s+)?(?<project>.+?))?\??$/iu, /^what\s+should\s+(?:i|we)\s+do\s+next(?:\s+(?:for|on)\s+(?:project\s+)?(?<project>.+?))?\??$/iu], fr: [/^quelle\s+est\s+la\s+prochaine\s+étape(?:\s+(?:pour|sur|du)\s+(?:projet\s+|le\s+projet\s+)?(?<project>.+?))?\??$/iu, /^que\s+(?:dois-je|devons-nous)\s+faire\s+ensuite(?:\s+(?:pour|sur)\s+(?:le\s+projet\s+)?(?<project>.+?))?\??$/iu] }, build: (m, c) => (m.groups?.project ? { project: stripLead(m.groups.project) } : hasFocus(c, 'projectId') ? {} : {}) },
  { tool: 'project.blockers', confidence: 0.95, patterns: { nl: [/^welke\s+blockers?\s+(?:heb\s+ik|hebben\s+we|zijn\s+er)(?:\s+(?:voor|op|bij|in)\s+(?:project\s+|het\s+)?(?<project>.+?))?\??$/iu, /^wat\s+(?:blokkeert|houdt\s+(?:ons|mij)\s+tegen\s+(?:bij|in))\s+(?:dit|het|dat|ons)\s+project\??$/iu, /^wat\s+blokkeert\s+(?:project\s+|het\s+)?(?<project>.+?)\??$/iu, /^waarom\s+(?:staat|ligt)\s+(?:dit|het|dat|alles)(?:\s+project)?\s+stil\??$/iu, /^waarom\s+(?:gaat|vordert|schiet)\s+(?:dit|het|dat)(?:\s+project)?\s+niet\s+(?:vooruit|verder|op)\??$/iu, /^waarom\s+(?:staat|ligt)\s+(?:project\s+)?(?<project>.+?)\s+stil\??$/iu, /^(?:mijn|de)\s+blockers?\??$/iu], en: [/^(?:what|which)\s+blockers?\s+(?:do\s+(?:i|we)\s+have|are\s+there)(?:\s+(?:for|on|in)\s+(?:project\s+|the\s+)?(?<project>.+?))?\??$/iu, /^what(?:'s|\s+is)\s+(?:blocking|holding\s+(?:up|back))\s+(?:this|the|that|our)\s+project\??$/iu, /^what(?:'s|\s+is)\s+blocking\s+(?:project\s+|the\s+)?(?<project>.+?)\??$/iu, /^why\s+(?:is|has)\s+(?:this|the|that|everything)(?:\s+project)?\s+(?:stalled|stuck|stopped|not\s+moving|not\s+progressing)\??$/iu, /^why\s+is\s+(?:project\s+)?(?<project>.+?)\s+(?:stalled|stuck|stopped)\??$/iu, /^(?:my|the)\s+blockers?\??$/iu], fr: [/^quels\s+blocages\s+(?:ai-je|avons-nous|y\s+a-t-il)(?:\s+(?:pour|sur)\s+(?:le\s+projet\s+)?(?<project>.+?))?\??$/iu, /^qu'est-ce\s+qui\s+bloque\s+(?:ce|le|notre)\s+projet\??$/iu, /^qu'est-ce\s+qui\s+bloque\s+(?:le\s+projet\s+)?(?<project>.+?)\??$/iu, /^pourquoi\s+(?:ce|le)\s+projet\s+(?:est-il\s+)?(?:bloqué|à\s+l'arrêt|n'avance\s+pas)\??$/iu] }, build: (m) => (m.groups?.project ? { project: stripLead(m.groups.project) } : {}) },
  { tool: 'project.decisions', confidence: 0.95, patterns: { nl: [/^wat\s+(?:hebben\s+we|is\s+er|werd\s+er|hadden\s+we)\s+(?:de\s+)?(?:vorige\s+(?:keer|meeting|vergadering)|laatste\s+(?:keer|meeting|vergadering)|gisteren|toen|in\s+de\s+(?:laatste|vorige)\s+(?:meeting|vergadering))\s+(?:beslist|besloten|afgesproken)\??$/iu, /^wat\s+(?:is|werd)\s+(?:er\s+)?(?:beslist|besloten|afgesproken)(?:\s+(?:in|tijdens)\s+de\s+(?:laatste|vorige)\s+(?:meeting|vergadering))?\??$/iu, /^welke\s+beslissingen\s+(?:hebben\s+we|zijn\s+er)\s+(?:genomen)?(?:\s+(?:voor|in|bij)\s+(?:project\s+)?(?<project>.+?))?\??$/iu, /^waarom\s+(?:hebben\s+we|is\s+er|werd\s+er)\s+(?:gekozen\s+voor|beslist\s+(?:om|voor)|besloten\s+(?:om|tot))\s+(?<query>.+?)\??$/iu], en: [/^what\s+(?:did\s+we|was|has\s+been|have\s+we)\s+(?:decide[d]?|agree[d]?)\s+(?:on\s+)?(?:last\s+(?:time|meeting)|in\s+the\s+last\s+meeting|yesterday|then)\??$/iu, /^what\s+(?:was|has\s+been)\s+decided(?:\s+(?:in|during)\s+the\s+last\s+meeting)?\??$/iu, /^(?:which|what)\s+decisions\s+(?:did\s+we|have\s+we|were)\s+(?:take[n]?|make|made)?(?:\s+(?:for|on|in)\s+(?:project\s+)?(?<project>.+?))?\??$/iu, /^why\s+did\s+we\s+(?:choose|decide\s+on|go\s+with|opt\s+for|pick|decide\s+to)\s+(?<query>.+?)\??$/iu], fr: [/^qu'(?:avons-nous|a-t-on)\s+décidé\s+(?:la\s+dernière\s+fois|lors\s+de\s+la\s+dernière\s+réunion|hier)\??$/iu, /^qu'est-ce\s+qui\s+a\s+été\s+décidé(?:\s+(?:lors\s+de|à)\s+la\s+dernière\s+réunion)?\??$/iu, /^quelles\s+décisions\s+(?:avons-nous|a-t-on)\s+prises(?:\s+(?:pour|sur)\s+(?:le\s+projet\s+)?(?<project>.+?))?\??$/iu, /^pourquoi\s+(?:avons-nous|a-t-on)\s+(?:choisi|opté\s+pour|décidé)\s+(?<query>.+?)\??$/iu] }, build: (m, c) => {
    const query = m.groups?.query ? clean(m.groups.query).replace(/^(?:een|het|de|a|an|the|un|une|le|la)\s+/i, '') : null;
    const lastMeeting = /\b(?:vorige|laatste|last|latest|dernière|derniere|gisteren|yesterday|hier|toen|then)\b/i.test(c.text) && !query;
    return { query, lastMeeting, project: m.groups?.project ? stripLead(m.groups.project) : null };
  } },
  { tool: 'meeting.actions', confidence: 0.95, patterns: { nl: [/^welke\s+(?:actiepunten|acties|actie-?items)\s+(?:kwamen|komen|zijn)\s+(?:er\s+)?uit\s+de\s+(?:laatste|vorige)\s+(?:meeting|vergadering|overleg)\??$/iu, /^(?:wat\s+zijn\s+de\s+)?(?:actiepunten|acties)\s+(?:van|uit)\s+de\s+(?:laatste|vorige)\s+(?:meeting|vergadering)\??$/iu], en: [/^(?:what|which)\s+(?:action\s+items|actions|action\s+points)\s+(?:came|come)\s+out\s+of\s+the\s+(?:last|latest)\s+meeting\??$/iu, /^(?:what\s+are\s+the\s+)?(?:action\s+items|actions)\s+(?:from|of)\s+the\s+(?:last|latest)\s+meeting\??$/iu], fr: [/^quels\s+(?:points\s+d'action|actions)\s+(?:sont\s+ressortis|ressortent|sortent)\s+de\s+la\s+dernière\s+réunion\??$/iu, /^(?:quelles\s+sont\s+les\s+)?actions\s+de\s+la\s+dernière\s+réunion\??$/iu] } },
  { tool: 'meeting.prepare', confidence: 0.95, patterns: { nl: [new RegExp(String.raw`^bereid\s+(?:mij|me)\s+(?:even\s+)?voor\s+(?:op|voor)\s+(?:de|mijn|het|m'n)\s+(?:meeting|vergadering|overleg|call|gesprek|afspraak|bespreking)(?:\s+met\s+(?<person>.+?)|\s+(?:van|over|voor|rond)\s+(?:project\s+|het\s+)?(?<project>.+?))?[.!?]?$`, 'iu'), new RegExp(String.raw`^(?:voorbereiding|briefing)\s+(?:voor|van)\s+(?:de\s+|mijn\s+)?(?:meeting|vergadering|call)\s+met\s+(?<person>.+?)[.!?]?$`, 'iu')], en: [new RegExp(String.raw`^(?:prepare|prep|brief)\s+me\s+for\s+(?:the|my)\s+(?:meeting|call|conversation|appointment|chat)(?:\s+with\s+(?<person>.+?)|\s+(?:on|about|for)\s+(?:project\s+|the\s+)?(?<project>.+?))?[.!?]?$`, 'iu'), new RegExp(String.raw`^(?:meeting\s+prep|briefing)\s+(?:for\s+(?:the\s+|my\s+)?meeting\s+)?with\s+(?<person>.+?)[.!?]?$`, 'iu')], fr: [new RegExp(String.raw`^prépare[- ]moi\s+(?:pour|à)\s+(?:la|ma)\s+(?:réunion|reunion|rencontre|call|conversation)(?:\s+avec\s+(?<person>.+?)|\s+(?:sur|pour|du)\s+(?:le\s+projet\s+|le\s+)?(?<project>.+?))?[.!?]?$`, 'iu')] }, build: (m) => ({ person: m.groups?.person ? clean(m.groups.person) : null, project: m.groups?.project ? stripLead(m.groups.project) : null }) },
  { tool: 'project.list', confidence: 0.94, patterns: { nl: [/^(?:welke\s+projecten\s+(?:heb\s+ik|lopen\s+er|zijn\s+(?:er\s+)?actief)|(?:toon\s+)?mijn\s+projecten|lijst\s+(?:van\s+)?(?:mijn\s+)?projecten)\??$/iu], en: [/^(?:(?:what|which)\s+projects\s+(?:do\s+i\s+have|are\s+active|are\s+running)|(?:show|list)\s+(?:me\s+)?my\s+projects|my\s+projects)\??$/iu], fr: [/^(?:quels\s+projets\s+(?:ai-je|sont\s+actifs)|(?:montre|liste)\s+mes\s+projets|mes\s+projets)\??$/iu] } },
  { tool: 'company.list', confidence: 0.94, patterns: { nl: [/^(?:welke\s+(?<kind>klanten|leveranciers)\s+heb\s+ik|(?:toon\s+)?mijn\s+(?<kind2>klanten|leveranciers)|lijst\s+(?:van\s+)?(?:mijn\s+)?(?<kind3>klanten|leveranciers))\??$/iu], en: [/^(?:(?:which|what)\s+(?<kind>clients|customers|suppliers)\s+do\s+i\s+have|(?:show|list)\s+(?:me\s+)?my\s+(?<kind2>clients|customers|suppliers)|my\s+(?<kind3>clients|customers|suppliers))\??$/iu], fr: [/^(?:quels\s+(?<kind>clients|fournisseurs)\s+ai-je|(?:montre|liste)\s+mes\s+(?<kind2>clients|fournisseurs)|mes\s+(?<kind3>clients|fournisseurs))\??$/iu] }, build: (m) => ({ kind: /leverancier|supplier|fournisseur/i.test(m.groups?.kind ?? m.groups?.kind2 ?? m.groups?.kind3 ?? '') ? 'supplier' : 'client' }) },

  // ---- Meeting processing --------------------------------------------------------
  { tool: 'meeting.extractActions', confidence: 0.95, patterns: { nl: [/^(?:verwerk\s+(?:dit|deze|die|de)(?:\s+(?:notities|meeting\s*notes|meetingnotities|notes|meeting))?|maak\s+(?:taken|actiepunten|acties)\s+(?:van|uit)\s+(?:deze|die|de)\s+(?:meeting\s*notes|notities|meetingnotities|meeting)|haal\s+(?:de\s+)?(?:acties|actiepunten|beslissingen|taken)\s+uit\s+(?:deze|die|de)\s+(?:notities|meeting|notes))\s*[:\-]?\s*(?<notes>[\s\S]*)$/iu], en: [/^(?:process\s+(?:this|these|the)(?:\s+(?:notes|meeting\s*notes|meeting))?|(?:make|create|extract)\s+(?:tasks|actions|action\s+items)\s+(?:from|out\s+of)\s+(?:these|this|the)\s+(?:meeting\s*notes|notes|meeting)|extract\s+(?:the\s+)?(?:actions|decisions|tasks)\s+from\s+(?:these|the)\s+notes)\s*[:\-]?\s*(?<notes>[\s\S]*)$/iu], fr: [/^(?:traite\s+(?:ça|ceci|cela|ces\s+notes)|(?:fais|crée)\s+des\s+tâches\s+(?:de|à\s+partir\s+de)\s+ces\s+notes|extrais\s+les\s+(?:actions|décisions)\s+de\s+ces\s+notes)\s*[:\-]?\s*(?<notes>[\s\S]*)$/iu] }, build: (m, c) => {
    const notes = (m.groups?.notes ?? '').trim();
    if (notes.length > 10) return { notes };
    if (hasFocus(c, 'meetingId')) return {};
    return { missing: 'notes', question: Q.notes[c.language], args: {} };
  } },
  { tool: 'meeting.debrief', confidence: 0.94, patterns: { nl: [new RegExp(String.raw`^(?:de\s+)?(?:meeting|vergadering|overleg|call|gesprek|afspraak)\s+met\s+${PERSON}(?:\s+(?:en|&)\s+${PERSON})*\s+(?:is|was)\s+(?:gedaan|klaar|afgelopen|voorbij|achter\s+de\s+rug|afgerond)\b[\s\S]*$`, 'iu')], en: [new RegExp(String.raw`^(?:the\s+)?(?:meeting|call|chat|conversation)\s+with\s+${PERSON}(?:\s+(?:and|&)\s+${PERSON})*\s+(?:is|was)\s+(?:done|over|finished|completed)\b[\s\S]*$`, 'iu')], fr: [new RegExp(String.raw`^(?:la\s+)?(?:réunion|reunion|rencontre|call|appel)\s+avec\s+${PERSON}(?:\s+(?:et|&)\s+${PERSON})*\s+(?:est|était)\s+(?:terminée?|finie?|faite?)\b[\s\S]*$`, 'iu')] }, build: (m) => ({ text: m[0] }) },

  // ---- Project records ------------------------------------------------------------
  { tool: 'project.addDecision', confidence: 0.93, patterns: { nl: [/^(?:noteer|onthoud|registreer|log)\s+(?:als\s+|de\s+|deze\s+)?beslissing\s*[:\-]?\s*(?<decision>.+)$/iu, /^beslissing\s*[:\-]\s*(?<decision>.+)$/iu, /^we\s+hebben\s+(?:beslist|besloten|afgesproken)\s+(?:om\s+|dat\s+)?(?<decision>.+)$/iu], en: [/^(?:record|note|log|remember)\s+(?:the\s+|a\s+|this\s+)?decision\s*[:\-]?\s*(?<decision>.+)$/iu, /^decision\s*[:\-]\s*(?<decision>.+)$/iu, /^we\s+(?:decided|agreed)\s+(?:to\s+|that\s+)?(?<decision>.+)$/iu], fr: [/^(?:note|enregistre)\s+(?:la\s+|une\s+|cette\s+)?décision\s*[:\-]?\s*(?<decision>.+)$/iu, /^décision\s*[:\-]\s*(?<decision>.+)$/iu, /^nous\s+avons\s+(?:décidé|convenu)\s+(?:de\s+|que\s+)?(?<decision>.+)$/iu] }, build: (m) => {
    const full = clean(m.groups?.decision);
    const reason = /\b(?:omdat|want|because|since|parce\s+que|car)\b\s+(.+)$/i.exec(full);
    return { decision: capitalizeFirst(reason ? full.slice(0, reason.index).trim() : full), reason: reason?.[1] ? capitalizeFirst(reason[1]) : null };
  } },
  { tool: 'project.addBlocker', confidence: 0.92, patterns: { nl: [/^(?:noteer|registreer|voeg\s+toe)\s+(?:als\s+|een\s+)?blocker\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?:dit|het|dat|project\s+\w+|we)\s+(?:is|zit|zitten|zijn)\s+(?:geblokkeerd|vast)\s+(?:door|op|omdat|want|wegens)\s+(?<desc>.+)$/iu, /^ik\s+wacht\s+(?:nog\s+)?op\s+(?<desc>(?:toegang|een\s+beslissing|goedkeuring|de\s+klant|input|feedback)[^.!?]*)$/iu], en: [/^(?:add|record|note)\s+(?:a\s+)?blocker\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?:this|it|we|the\s+project)\s+(?:is|are)\s+(?:blocked|stuck)\s+(?:by|on|because|due\s+to)\s+(?<desc>.+)$/iu, /^(?:i(?:'m|\s+am)\s+)?(?:still\s+)?waiting\s+(?:for|on)\s+(?<desc>(?:access|a\s+decision|approval|the\s+client|input|feedback)[^.!?]*)$/iu], fr: [/^(?:ajoute|note)\s+(?:un\s+)?blocage\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?:c'est|ça\s+c'est|nous\s+sommes|on\s+est)\s+bloqué(?:s)?\s+(?:par|sur|parce\s+que|à\s+cause\s+de)\s+(?<desc>.+)$/iu] }, build: (m) => {
    const desc = capitalizeFirst(clean(m.groups?.desc));
    const kind = /toegang|access|accès/i.test(desc) ? 'waiting_access' : /beslissing|decision|décision/i.test(desc) ? 'waiting_decision' : /klant|client|customer/i.test(desc) ? 'waiting_client' : /technisch|technical|technique|bug/i.test(desc) ? 'technical' : /vereisten|requirements|exigences/i.test(desc) ? 'missing_requirements' : 'other';
    const who = new RegExp(String.raw`\b(?:van|from|de)\s+(${PERSON})`, 'u').exec(desc)?.[1] ?? null;
    return { description: desc, kind, who };
  } },
  { tool: 'project.addRisk', confidence: 0.72, patterns: { nl: [/^(?:noteer|registreer|voeg\s+toe)\s+(?:als\s+|een\s+)?risico\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?<desc>[^.!?]*\b(?:kan|kunnen|zou|zouden|dreigt|dreigen)\b[^.!?]*\b(?:blokkeren|vertragen|in\s+gevaar\s+brengen|in\s+het\s+gedrang\s+brengen|onderuit\s+halen)\b[^.!?]*)[.!]?$/iu], en: [/^(?:add|record|note|log)\s+(?:a\s+)?risk\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?<desc>[^.!?]*\b(?:could|might|may|will|threatens\s+to|is\s+likely\s+to)\b[^.!?]*\b(?:block|delay|jeopardi[sz]e|derail|put\s+[^.!?]*\s+at\s+risk|slip)\b[^.!?]*)[.!]?$/iu], fr: [/^(?:ajoute|note|enregistre)\s+(?:un\s+)?risque\s*[:\-]?\s*(?<desc>.+)$/iu, /^(?<desc>[^.!?]*\b(?:risque\s+de|pourrait|peut|menace\s+de)\b[^.!?]*\b(?:bloquer|retarder|compromettre|mettre\s+en\s+péril)\b[^.!?]*)[.!]?$/iu] }, build: (m, c) => {
    const desc = capitalizeFirst(clean(m.groups?.desc));
    if (!desc || desc.split(' ').length < 3) return null;
    const explicit = /^(?:noteer|registreer|voeg|add|record|note|log|ajoute|enregistre)/i.test(c.text);
    return { description: desc, impact: /\b(?:ernstig|zwaar|groot|serious|major|severe|high|grave|majeur)\b/i.test(desc) ? 'high' : 'medium', ...(explicit ? { __confidence: 0.93 } : {}) };
  } },
  { tool: 'project.create', confidence: 0.94, patterns: { nl: [/^(?:maak|start|begin)\s+(?:een\s+)?(?:nieuw\s+)?project\s+(?:aan\s+)?(?:met\s+(?:de\s+)?naam\s+|genaamd\s+|voor\s+)?(?<name>.+?)(?:\s+voor\s+(?:klant\s+)?(?<client>.+?))?[.!]?$/iu, /^nieuw\s+project\s*[:\-]?\s*(?<name>.+?)(?:\s+voor\s+(?:klant\s+)?(?<client>.+?))?[.!]?$/iu], en: [/^(?:create|start|make|set\s+up)\s+(?:a\s+)?(?:new\s+)?project\s+(?:called\s+|named\s+|for\s+)?(?<name>.+?)(?:\s+for\s+(?:client\s+)?(?<client>.+?))?[.!]?$/iu, /^new\s+project\s*[:\-]?\s*(?<name>.+?)(?:\s+for\s+(?:client\s+)?(?<client>.+?))?[.!]?$/iu], fr: [/^(?:crée|cree|créer|démarre|demarre|lance)\s+(?:un\s+)?(?:nouveau\s+)?projet\s+(?:appelé\s+|nommé\s+|pour\s+)?(?<name>.+?)(?:\s+pour\s+(?:le\s+client\s+)?(?<client>.+?))?[.!]?$/iu, /^nouveau\s+projet\s*[:\-]?\s*(?<name>.+?)(?:\s+pour\s+(?:le\s+client\s+)?(?<client>.+?))?[.!]?$/iu] }, build: (m) => ({ name: clean(m.groups?.name), client: m.groups?.client ? stripLead(m.groups.client) : null }) },
  { tool: 'company.create', confidence: 0.94, patterns: { nl: [/^(?:maak|voeg)\s+(?:een\s+)?(?:nieuwe\s+)?(?<kind>klant|leverancier)\s+(?:aan|toe)\s*[:\-]?\s*(?:met\s+(?:de\s+)?naam\s+|genaamd\s+)?(?<name>.+?)(?:\s+toe)?[.!]?$/iu, /^nieuwe\s+(?<kind>klant|leverancier)\s*[:\-]?\s*(?<name>.+?)[.!]?$/iu], en: [/^(?:create|add)\s+(?:a\s+)?(?:new\s+)?(?<kind>client|customer|supplier)\s*[:\-]?\s*(?:called\s+|named\s+)?(?<name>.+?)[.!]?$/iu, /^new\s+(?<kind>client|customer|supplier)\s*[:\-]?\s*(?<name>.+?)[.!]?$/iu], fr: [/^(?:crée|cree|ajoute)\s+(?:un\s+)?(?:nouveau\s+)?(?<kind>client|fournisseur)\s*[:\-]?\s*(?:appelé\s+|nommé\s+)?(?<name>.+?)[.!]?$/iu, /^nouveau\s+(?<kind>client|fournisseur)\s*[:\-]?\s*(?<name>.+?)[.!]?$/iu] }, build: (m) => ({ name: clean(m.groups?.name), kind: /leverancier|supplier|fournisseur/i.test(m.groups?.kind ?? '') ? 'supplier' : 'client' }) },

  // ---- Styles, profile, workflows, recurring ----------------------------------------
  { tool: 'style.set', confidence: 0.93, patterns: { nl: [/^(?:antwoord|schrijf|mail)\s+(?:naar\s+)?(?<audience>recruiters?|klanten|collega'?s|leveranciers)\s+(?:altijd\s+|voortaan\s+|steeds\s+)?(?<style>.+?)[.!]?$/iu, /^(?:onthoud|voortaan|regel)\s*[:\-]?\s*(?<audience>recruiters?|klanten|collega'?s|leveranciers)\s*[:\-]?\s*(?<style>.+?)[.!]?$/iu, /^(?:schrijf|antwoord)\s+(?:altijd|voortaan|standaard)\s+(?<style>professioneel|formeel|informeel|vriendelijk|kort|direct)[.!]?$/iu], en: [/^(?:always\s+|from\s+now\s+on\s+)?(?:reply|write|answer|respond)\s+(?:to\s+)?(?<audience>recruiters?|clients|customers|colleagues|suppliers)\s+(?:always\s+)?(?<style>.+?)[.!]?$/iu, /^(?:remember|from\s+now\s+on|rule)\s*[:\-]?\s*(?<audience>recruiters?|clients|customers|colleagues|suppliers)\s*[:\-]?\s*(?<style>.+?)[.!]?$/iu, /^(?:always|by\s+default)\s+(?:write|reply)\s+(?<style>professionally|formally|informally|friendly|concisely|directly|briefly)[.!]?$/iu], fr: [/^(?:réponds|reponds|écris|ecris)\s+(?:toujours\s+|désormais\s+)?aux\s+(?<audience>recruteurs|clients|collègues|collegues|fournisseurs)\s+(?:de\s+(?:manière|façon)\s+)?(?<style>.+?)[.!]?$/iu, /^(?:retiens|désormais)\s*[:\-]?\s*(?<audience>recruteurs|clients|collègues|fournisseurs)\s*[:\-]?\s*(?<style>.+?)[.!]?$/iu] }, build: (m) => {
    const styleText = m.groups?.style ?? '';
    const style = STYLE_WORDS.find((s) => s.re.test(styleText))?.style ?? null;
    if (!style) return null;
    const audience = m.groups?.audience ? audienceOf(m.groups.audience) : null;
    return { style, audience };
  } },
  { tool: 'profile.get', confidence: 0.94, patterns: { nl: [/^(?:toon\s+(?:mij\s+)?)?(?:mijn\s+)?(?:bedrijfsprofiel|bedrijfsgegevens|factuurgegevens|profiel\s+van\s+mijn\s+bedrijf)\??$/iu], en: [/^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:business\s+profile|company\s+profile|invoicing\s+details|company\s+details)\??$/iu], fr: [/^(?:montre\s+)?(?:mon\s+)?(?:profil\s+d'entreprise|profil\s+entreprise|coordonnées\s+de\s+facturation)\??$/iu] } },
  { tool: 'profile.update', confidence: 0.93, patterns: { nl: [/^mijn\s+(?<field>btw-?nummer|iban|ondernemingsnummer|bedrijfsnaam|dagtarief|uurtarief|e-?mail|telefoon(?:nummer)?)\s+is\s+(?<value>.+?)[.!]?$/iu], en: [/^my\s+(?<field>vat\s+number|iban|company\s+number|company\s+name|business\s+name|day\s+rate|hourly\s+rate|e-?mail|phone(?:\s+number)?)\s+is\s+(?<value>.+?)[.!]?$/iu], fr: [/^mon\s+(?<field>numéro\s+de\s+tva|numero\s+de\s+tva|iban|numéro\s+d'entreprise|nom\s+d'entreprise|tarif\s+journalier|tarif\s+horaire|e-?mail|téléphone|telephone)\s+est\s+(?<value>.+?)[.!]?$/iu] }, build: (m) => {
    const field = (m.groups?.field ?? '').toLowerCase();
    const value = clean(m.groups?.value);
    if (/btw|vat|tva/.test(field)) return { vatNumber: value };
    if (/iban/.test(field)) return { iban: value };
    if (/ondernemingsnummer|company\s+number|d'entreprise$/.test(field) && !/nom|name/.test(field)) return { companyNumber: value };
    if (/bedrijfsnaam|company\s+name|business\s+name|nom/.test(field)) return { companyName: value };
    if (/dagtarief|day\s+rate|journalier/.test(field)) return { defaultDayRateCents: parseAmountToCents(value)?.cents ?? null };
    if (/uurtarief|hourly|horaire/.test(field)) return { defaultHourRateCents: parseAmountToCents(value)?.cents ?? null };
    if (/mail/.test(field)) return { email: value };
    if (/telefoon|phone|téléphone|telephone/.test(field)) return { phone: value };
    return null;
  } },
  { tool: 'workflow.list', confidence: 0.94, patterns: { nl: [/^(?:welke\s+)?(?:automatiseringen|workflows|automatische\s+regels)(?:\s+heb\s+ik)?\??$/iu], en: [/^(?:(?:which|what)\s+)?(?:automations|workflows|automatic\s+rules)(?:\s+do\s+i\s+have)?\??$/iu], fr: [/^(?:quelles\s+)?(?:automatisations|workflows|règles\s+automatiques)(?:\s+ai-je)?\??$/iu] } },

  // ---- Alfred operations (§141–§181): tickets, approvals, briefings, quotes, CRM, home, health ----
  { tool: 'ticket.create', confidence: 0.93, patterns: { nl: [/^(?:maak|open)\s+(?:een\s+)?(?:nieuw\s+)?ticket(?:\s+(?:voor|om))?[:\s]+(?<text>.+)$/iu, /^(?:zet|plaats)\s+(?:dit\s+)?in\s+de\s+wachtrij[:\s]+(?<text>.+)$/iu, /^(?:laat|vraag)\s+alfred\s+(?:om\s+)?(?<text>.+)$/iu], en: [/^(?:create|open|make)\s+(?:a\s+)?(?:new\s+)?ticket(?:\s+(?:for|to))?[:\s]+(?<text>.+)$/iu, /^queue(?:\s+up)?[:\s]+(?<text>.+)$/iu, /^(?:have|let|ask|tell)\s+alfred\s+(?:to\s+)?(?<text>.+)$/iu], fr: [/^(?:crée|créer|ouvre|ouvrir)\s+(?:un\s+)?(?:nouveau\s+)?ticket(?:\s+pour)?[:\s]+(?<text>.+)$/iu, /^(?:demande|dis)\s+à\s+alfred\s+(?:de\s+)?(?<text>.+)$/iu] }, build: (m) => ({ text: clean(m.groups?.text) }) },
  { tool: 'ticket.list', confidence: 0.94, patterns: { nl: [/^(?:wat\s+(?:staat|zit)\s+(?:er\s+)?in\s+de\s+wachtrij|toon\s+(?:mij\s+|me\s+)?(?:de\s+)?(?:tickets|wachtrij)|welke\s+tickets\s+(?:staan|zijn)\s+(?:er\s+)?(?:nog\s+)?open|waar\s+is\s+alfred\s+mee\s+bezig|wat\s+doet\s+alfred(?:\s+nu)?|mission\s*control)\??$/iu], en: [/^(?:what(?:'s|\s+is)\s+in\s+the\s+queue|show\s+(?:me\s+)?(?:the\s+)?(?:tickets|queue)|(?:which|what)\s+tickets\s+are\s+(?:still\s+)?open|what\s+is\s+alfred\s+(?:doing|working\s+on)(?:\s+now)?|mission\s*control)\??$/iu], fr: [/^(?:qu'y\s+a-t-il\s+dans\s+la\s+file|montre(?:-moi)?\s+(?:les\s+)?tickets|que\s+fait\s+alfred|mission\s*control)\s*\??$/iu] }, build: (_m, c) => ({ view: /bezig|doing|working|fait\s+alfred/iu.test(c.text) ? 'working' : 'open' }) },
  { tool: 'approval.list', confidence: 0.95, patterns: { nl: [/^(?:wat\s+wacht\s+(?:er\s+)?op\s+(?:mijn\s+)?goedkeuring|toon\s+(?:mij\s+|me\s+)?(?:de\s+)?goedkeuringen|(?:welke\s+|openstaande\s+)?goedkeuringen)\??$/iu], en: [/^(?:what(?:'s|\s+is)\s+waiting\s+for\s+(?:my\s+)?approval|show\s+(?:me\s+)?(?:the\s+)?approvals|pending\s+approvals|approvals)\??$/iu], fr: [/^(?:qu'est-ce\s+qui\s+attend\s+(?:mon\s+)?approbation|montre(?:-moi)?\s+les\s+approbations|approbations(?:\s+en\s+attente)?)\s*\??$/iu] } },
  { tool: 'briefing.show', confidence: 0.95, patterns: { nl: [/^(?:(?:geef|toon)\s+(?:mij\s+|me\s+)?(?:de\s+|mijn\s+)?)?(?:ochtend)?briefing(?:\s+van\s+vandaag)?\??$/iu, /^(?:(?:geef|toon)\s+(?:mij\s+|me\s+)?(?:het\s+|mijn\s+)?)?(?:avondoverzicht|avondbriefing)\??$/iu], en: [/^(?:(?:give|show)\s+(?:me\s+)?(?:the\s+|my\s+)?)?(?:morning\s+)?briefing(?:\s+for\s+today)?\??$/iu, /^(?:(?:give|show)\s+(?:me\s+)?(?:the\s+|my\s+)?)?evening\s+review\??$/iu], fr: [/^(?:(?:donne|montre)(?:-moi)?\s+(?:le\s+|mon\s+)?)?briefing(?:\s+du\s+matin)?\s*\??$/iu, /^(?:(?:donne|montre)(?:-moi)?\s+(?:le\s+|mon\s+)?)?bilan\s+du\s+soir\s*\??$/iu] }, build: (_m, c) => ({ kind: /avond|evening|soir/iu.test(c.text) ? 'evening' : 'morning' }) },
  { tool: 'automation.list', confidence: 0.93, patterns: { nl: [/^(?:welke\s+)?(?:planningen|geplande\s+taken|schema'?s)(?:\s+heb\s+ik)?\??$/iu], en: [/^(?:(?:which|what)\s+)?(?:schedules|scheduled\s+automations)(?:\s+do\s+i\s+have)?\??$/iu], fr: [/^(?:quelles\s+)?planifications(?:\s+ai-je)?\s*\??$/iu] } },
  { tool: 'quote.create', confidence: 0.92, patterns: { nl: [new RegExp(String.raw`^(?:maak|stel|bereid)\s+(?:een\s+)?offerte\s+(?:op\s+)?voor\s+(?<client>${NAME})\s*[:,]\s*(?<lines>.+)$`, 'iu'), new RegExp(String.raw`^(?:maak|stel|bereid)\s+(?:een\s+)?offerte\s+(?:op\s+)?voor\s+(?<client>${NAME})\s+(?:voor|van)\s+(?<lines>\d.+)$`, 'iu')], en: [new RegExp(String.raw`^(?:create|make|draft|prepare)\s+(?:a\s+)?(?:quote|quotation)\s+for\s+(?<client>${NAME})\s*[:,]\s*(?<lines>.+)$`, 'iu'), new RegExp(String.raw`^(?:create|make|draft|prepare)\s+(?:a\s+)?(?:quote|quotation)\s+for\s+(?<client>${NAME})\s+for\s+(?<lines>\d.+)$`, 'iu')], fr: [new RegExp(String.raw`^(?:fais|crée|prépare)\s+(?:un\s+)?devis\s+pour\s+(?<client>${NAME})\s*[:,]\s*(?<lines>.+)$`, 'iu'), new RegExp(String.raw`^(?:fais|crée|prépare)\s+(?:un\s+)?devis\s+pour\s+(?<client>${NAME})\s+pour\s+(?<lines>\d.+)$`, 'iu')] }, build: (m, c) => {
    const client = stripLead(m.groups?.client ?? '');
    const lines = parseInvoiceLines(m.groups?.lines ?? '');
    if (!client) return null;
    if (!lines.length) return { missing: 'lines', question: Q.lines[c.language], args: { client } };
    return { client, lines };
  } },
  { tool: 'quote.list', confidence: 0.94, patterns: { nl: [/^(?:welke\s+offertes\s+(?:staan|zijn)\s+(?:er\s+)?(?:nog\s+)?open|toon\s+(?:mij\s+|me\s+)?(?:de\s+|mijn\s+)?offertes|(?:open(?:staande)?\s+)?offertes)\??$/iu], en: [/^(?:which\s+quotes\s+are\s+(?:still\s+)?open|show\s+(?:me\s+)?(?:the\s+|my\s+)?quotes|open\s+quotes|quotes)\??$/iu], fr: [/^(?:quels\s+devis\s+sont\s+(?:encore\s+)?ouverts|montre(?:-moi)?\s+(?:les\s+|mes\s+)?devis|devis\s+ouverts)\s*\??$/iu] } },
  { tool: 'quote.send', confidence: 0.95, patterns: { nl: [/^(?:verstuur|stuur|verzend)\s+(?:de\s+|die\s+)?offerte(?:\s+(?:voor|aan|naar|van)\s+(?<query>.+))?$/iu], en: [/^send\s+(?:the\s+|that\s+)?(?:quote|quotation)(?:\s+(?:for|to)\s+(?<query>.+))?$/iu], fr: [/^envoie\s+(?:le\s+)?devis(?:\s+(?:pour|à|de)\s+(?<query>.+))?$/iu] }, build: (m) => ({ query: m.groups?.query ? stripLead(m.groups.query) : null }) },
  { tool: 'quote.accept', confidence: 0.93, patterns: { nl: [/^(?:de\s+)?offerte(?:\s+(?:voor|van)\s+(?<query>.+?))?\s+is\s+(?:aanvaard|goedgekeurd|getekend|akkoord)$/iu], en: [/^(?:the\s+)?(?:quote|quotation)(?:\s+(?:for|from)\s+(?<query>.+?))?\s+(?:was|is|got)\s+(?:accepted|approved|signed)$/iu], fr: [/^(?:le\s+)?devis(?:\s+(?:pour|de)\s+(?<query>.+?))?\s+(?:a\s+été|est)\s+(?:accepté|signé|approuvé)$/iu] }, build: (m) => ({ query: m.groups?.query ? stripLead(m.groups.query) : null }) },
  { tool: 'quote.reject', confidence: 0.93, patterns: { nl: [/^(?:de\s+)?offerte(?:\s+(?:voor|van)\s+(?<query>.+?))?\s+is\s+(?:afgewezen|geweigerd|niet\s+aanvaard)$/iu], en: [/^(?:the\s+)?(?:quote|quotation)(?:\s+(?:for|from)\s+(?<query>.+?))?\s+(?:was|is|got)\s+(?:rejected|declined|turned\s+down)$/iu], fr: [/^(?:le\s+)?devis(?:\s+(?:pour|de)\s+(?<query>.+?))?\s+(?:a\s+été|est)\s+(?:refusé|rejeté)$/iu] }, build: (m) => ({ query: m.groups?.query ? stripLead(m.groups.query) : null }) },
  { tool: 'crm.timeline', confidence: 0.93, patterns: { nl: [new RegExp(String.raw`^(?:wat\s+is\s+(?:de\s+)?(?:historiek|geschiedenis|contacthistoriek)\s+(?:met|van)|toon\s+(?:mij\s+|me\s+)?(?:de\s+)?(?:historiek|tijdlijn|contacthistoriek)\s+(?:met|van))\s+(?<client>${NAME})\??$`, 'iu')], en: [new RegExp(String.raw`^(?:what(?:'s|\s+is)\s+(?:the\s+|my\s+)?history\s+with|show\s+(?:me\s+)?(?:the\s+)?(?:history|timeline)\s+(?:with|for|of))\s+(?<client>${NAME})\??$`, 'iu')], fr: [new RegExp(String.raw`^(?:quel\s+est\s+l'historique\s+avec|montre(?:-moi)?\s+l'historique\s+(?:avec|de))\s+(?<client>${NAME})\s*\??$`, 'iu')] }, build: (m) => ({ client: stripLead(m.groups?.client ?? '') }) },
  { tool: 'crm.logInteraction', confidence: 0.9, patterns: { nl: [new RegExp(String.raw`^(?:noteer|log)\s+(?:een\s+)?(?<kind>gesprek|telefoontje|call|meeting|vergadering|notitie)\s+met\s+(?<client>${NAME})\s*[:,]\s*(?<summary>.+)$`, 'iu')], en: [new RegExp(String.raw`^log\s+(?:a\s+)?(?<kind>call|meeting|note)\s+with\s+(?<client>${NAME})\s*[:,]\s*(?<summary>.+)$`, 'iu')], fr: [new RegExp(String.raw`^(?:note|enregistre)\s+(?:un\s+|une\s+)?(?<kind>appel|réunion|reunion|note)\s+avec\s+(?<client>${NAME})\s*[:,]\s*(?<summary>.+)$`, 'iu')] }, build: (m) => {
    const k = (m.groups?.kind ?? '').toLowerCase();
    const kind = /meeting|vergadering|réunion|reunion/.test(k) ? 'meeting' : /notitie|note/.test(k) ? 'note' : 'call';
    return { client: stripLead(m.groups?.client ?? ''), kind, summary: clean(m.groups?.summary) };
  } },
  { tool: 'advisory.ask', confidence: 0.94, patterns: { nl: [/^(?:vraag\s+(?:het\s+)?(?:aan\s+)?(?:de\s+)?adviesraad|roep\s+de\s+adviesraad\s+(?:samen|bijeen)|adviesraad)[:,]?\s+(?<question>.+)$/iu], en: [/^(?:ask\s+the\s+(?:advisory\s+)?board|convene\s+the\s+(?:advisory\s+)?board|advisory\s+board)[:,]?\s+(?<question>.+)$/iu], fr: [/^(?:demande\s+au\s+conseil|réunis\s+le\s+conseil|conseil\s+consultatif)[:,]?\s+(?<question>.+)$/iu] }, build: (m) => ({ question: clean(m.groups?.question) }) },
  { tool: 'home.devices', confidence: 0.93, patterns: { nl: [/^(?:welke\s+(?:toestellen|apparaten)\s+(?:zijn\s+er|heb\s+ik|zijn\s+(?:er\s+)?verbonden)|toon\s+(?:mij\s+|me\s+)?(?:de\s+)?(?:toestellen|apparaten|domotica))\??$/iu], en: [/^(?:(?:which|what)\s+devices\s+(?:are\s+(?:there|connected)|do\s+i\s+have)|show\s+(?:me\s+)?(?:the\s+)?devices|list\s+devices)\??$/iu], fr: [/^(?:quels\s+appareils\s+(?:sont\s+connectés|y\s+a-t-il)|montre(?:-moi)?\s+les\s+appareils)\s*\??$/iu] } },
  { tool: 'home.run', confidence: 0.9, patterns: { nl: [/^(?!.*\b(?:wekker|alarm|timer|herinnering|notificatie)\b)(?:zet|schakel|doe)\s+(?<device>.+?)\s+(?<state>aan|uit)$/iu, /^(?<lock>vergrendel|ontgrendel)\s+(?<device>.+)$/iu], en: [/^(?!.*\b(?:alarm|timer|reminder|notification)\b)(?:turn|switch)\s+(?<device>.+?)\s+(?<state>on|off)$/iu, /^(?!.*\b(?:alarm|timer|reminder|notification)\b)(?:turn|switch)\s+(?<state>on|off)\s+(?<device>.+)$/iu, /^(?<lock>lock|unlock)\s+(?<device>.+)$/iu], fr: [/^(?!.*\b(?:réveil|alarme|minuteur|rappel)\b)(?<fr>allume|éteins)\s+(?<device>.+)$/iu, /^(?<lock>verrouille|déverrouille)\s+(?<device>.+)$/iu] }, build: (m) => {
    const g = m.groups ?? {};
    const device = stripLead(g.device ?? '');
    if (!device) return null;
    if (g.lock) return { device, service: /^(?:ontgrendel|unlock|déverrouille)$/iu.test(g.lock) ? 'unlock' : 'lock' };
    if (g.fr) return { device, service: /^allume$/iu.test(g.fr) ? 'turn_on' : 'turn_off' };
    return { device, service: /^(?:aan|on)$/iu.test(g.state ?? '') ? 'turn_on' : 'turn_off' };
  } },
  { tool: 'system.health', confidence: 0.94, patterns: { nl: [/^(?:(?:hoe\s+)?(?:gaat|draait|staat)\s+het\s+(?:met\s+)?(?:het\s+)?systeem|systeemstatus|system\s*health|draait\s+alfred(?:\s+nog)?|is\s+alfred\s+actief)\??$/iu], en: [/^(?:system\s+(?:health|status)|is\s+alfred\s+(?:running|up|active)|how\s+is\s+the\s+system(?:\s+doing)?)\??$/iu], fr: [/^(?:état\s+du\s+système|alfred\s+tourne(?:-t-il)?|statut\s+du\s+système)\s*\??$/iu] } },
  // "Alfred, maak vannacht een overzicht van alles wat nog openstaat voor mijn projecten" → the project review (the night shift schedules it).
  { tool: 'admin.weeklyReview', confidence: 0.93, patterns: { nl: [/^(?:alfred[,:]?\s+)?(?:maak|geef|bereid|stel)\s+(?:(?:mij|me)\s+)?(?:vannacht|vanavond|morgenochtend|morgen|straks|nu)?\s*(?:(?:mij|me)\s+)?(?:een\s+)?overzicht\s+(?:op\s+)?van\s+(?:alles\s+wat|wat)\s+(?:er\s+)?nog\s+open\s?staat(?:\s+(?:voor|van|over|in|bij)\s+(?:al\s+)?(?:mijn\s+|de\s+)?projecten)?[.!]?$/iu], en: [/^(?:alfred[,:]?\s+)?(?:make|give|prepare|build)\s+(?:me\s+)?(?:tonight|this\s+evening|tomorrow\s+morning|tomorrow|later)?\s*(?:me\s+)?(?:an?\s+)?overview\s+of\s+(?:everything\s+that(?:'s|\s+is)|what(?:'s|\s+is))\s+still\s+open(?:\s+(?:for|on|across|in)\s+(?:all\s+)?(?:my\s+)?projects)?[.!]?$/iu], fr: [/^(?:alfred[,:]?\s+)?(?:fais|prépare|donne)(?:-moi)?\s+(?:cette\s+nuit|ce\s+soir|demain)?\s*(?:un\s+)?aperçu\s+de\s+tout\s+ce\s+qui\s+(?:est\s+)?encore\s+ouvert(?:\s+(?:pour|sur|dans)\s+(?:mes\s+)?projets)?[.!]?$/iu] } },
];

export function buildToolCommand(params: { tool: string; args: Args; language: Language; originalText: string; confidence: number; parser: Command['parser']; missing?: { field: string; question: string } | null }): CommandOf<'BUTLER_TOOL'> | null {
  const definition = getTool(params.tool);
  if (!definition) return null;
  const parsed = definition.schema.safeParse(params.args);
  if (!parsed.success) return null;
  const preview = definition.describe(parsed.data, params.language);
  const missing = params.missing ?? null;
  return {
    id: newId(),
    intent: 'BUTLER_TOOL',
    confidence: params.confidence,
    language: params.language,
    originalText: params.originalText,
    requiresConfirmation: definition.permission !== 'read',
    missingFields: missing ? [missing.field] : [],
    clarificationQuestion: missing ? missing.question : null,
    parser: params.parser,
    warnings: [],
    tool: definition.name,
    args: parsed.data as Record<string, unknown>,
    permission: definition.permission,
    preview,
  };
}

export class AdminParser {
  constructor(private readonly resolver: DateResolver = dateResolver) {}

  parse(input: AdminParseInput): CommandBatch | null {
    // French typography puts a space before "?" / "!"; fold it, and drop a sentence-final period so the patterns stay simple.
    const text = collapseWhitespace(input.text.normalize('NFC').replace(/[‘’ʼ`´]/g, "'"))
      .replace(/\s+([?!.])$/, '$1')
      .replace(/(?<=[^.\s])\.$/, '');
    if (!text) return null;
    // Recurring requests addressed to Alfred ("elke maandag om 9u: geef me de open facturen") become automations (§163);
    // recurring *tasks for the user* keep going to the existing recurring-task parser below.
    const automation = parseAutomationText(text, input.language, input.now, input.timezone);
    if (automation && ALFRED_ACTION.test(automation.action)) {
      const command = buildToolCommand({ tool: 'automation.create', args: { text }, language: input.language, originalText: text, confidence: 0.9, parser: 'deterministic' });
      if (command) return this.batch([command], input, text);
    }
    const workflowBatch = this.parseWorkflow(text, input);
    if (workflowBatch) return workflowBatch;
    const ctx: BuildContext = { language: input.language, now: input.now, timezone: input.timezone, focus: input.focus, text, resolver: this.resolver };
    for (const rule of RULES) {
      for (const pattern of rule.patterns[input.language] ?? []) {
        const m = pattern.exec(text);
        if (!m) continue;
        const built = rule.build ? rule.build(m, ctx) : {};
        if (built === null) continue;
        let args: Args;
        let missing: { field: string; question: string } | null = null;
        let confidence = rule.confidence ?? 0.92;
        if ('missing' in built && typeof built.missing === 'string' && 'question' in built) {
          args = (built as Missing).args;
          missing = { field: (built as Missing).missing, question: (built as Missing).question };
        } else {
          args = built as Args;
        }
        if (typeof args.__confidence === 'number') {
          confidence = args.__confidence;
          delete args.__confidence;
        }
        const command = missing ? this.incomplete(rule.tool, args, missing, input, text, confidence) : buildToolCommand({ tool: rule.tool, args, language: input.language, originalText: text, confidence, parser: 'deterministic' });
        if (!command) continue;
        return this.batch([command], input, text);
      }
    }
    return null;
  }

  /** Completes a pending BUTLER_TOOL clarification with the user's answer. */
  complete(pending: CommandOf<'BUTLER_TOOL'>, answer: string, input: AdminParseInput): CommandBatch | null {
    const field = pending.missingFields[0];
    const text = collapseWhitespace(answer);
    if (!field || !text) return null;
    const args: Args = { ...pending.args };
    switch (field) {
      case 'lines': {
        const lines = parseInvoiceLines(text);
        if (lines.length === 0) return null;
        args.lines = lines;
        break;
      }
      case 'notes':
        args.notes = text;
        break;
      case 'instruction':
        args.instruction = /^(?:dat|that|que)\s/i.test(text) ? text : `${{ nl: 'dat', en: 'that', fr: 'que' }[input.language]} ${text}`;
        break;
      case 'project':
        args.project = stripLead(text);
        break;
      default:
        args[field] = text;
        break;
    }
    const command = buildToolCommand({ tool: pending.tool, args, language: input.language, originalText: `${pending.originalText} → ${text}`, confidence: pending.confidence, parser: 'context' });
    if (!command) return null;
    return this.batch([command], input, `${pending.originalText} → ${text}`);
  }

  private incomplete(tool: ToolName, args: Args, missing: { field: string; question: string }, input: AdminParseInput, text: string, confidence: number): CommandOf<'BUTLER_TOOL'> | null {
    const definition = getTool(tool);
    if (!definition) return null;
    const preview = (() => {
      try {
        return definition.describe(args, input.language);
      } catch {
        return { label: 'Butler', title: tool, lines: [] };
      }
    })();
    return {
      id: newId(),
      intent: 'BUTLER_TOOL',
      confidence,
      language: input.language,
      originalText: text,
      requiresConfirmation: true,
      missingFields: [missing.field],
      clarificationQuestion: missing.question,
      parser: 'deterministic',
      warnings: [],
      tool,
      args,
      permission: definition.permission,
      preview,
    };
  }

  private parseWorkflow(text: string, input: AdminParseInput): CommandBatch | null {
    const workflow = parseWorkflowText(text, input.language);
    if (workflow) {
      const command = buildToolCommand({ tool: 'workflow.create', args: { name: workflow.name, description: workflow.description, trigger: workflow.trigger, conditions: workflow.conditions, steps: workflow.steps, sourceText: workflow.sourceText }, language: input.language, originalText: text, confidence: 0.95, parser: 'deterministic' });
      return command ? this.batch([command], input, text) : null;
    }
    const recurring = parseRecurringText(text, input.language, input.now, input.timezone);
    if (recurring) {
      const command = buildToolCommand({ tool: 'admin.recurring', args: { title: recurring.title, schedule: recurring.schedule, firstDate: recurring.firstDate, recurrence: recurring.recurrence }, language: input.language, originalText: text, confidence: 0.93, parser: 'deterministic' });
      return command ? this.batch([command], input, text) : null;
    }
    return null;
  }

  private batch(commands: Command[], input: AdminParseInput, text: string): CommandBatch {
    return { id: newId(), commands, originalText: text, transcript: input.transcript ?? null, language: input.language, source: input.source, createdAt: input.now.toISO() ?? new Date().toISOString() };
  }
}

export const adminParser = new AdminParser();

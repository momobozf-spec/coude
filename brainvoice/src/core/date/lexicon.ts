import type { DayPart, Language } from '../types/common';

/**
 * Per-language vocabulary for the DateResolver.
 * Adding a language (e.g. Arabic) means adding a Lexicon here; the resolver
 * itself is language-agnostic apart from a few idioms flagged in DateResolver.ts.
 */
export interface Lexicon {
  weekdays: readonly (readonly [string, number])[];
  months: readonly (readonly [string, number])[];
  numbers: readonly (readonly [string, number])[];
  /** today / tomorrow / day after tomorrow / yesterday → day offset */
  relativeDays: readonly (readonly [string, number])[];
  /** single tokens or phrases that combine a day and a day part: "tonight", "morgenochtend" */
  compoundDayParts: readonly (readonly [string, { offset: number; part: DayPart }])[];
  /** phrases that only give a day part: "in the morning", "'s avonds", "du soir" */
  dayPartPhrases: readonly (readonly [string, DayPart])[];
  meridiem: { am: readonly string[]; pm: readonly string[] };
  units: Record<'minute' | 'hour' | 'day' | 'week' | 'month' | 'year', readonly string[]>;
  words: {
    in: readonly string[];
    at: readonly string[];
    on: readonly string[];
    from: readonly string[];
    to: readonly string[];
    between: readonly string[];
    and: readonly string[];
    every: readonly string[];
    next: readonly string[];
    this: readonly string[];
    last: readonly string[];
    hourWord: readonly string[];
    half: readonly string[];
    quarter: readonly string[];
    past: readonly string[];
    before: readonly string[];
    noon: readonly string[];
    midnight: readonly string[];
    for: readonly string[];
    weekdayNoun: readonly string[];
    dayNoun: readonly string[];
    weekNoun: readonly string[];
    monthNoun: readonly string[];
    endOf: readonly string[];
    of: readonly string[];
    ordinals: readonly (readonly [string, number])[];
    /** Suffix form of "next": French "prochain(e)". Empty for languages without it. */
    nextSuffix: readonly string[];
    weekend: readonly string[];
  };
  /** Default clock time for a day part when the user gives no explicit time. */
  dayPartDefaults: Record<DayPart, string>;
}

const COMMON_DAY_PART_DEFAULTS: Record<DayPart, string> = {
  morning: '09:00',
  noon: '12:00',
  afternoon: '14:00',
  evening: '20:00',
  night: '22:00',
};

export const EN: Lexicon = {
  weekdays: [
    ['monday', 1], ['mon', 1],
    ['tuesday', 2], ['tue', 2], ['tues', 2],
    ['wednesday', 3], ['wed', 3],
    ['thursday', 4], ['thu', 4], ['thur', 4], ['thurs', 4],
    ['friday', 5], ['fri', 5],
    ['saturday', 6], ['sat', 6],
    ['sunday', 7], ['sun', 7],
  ],
  months: [
    ['january', 1], ['jan', 1], ['february', 2], ['feb', 2], ['march', 3], ['mar', 3],
    ['april', 4], ['apr', 4], ['may', 5], ['june', 6], ['jun', 6], ['july', 7], ['jul', 7],
    ['august', 8], ['aug', 8], ['september', 9], ['sept', 9], ['sep', 9], ['october', 10], ['oct', 10],
    ['november', 11], ['nov', 11], ['december', 12], ['dec', 12],
  ],
  numbers: [
    ['a', 1], ['an', 1], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6],
    ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10], ['eleven', 11], ['twelve', 12],
    ['thirteen', 13], ['fourteen', 14], ['fifteen', 15], ['twenty', 20], ['twenty-five', 25],
    ['thirty', 30], ['forty', 40], ['forty-five', 45], ['fifty', 50], ['sixty', 60], ['ninety', 90],
  ],
  relativeDays: [
    ['today', 0], ['tomorrow', 1], ['the day after tomorrow', 2], ['day after tomorrow', 2], ['yesterday', -1],
  ],
  compoundDayParts: [
    ['tonight', { offset: 0, part: 'evening' }],
    ['this evening', { offset: 0, part: 'evening' }],
    ['this afternoon', { offset: 0, part: 'afternoon' }],
    ['this morning', { offset: 0, part: 'morning' }],
    ['tomorrow morning', { offset: 1, part: 'morning' }],
    ['tomorrow afternoon', { offset: 1, part: 'afternoon' }],
    ['tomorrow evening', { offset: 1, part: 'evening' }],
    ['tomorrow night', { offset: 1, part: 'night' }],
    ['tomorrow noon', { offset: 1, part: 'noon' }],
  ],
  dayPartPhrases: [
    ['in the morning', 'morning'], ['in the afternoon', 'afternoon'], ['in the evening', 'evening'],
    ['at night', 'night'], ['at noon', 'noon'], ['morning', 'morning'], ['afternoon', 'afternoon'],
    ['evening', 'evening'], ['night', 'night'],
  ],
  meridiem: { am: ['am', 'a.m.', 'a.m'], pm: ['pm', 'p.m.', 'p.m'] },
  units: {
    minute: ['minutes', 'minute', 'mins', 'min'],
    hour: ['hours', 'hour', 'hrs', 'hr'],
    day: ['days', 'day'],
    week: ['weeks', 'week'],
    month: ['months', 'month'],
    year: ['years', 'year'],
  },
  words: {
    in: ['in'],
    at: ['at', 'around', 'about', 'at around', 'at about'],
    on: ['on'],
    from: ['from'],
    to: ['to', 'until', 'till', 'through'],
    between: ['between'],
    and: ['and'],
    every: ['every', 'each'],
    next: ['next'],
    this: ['this', 'coming', 'this coming'],
    last: ['last', 'previous'],
    hourWord: ["o'clock", 'oclock', 'h'],
    half: ['half'],
    quarter: ['quarter', 'a quarter'],
    past: ['past', 'after'],
    before: ['to', 'before'],
    noon: ['noon', 'midday'],
    midnight: ['midnight'],
    for: ['for'],
    weekdayNoun: ['weekday', 'workday', 'working day'],
    dayNoun: ['day'],
    weekNoun: ['week'],
    monthNoun: ['month'],
    endOf: ['end of the', 'end of', 'the end of the', 'at the end of the', 'at the end of'],
    of: ['of'],
    ordinals: [['first', 1], ['1st', 1], ['second', 2], ['2nd', 2], ['third', 3], ['3rd', 3], ['fourth', 4], ['4th', 4], ['last', -1]],
    nextSuffix: [],
    weekend: ['weekend', 'this weekend'],
  },
  dayPartDefaults: COMMON_DAY_PART_DEFAULTS,
};

export const NL: Lexicon = {
  weekdays: [
    ['maandag', 1], ['ma', 1], ['dinsdag', 2], ['di', 2], ['woensdag', 3], ['wo', 3],
    ['donderdag', 4], ['do', 4], ['vrijdag', 5], ['vr', 5], ['zaterdag', 6], ['za', 6], ['zondag', 7], ['zo', 7],
  ],
  months: [
    ['januari', 1], ['jan', 1], ['februari', 2], ['feb', 2], ['maart', 3], ['mrt', 3], ['april', 4], ['apr', 4],
    ['mei', 5], ['juni', 6], ['jun', 6], ['juli', 7], ['jul', 7], ['augustus', 8], ['aug', 8],
    ['september', 9], ['sep', 9], ['sept', 9], ['oktober', 10], ['okt', 10], ['november', 11], ['nov', 11],
    ['december', 12], ['dec', 12],
  ],
  numbers: [
    ['een', 1], ['één', 1], ['twee', 2], ['drie', 3], ['vier', 4], ['vijf', 5], ['zes', 6], ['zeven', 7],
    ['acht', 8], ['negen', 9], ['tien', 10], ['elf', 11], ['twaalf', 12], ['dertien', 13], ['veertien', 14],
    ['vijftien', 15], ['twintig', 20], ['vijfentwintig', 25], ['dertig', 30], ['veertig', 40],
    ['vijfenveertig', 45], ['vijftig', 50], ['zestig', 60], ['negentig', 90],
  ],
  relativeDays: [
    ['vandaag', 0], ['morgen', 1], ['overmorgen', 2], ['gisteren', -1], ['eergisteren', -2],
  ],
  compoundDayParts: [
    ['vanavond', { offset: 0, part: 'evening' }],
    ['vanmiddag', { offset: 0, part: 'afternoon' }],
    ['vanochtend', { offset: 0, part: 'morning' }],
    ['vanmorgen', { offset: 0, part: 'morning' }],
    ['vannacht', { offset: 0, part: 'night' }],
    ['morgenochtend', { offset: 1, part: 'morning' }],
    ['morgenvroeg', { offset: 1, part: 'morning' }],
    ['morgenmiddag', { offset: 1, part: 'afternoon' }],
    ['morgenavond', { offset: 1, part: 'evening' }],
    ['morgennacht', { offset: 1, part: 'night' }],
    ['overmorgen ochtend', { offset: 2, part: 'morning' }],
    ['overmorgenochtend', { offset: 2, part: 'morning' }],
    ['overmorgenavond', { offset: 2, part: 'evening' }],
  ],
  dayPartPhrases: [
    ["'s ochtends", 'morning'], ["'s morgens", 'morning'], ['in de ochtend', 'morning'], ['in de voormiddag', 'morning'],
    ["'s middags", 'afternoon'], ['in de middag', 'afternoon'], ['in de namiddag', 'afternoon'],
    ["'s avonds", 'evening'], ['in de avond', 'evening'], ["'s nachts", 'night'], ['in de nacht', 'night'],
    ['ochtend', 'morning'], ['voormiddag', 'morning'], ['middag', 'afternoon'], ['namiddag', 'afternoon'],
    ['avond', 'evening'], ['nacht', 'night'],
  ],
  meridiem: { am: ['am', 'a.m.'], pm: ['pm', 'p.m.'] },
  units: {
    minute: ['minuten', 'minuut', 'min'],
    hour: ['uur', 'uren', 'u'],
    day: ['dagen', 'dag'],
    week: ['weken', 'week'],
    month: ['maanden', 'maand'],
    year: ['jaar', 'jaren'],
  },
  words: {
    in: ['over', 'binnen'],
    at: ['om', 'rond', 'omstreeks', 'tegen'],
    on: ['op'],
    from: ['van', 'vanaf'],
    to: ['tot', 'tot en met', 't.e.m.'],
    between: ['tussen'],
    and: ['en'],
    every: ['elke', 'iedere', 'alle'],
    next: ['volgende'],
    this: ['deze', 'aanstaande', 'komende', 'a.s.'],
    last: ['vorige', 'afgelopen', 'laatste'],
    hourWord: ['uur', 'u'],
    half: ['half'],
    quarter: ['kwart'],
    past: ['over', 'na'],
    before: ['voor'],
    noon: ['middag', 'de middag', 'twaalf uur'],
    midnight: ['middernacht'],
    for: ['van', 'voor', 'gedurende'],
    weekdayNoun: ['werkdag', 'weekdag'],
    dayNoun: ['dag'],
    weekNoun: ['week'],
    monthNoun: ['maand'],
    endOf: ['einde van de', 'eind van de', 'einde', 'eind', 'op het einde van de', 'tegen het einde van de'],
    of: ['van'],
    ordinals: [['eerste', 1], ['1e', 1], ['1ste', 1], ['tweede', 2], ['2e', 2], ['2de', 2], ['derde', 3], ['3e', 3], ['3de', 3], ['vierde', 4], ['4e', 4], ['laatste', -1]],
    nextSuffix: [],
    weekend: ['weekend', 'dit weekend', 'het weekend'],
  },
  dayPartDefaults: COMMON_DAY_PART_DEFAULTS,
};

export const FR: Lexicon = {
  weekdays: [
    ['lundi', 1], ['mardi', 2], ['mercredi', 3], ['jeudi', 4], ['vendredi', 5], ['samedi', 6], ['dimanche', 7],
  ],
  months: [
    ['janvier', 1], ['février', 2], ['fevrier', 2], ['mars', 3], ['avril', 4], ['mai', 5], ['juin', 6],
    ['juillet', 7], ['août', 8], ['aout', 8], ['septembre', 9], ['octobre', 10], ['novembre', 11], ['décembre', 12], ['decembre', 12],
  ],
  numbers: [
    ['un', 1], ['une', 1], ['deux', 2], ['trois', 3], ['quatre', 4], ['cinq', 5], ['six', 6], ['sept', 7],
    ['huit', 8], ['neuf', 9], ['dix', 10], ['onze', 11], ['douze', 12], ['treize', 13], ['quatorze', 14],
    ['quinze', 15], ['vingt', 20], ['vingt-cinq', 25], ['trente', 30], ['quarante', 40], ['quarante-cinq', 45],
    ['cinquante', 50], ['soixante', 60], ['quatre-vingt-dix', 90],
  ],
  relativeDays: [
    ["aujourd'hui", 0], ['demain', 1], ['après-demain', 2], ['apres-demain', 2], ['hier', -1], ['avant-hier', -2],
  ],
  compoundDayParts: [
    ['ce soir', { offset: 0, part: 'evening' }],
    ['cet après-midi', { offset: 0, part: 'afternoon' }],
    ['cet apres-midi', { offset: 0, part: 'afternoon' }],
    ['ce matin', { offset: 0, part: 'morning' }],
    ['cette nuit', { offset: 0, part: 'night' }],
    ['demain matin', { offset: 1, part: 'morning' }],
    ['demain après-midi', { offset: 1, part: 'afternoon' }],
    ['demain apres-midi', { offset: 1, part: 'afternoon' }],
    ['demain soir', { offset: 1, part: 'evening' }],
    ['demain midi', { offset: 1, part: 'noon' }],
  ],
  dayPartPhrases: [
    ['du matin', 'morning'], ['le matin', 'morning'], ["de l'après-midi", 'afternoon'], ["l'après-midi", 'afternoon'],
    ['du soir', 'evening'], ['le soir', 'evening'], ['de la nuit', 'night'], ['la nuit', 'night'],
    ['matin', 'morning'], ['après-midi', 'afternoon'], ['apres-midi', 'afternoon'], ['soir', 'evening'], ['nuit', 'night'],
  ],
  meridiem: { am: ['am', 'a.m.'], pm: ['pm', 'p.m.'] },
  units: {
    minute: ['minutes', 'minute', 'min'],
    hour: ['heures', 'heure', 'h'],
    day: ['jours', 'jour'],
    week: ['semaines', 'semaine'],
    month: ['mois'],
    year: ['ans', 'an', 'année', 'années'],
  },
  words: {
    in: ['dans', "d'ici"],
    at: ['à', 'a', 'vers', 'aux alentours de', 'aux environs de'],
    on: ['le', 'ce'],
    from: ['de', 'du', 'à partir de'],
    to: ['à', 'a', "jusqu'à", "jusqu'a", 'jusque'],
    between: ['entre'],
    and: ['et'],
    every: ['tous les', 'toutes les', 'chaque'],
    next: ['prochain', 'prochaine'],
    this: ['ce', 'cette'],
    last: ['dernier', 'dernière', 'derniere', 'passé', 'passée'],
    hourWord: ['heures', 'heure', 'h'],
    half: ['demie', 'demi'],
    quarter: ['quart'],
    past: ['et'],
    before: ['moins'],
    noon: ['midi'],
    midnight: ['minuit'],
    for: ['pendant', 'pour', 'durant', "d'", 'de'],
    weekdayNoun: ['jour de semaine', 'jours de semaine', 'jour ouvrable', 'jours ouvrables', 'jour de la semaine', 'jours de la semaine'],
    dayNoun: ['jour', 'jours'],
    weekNoun: ['semaine'],
    monthNoun: ['mois'],
    endOf: ['fin du', 'fin de', 'à la fin du', 'a la fin du', 'en fin de', 'fin'],
    of: ['du', 'de'],
    ordinals: [['premier', 1], ['1er', 1], ['première', 1], ['deuxième', 2], ['2e', 2], ['2ème', 2], ['troisième', 3], ['3e', 3], ['3ème', 3], ['quatrième', 4], ['4e', 4], ['dernier', -1], ['dernière', -1]],
    nextSuffix: ['prochain', 'prochaine'],
    weekend: ['week-end', 'weekend', 'ce week-end', 'ce weekend'],
  },
  dayPartDefaults: COMMON_DAY_PART_DEFAULTS,
};

export const LEXICONS: Record<Language, Lexicon> = { en: EN, nl: NL, fr: FR };

export function getLexicon(language: Language): Lexicon {
  return LEXICONS[language];
}

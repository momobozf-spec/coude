import type { ChatMessage } from "./parser";

export type AwardId =
  | "spammer"
  | "ghost"
  | "nightOwl"
  | "voiceKing"
  | "fastest"
  | "starter"
  | "novelist"
  | "questioner"
  | "laugher"
  | "stickers"
  | "deleter";

export interface Award {
  id: AwardId;
  winner: string;
  /** Primary number shown on the card (count, minutes, words, ...). */
  value: number;
  /** Share of the group total, 0..1, when that makes sense. */
  share?: number;
}

export interface MemberStats {
  name: string;
  messages: number;
  words: number;
  media: number;
  voice: number;
  stickers: number;
  deleted: number;
  night: number;
  starters: number;
  questions: number;
  laughs: number;
  replies: number;
  medianReplyMinutes: number | null;
  avgWords: number;
  topEmoji: string | null;
  longestSilenceDays: number;
}

export interface ChatStats {
  year: number;
  members: MemberStats[];
  totalMessages: number;
  totalWords: number;
  totalMedia: number;
  totalVoice: number;
  activeDays: number;
  longestStreak: { days: number; start: string; end: string };
  busiestDay: { date: string; count: number };
  busiestMonth: { month: number; count: number };
  monthCounts: number[];
  hourCounts: number[];
  weekdayCounts: number[];
  peakHour: number;
  topEmojis: Array<{ emoji: string; count: number }>;
  topWords: Array<{ word: string; count: number }>;
  duo: { a: string; b: string; count: number } | null;
  voiceDetected: boolean;
  awards: Award[];
}

export const LAUGH = /(?:\b(?:ha){2,}h?\b|\b(?:he){2,}\b|\bhihi+\b|\b(?:ja){2,}a*\b|\b(?:je){2,}\b|\bmdr+\b|\bptdr+\b|\blol+\b|\blmao+\b|\bxd+\b|😂|🤣|😹|💀|😆)/iu;

const STOPWORDS = new Set(
  (
    // Dutch
    "de het een en van ik je jij te dat die in is niet op zijn met voor er maar om ook als dan wat aan nog bij mijn hij zij " +
    "we wij ze zo naar heb hebben had was waren wordt worden kan kunnen moet moeten zou zal wil gaat gaan ga doen doe gedaan " +
    "heeft hoe nu al wel geen meer veel toch even echt nou dus omdat want of hier daar mij me jou jullie hun hem haar ons onze " +
    "uw jouw deze dit wie waar wanneer waarom zijn ben bent komt komen kom gewoon ja nee oke oké ok okee goed alles iets niks " +
    "niets iemand mensen tot uit over door na toen zoals heel eens weer waren denk weet zeg zegt gezegd hoor zien zie mee breng brengen " +
    // French
    "le la les un une des du de et est en que qui pas pour sur au aux avec ce cette ces mais ou où je tu il elle nous vous ils " +
    "elles on mon ma mes ton ta tes son sa ses notre votre leur leurs ne se sa sont suis es était être avoir ai as avez ont " +
    "fait faire plus très bien tout tous toute toutes comme quand donc alors aussi encore oui non ça cela ici là moi toi lui " +
    "eux même déjà va vais vas aller dit dire peut peux faut quoi rien chez par dans " +
    // English
    "the a an and or but of to in on at for with is are was were be been being it its this that these those i you he she we " +
    "they me him her us them my your his our their not no yes so if then than there here what who when where why how all " +
    "just like get got can could will would should do does did have has had im it's dont don't okay ok yeah yep from out up " +
    // German
    "der die das den dem des ein eine einen einem einer und oder aber ich du er sie es wir ihr mich dich mir dir uns euch " +
    "ist bin bist sind seid war waren sein hat habe hast haben hatte nicht kein keine noch schon auch nur so wie was wer wo " +
    "wann warum mit von zu im in am an auf aus bei für über nach vor um als wenn dass ob dann doch mal ja nein gut alles " +
    "nichts heute morgen jetzt hier da dann mein meine dein deine sein seine euer eure kann kannst können muss müssen will " +
    "wird werden geht gehen mach machen gemacht sagen sagt gesagt gibt man sich sehr ganz mehr viel denn halt eben einfach " +
    // Spanish
    "el la los las un una unos unas y o pero que qué de del al a en con por para sin sobre es son soy eres está están estoy " +
    "fue ser estar hay ha he has han había no sí si ya muy más menos todo todos toda todas esto eso este esta ese esa yo tú " +
    "él ella nosotros vosotros ellos ellas me te se nos os le les lo mi mis tu tus su sus como cuando donde dónde porque " +
    "también tambien aquí ahí allí hoy mañana bien vale pues bueno entonces algo nada voy vas va vamos tengo tienes tiene " +
    "hacer hace hecho decir dice dicho puedo puede creo sé solo luego aún ni " +
    // chat filler
    "haha hahaha hahahaha hihi jaja jajaja jeje jejeje lol mdr ptdr xd omg wtf hmm mmm ah oh eh euh ehm ewa wa ja hey hoi salut hola hallo " +
    "https http www com media weggelaten omitted omis bericht verwijderd deleted message medien ausgeschlossen weggelassen multimedia omitido omitida eliminó mensaje nachricht gelöscht"
  ).split(/\s+/),
);

const DAY_MS = 86_400_000;
const STARTER_GAP_MS = 4 * 3_600_000;
const REPLY_WINDOW_MS = 6 * 3_600_000;
const DUO_WINDOW_MS = 15 * 60_000;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

let segmenter: Intl.Segmenter | null = null;
function emojisIn(text: string): string[] {
  if (!/\p{Extended_Pictographic}/u.test(text)) return [];
  segmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) out.push(segment.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""));
  }
  return out;
}

export function wordsIn(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

/** Year to report on: the year of the most recent real message. */
export function pickYear(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender) return messages[i].ts.getUTCFullYear();
  }
  return new Date().getUTCFullYear();
}

function topN<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function computeStats(all: ChatMessage[], year = pickYear(all)): ChatStats {
  const msgs = all.filter((m) => m.sender && m.ts.getUTCFullYear() === year);
  const names = [...new Set(msgs.map((m) => m.sender as string))];
  const nameTokens = new Set(names.flatMap((n) => wordsIn(n)));

  const per = new Map<string, MemberStats & { _reply: number[]; _emoji: Map<string, number>; _last: Date | null }>();
  for (const name of names) {
    per.set(name, {
      name,
      messages: 0,
      words: 0,
      media: 0,
      voice: 0,
      stickers: 0,
      deleted: 0,
      night: 0,
      starters: 0,
      questions: 0,
      laughs: 0,
      replies: 0,
      medianReplyMinutes: null,
      avgWords: 0,
      topEmoji: null,
      longestSilenceDays: 0,
      _reply: [],
      _emoji: new Map(),
      _last: null,
    });
  }

  const dayCounts = new Map<string, number>();
  const monthCounts = new Array(12).fill(0);
  const hourCounts = new Array(24).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  const emojiCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const duoCounts = new Map<string, number>();
  let totalWords = 0;

  let prev: ChatMessage | null = null;
  for (const m of msgs) {
    const s = per.get(m.sender as string)!;
    const day = isoDay(m.ts);
    s.messages++;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    monthCounts[m.ts.getUTCMonth()]++;
    hourCounts[m.ts.getUTCHours()]++;
    weekdayCounts[m.ts.getUTCDay()]++;
    if (m.ts.getUTCHours() < 5) s.night++;

    if (s._last) {
      const gapDays = (m.ts.getTime() - s._last.getTime()) / DAY_MS;
      if (gapDays > s.longestSilenceDays) s.longestSilenceDays = Math.floor(gapDays);
    }
    s._last = m.ts;

    if (!prev || m.ts.getTime() - prev.ts.getTime() >= STARTER_GAP_MS) s.starters++;
    if (prev && prev.sender !== m.sender) {
      const diff = m.ts.getTime() - prev.ts.getTime();
      if (diff <= REPLY_WINDOW_MS) {
        s.replies++;
        s._reply.push(diff / 60_000);
      }
      if (diff <= DUO_WINDOW_MS) {
        const key = [prev.sender, m.sender].sort().join("\u0001");
        duoCounts.set(key, (duoCounts.get(key) ?? 0) + 1);
      }
    }
    prev = m;

    if (m.kind === "media") {
      s.media++;
      if (m.mediaType === "audio") s.voice++;
      if (m.mediaType === "sticker") s.stickers++;
      continue;
    }
    if (m.kind === "deleted") {
      s.deleted++;
      continue;
    }
    const ws = wordsIn(m.text);
    s.words += ws.length;
    totalWords += ws.length;
    if (m.text.includes("?")) s.questions++;
    if (LAUGH.test(m.text)) s.laughs++;
    for (const w of ws) {
      if (w.length < 3 || STOPWORDS.has(w) || nameTokens.has(w) || /^\d+$/.test(w) || /^(ha)+h?$/.test(w)) continue;
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
    for (const e of emojisIn(m.text)) {
      emojiCounts.set(e, (emojiCounts.get(e) ?? 0) + 1);
      s._emoji.set(e, (s._emoji.get(e) ?? 0) + 1);
    }
  }

  const members: MemberStats[] = [...per.values()]
    .map(({ _reply, _emoji, _last, ...rest }) => {
      void _last;
      const textMsgs = rest.messages - rest.media - rest.deleted;
      return {
        ...rest,
        medianReplyMinutes: _reply.length >= 10 ? Math.round(median(_reply)! * 10) / 10 : null,
        avgWords: textMsgs > 0 ? Math.round((rest.words / textMsgs) * 10) / 10 : 0,
        topEmoji: topN(_emoji, 1)[0]?.[0] ?? null,
      };
    })
    .sort((a, b) => b.messages - a.messages);

  // Longest streak of consecutive active days.
  const days = [...dayCounts.keys()].sort();
  let best = { days: 0, start: "", end: "" };
  let runStart = days[0];
  let runLen = 0;
  for (let i = 0; i < days.length; i++) {
    const consecutive = i > 0 && Date.parse(days[i]) - Date.parse(days[i - 1]) === DAY_MS;
    if (consecutive) runLen++;
    else {
      runLen = 1;
      runStart = days[i];
    }
    if (runLen > best.days) best = { days: runLen, start: runStart, end: days[i] };
  }

  const busiestDayEntry = topN(dayCounts, 1)[0] ?? ["", 0];
  const busiestMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));
  const duoEntry = names.length >= 3 ? topN(duoCounts, 1)[0] : undefined;
  const totalMessages = msgs.length;
  const totalVoice = members.reduce((n, m) => n + m.voice, 0);

  return {
    year,
    members,
    totalMessages,
    totalWords,
    totalMedia: members.reduce((n, m) => n + m.media, 0),
    totalVoice,
    activeDays: dayCounts.size,
    longestStreak: best,
    busiestDay: { date: busiestDayEntry[0], count: busiestDayEntry[1] },
    busiestMonth: { month: busiestMonthIdx, count: monthCounts[busiestMonthIdx] },
    monthCounts,
    hourCounts,
    weekdayCounts,
    peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
    topEmojis: topN(emojiCounts, 5).map(([emoji, count]) => ({ emoji, count })),
    topWords: topN(wordCounts, 5).map(([word, count]) => ({ word, count })),
    duo: duoEntry ? { a: duoEntry[0].split("\u0001")[0], b: duoEntry[0].split("\u0001")[1], count: duoEntry[1] } : null,
    voiceDetected: totalVoice > 0,
    awards: computeAwards(members, totalMessages),
  };
}

function winnerBy(members: MemberStats[], pick: (m: MemberStats) => number, eligible: (m: MemberStats) => boolean = () => true) {
  let best: MemberStats | null = null;
  for (const m of members) {
    if (!eligible(m)) continue;
    if (!best || pick(m) > pick(best)) best = m;
  }
  return best;
}

export function computeAwards(members: MemberStats[], total: number): Award[] {
  const awards: Award[] = [];
  if (members.length < 2 || total === 0) return awards;
  const add = (id: AwardId, m: MemberStats | null, value: number, withShare = false) => {
    if (m && value > 0) awards.push({ id, winner: m.name, value, ...(withShare ? { share: value / total } : {}) });
  };

  const spammer = winnerBy(members, (m) => m.messages);
  add("spammer", spammer, spammer?.messages ?? 0, true);

  if (members.length >= 3) {
    const ghost = winnerBy(members, (m) => -m.messages);
    if (ghost && ghost.name !== spammer?.name) awards.push({ id: "ghost", winner: ghost.name, value: ghost.messages, share: ghost.messages / total });
  }

  const owl = winnerBy(members, (m) => m.night);
  add("nightOwl", owl, owl?.night ?? 0);

  const voice = winnerBy(members, (m) => m.voice);
  add("voiceKing", voice, voice?.voice ?? 0);

  const fastest = winnerBy(members, (m) => -(m.medianReplyMinutes ?? Infinity), (m) => m.medianReplyMinutes !== null);
  if (fastest && fastest.medianReplyMinutes !== null) {
    awards.push({ id: "fastest", winner: fastest.name, value: fastest.medianReplyMinutes });
  }

  const starter = winnerBy(members, (m) => m.starters);
  add("starter", starter, starter?.starters ?? 0);

  const novelist = winnerBy(members, (m) => m.avgWords, (m) => m.messages - m.media - m.deleted >= 20);
  add("novelist", novelist, novelist?.avgWords ?? 0);

  const questioner = winnerBy(members, (m) => m.questions);
  add("questioner", questioner, questioner?.questions ?? 0);

  const laugher = winnerBy(members, (m) => m.laughs);
  add("laugher", laugher, laugher?.laughs ?? 0);

  const stickers = winnerBy(members, (m) => m.stickers);
  add("stickers", stickers, stickers?.stickers ?? 0);

  const deleter = winnerBy(members, (m) => m.deleted);
  if (deleter && deleter.deleted >= 3) add("deleter", deleter, deleter.deleted);

  return awards;
}

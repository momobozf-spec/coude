// WhatsApp chat-export parser. Runs entirely in the browser (and in tests on Node).
// Supports iOS and Android exports in Dutch, French, English, German and Spanish
// (Italian/Portuguese best effort, and most locales with the same date/time shapes), with or without media.

export type MediaType = "audio" | "image" | "video" | "sticker" | "gif" | "document" | "unknown";

export type MessageKind = "text" | "media" | "deleted" | "system";

export interface ChatMessage {
  /** Naive local timestamp stored as UTC. Always read it with getUTC* methods. */
  ts: Date;
  sender: string | null;
  text: string;
  kind: MessageKind;
  mediaType?: MediaType;
  edited?: boolean;
}

export interface ParseResult {
  messages: ChatMessage[];
  members: string[];
  dateOrder: "DMY" | "MDY" | "YMD";
  platform: "ios" | "android" | "unknown";
  skippedLines: number;
}

export class ChatParseError extends Error {
  constructor(public code: "empty" | "no_messages" | "no_txt_in_zip" | "too_large") {
    super(code);
  }
}

// Invisible characters WhatsApp sprinkles into exports.
const INVISIBLE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

// [09/11/2026, 23:34:12] Name: text        (iOS)
// 09/11/2026, 23:34 - Name: text            (Android)
// 11/9/26, 11:34 PM - Name: text            (Android, US)
// 09/11/2026 à 23:34 - Nom : texte          (Android, FR)
// 09-11-2026 23:34 - Naam: tekst            (Android, NL)
// 2026-11-09, 23:34 - Name: text            (Android, ISO)
const HEADER = new RegExp(
  "^\\[?" +
    "(\\d{1,4})[./-](\\d{1,2})[./-](\\d{1,4})" + // date
    ",?\\s*(?:à|om|at|um|a las|às)?\\s*" + // separator
    "(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?" + // time
    "\\s*([AaPp]\\.?\\s?[Mm]\\.?)?" + // am/pm
    "\\]?" +
    "\\s*(?:[-–—]\\s*)?" +
    "(.*)$",
);

// "omitted" in the export languages we support (EN/NL/FR/DE/ES) plus IT/PT as best effort.
const OMITTED = "(?:omitted|weggelaten|omise?|absente?|ausgeschlossen|weggelassen|omitid[oa]|omess[oaie]|ocultad?[oa]|oculto)";
const media = (words: string) => new RegExp(`^(?:${words})\\s+${OMITTED}$`, "i");

const MEDIA_INLINE: Array<[RegExp, MediaType]> = [
  [media("audio|áudio|spraakbericht|message vocal|voice message|sprachnachricht|mensaje de voz"), "audio"],
  [media("image|imagen|imagem|immagine|afbeelding|foto|photo|bild"), "image"],
  [media("video|vídeo|vidéo"), "video"],
  [media("sticker|autocollant|figurinha"), "sticker"],
  [media("gif"), "gif"],
  [media("document|documento|dokument|bestand|fichier|datei"), "document"],
  [new RegExp(`^.+•\\s*\\d+\\s*(?:pages?|pagina'?s?|seiten?|páginas?|pagine)\\s*(?:document\\s+|dokument\\s+|documento\\s+)?${OMITTED}$`, "i"), "document"],
];

const MEDIA_GENERIC = new RegExp(
  "^<\\s*(?:(?:media|médias?|medien|multimedia|mídia|arquivo de mídia)\\s+" + OMITTED + "|media omessi)\\s*>$",
  "i",
);
const FILE_ATTACHED = /^(.+?)\s*\((file attached|bestand bijgevoegd|fichier joint|datei angehängt|archivo adjunto|file allegato|arquivo anexado)\)$/i;
const DELETED = new RegExp(
  "^(this message was deleted|you deleted this message|dit bericht is verwijderd|je hebt dit bericht verwijderd|" +
    "u heeft dit bericht verwijderd|ce message a été supprimé|vous avez supprimé ce message|" +
    "diese nachricht wurde gelöscht|du hast diese nachricht gelöscht|" +
    "se eliminó este mensaje|eliminaste este mensaje|este mensaje fue eliminado|" +
    "questo messaggio è stato eliminato|hai eliminato questo messaggio|" +
    "mensagem apagada|esta mensagem foi apagada|você apagou esta mensagem)\\.?$",
  "i",
);
const EDITED_SUFFIX = new RegExp(
  "\\s*<\\s*(?:this message was edited|dit bericht is bewerkt|ce message a été modifié|" +
    "diese nachricht wurde bearbeitet|se editó este mensaje|questo messaggio è stato modificato|mensagem editada)\\.?\\s*>\\s*$",
  "i",
);
const NULL_MEDIA = /^null$/i;
const SYS_MARK = "\u0000";

function mediaTypeFromFilename(name: string): MediaType {
  const n = name.toLowerCase();
  if (/^ptt-|\.(opus|ogg|m4a|mp3|aac|wav)$/.test(n) || n.includes("aud-")) return "audio";
  if (/\.webp$/.test(n) || n.includes("stk-")) return "sticker";
  if (/\.gif$/.test(n)) return "gif";
  if (/\.(mp4|mov|3gp|avi|mkv)$/.test(n) || n.includes("vid-")) return "video";
  if (/\.(jpe?g|png|heic|heif)$/.test(n) || n.includes("img-") || n.includes("photo")) return "image";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|zip|vcf)$/.test(n)) return "document";
  return "unknown";
}

function classify(body: string): Pick<ChatMessage, "kind" | "mediaType" | "text" | "edited"> {
  const marked = body.startsWith(SYS_MARK);
  let text = marked ? body.slice(1) : body;
  let edited = false;
  if (EDITED_SUFFIX.test(text)) {
    text = text.replace(EDITED_SUFFIX, "");
    edited = true;
  }
  const trimmed = text.trim();
  if (MEDIA_GENERIC.test(trimmed) || NULL_MEDIA.test(trimmed)) {
    return { kind: "media", mediaType: "unknown", text: "", edited };
  }
  for (const [re, type] of MEDIA_INLINE) {
    if (re.test(trimmed)) return { kind: "media", mediaType: type, text: "", edited };
  }
  const attached = trimmed.match(FILE_ATTACHED);
  if (attached && !attached[1].includes("\n")) {
    return { kind: "media", mediaType: mediaTypeFromFilename(attached[1]), text: "", edited };
  }
  if (DELETED.test(trimmed)) return { kind: "deleted", text: "", edited };
  // A marked line that is not media or a deletion is a system notice
  // (encryption notice, someone joined, location share, poll, ...).
  if (marked) return { kind: "system", text: trimmed, edited };
  return { kind: "text", text, edited };
}

interface RawHeader {
  a: number;
  b: number;
  c: number;
  aLen: number;
  hour: number;
  minute: number;
  second: number;
  ampm: string | undefined;
  rest: string;
  bracket: boolean;
}

function matchHeader(line: string): RawHeader | null {
  const m = line.match(HEADER);
  if (!m) return null;
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (hour > 24 || minute > 59) return null;
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    c: Number(m[3]),
    aLen: m[1].length,
    hour,
    minute,
    second: m[6] ? Number(m[6]) : 0,
    ampm: m[7],
    rest: m[8] ?? "",
    bracket: line.startsWith("["),
  };
}

function detectDateOrder(headers: RawHeader[]): "DMY" | "MDY" | "YMD" {
  if (headers.some((h) => h.aLen === 4)) return "YMD";
  let firstOver12 = false;
  let secondOver12 = false;
  for (const h of headers) {
    if (h.a > 12) firstOver12 = true;
    if (h.b > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return "DMY";
  if (secondOver12 && !firstOver12) return "MDY";
  // Ambiguous (all days <= 12): US-style exports use AM/PM, European ones don't.
  return headers.some((h) => h.ampm) ? "MDY" : "DMY";
}

function toDate(h: RawHeader, order: "DMY" | "MDY" | "YMD"): Date | null {
  let day: number, month: number, year: number;
  if (order === "YMD") [year, month, day] = [h.a, h.b, h.c];
  else if (order === "MDY") [month, day, year] = [h.a, h.b, h.c];
  else [day, month, year] = [h.a, h.b, h.c];
  if (year < 100) year += 2000;
  let hour = h.hour;
  if (h.ampm) {
    const pm = /^p/i.test(h.ampm);
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (hour === 24) hour = 0;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day, hour, h.minute, h.second));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sender names never span this many characters; protects against "Name: " false
// positives inside system lines.
const MAX_SENDER = 60;

function splitSender(rest: string): { sender: string | null; body: string } {
  // French exports may use "Nom : texte" (narrow/regular space before colon).
  const m = rest.match(/^(.+?)\s?:\s([\s\S]*)$/) ?? rest.match(/^(.+?)\s?:$/);
  if (!m) return { sender: null, body: rest };
  const sender = m[1].trim();
  if (!sender || sender.length > MAX_SENDER) return { sender: null, body: rest };
  return { sender, body: m[2] ?? "" };
}

export const MAX_TEXT_BYTES = 80 * 1024 * 1024;

export function parseChat(input: string): ParseResult {
  if (!input || !input.trim()) throw new ChatParseError("empty");
  if (input.length > MAX_TEXT_BYTES) throw new ChatParseError("too_large");

  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  // iOS marks system and media lines with a left-to-right mark right after "Name: ".
  // Keep that signal as SYS_MARK before stripping invisible characters.
  const cleaned = lines.map((l) =>
    l
      .replace(/:\s\u200e/g, ": " + SYS_MARK)
      .replace(INVISIBLE, "")
      .replace(/[\u202f\u00a0]/g, " "),
  );

  // Pass 1: find header lines.
  const headers: Array<RawHeader | null> = cleaned.map(matchHeader);
  const found = headers.filter((h): h is RawHeader => h !== null);
  if (found.length === 0) throw new ChatParseError("no_messages");
  const order = detectDateOrder(found);
  const bracketCount = found.filter((h) => h.bracket).length;
  const platform = bracketCount > found.length / 2 ? "ios" : "android";

  // Pass 2: build messages; continuation lines append to the previous one.
  const raw: Array<{ ts: Date; rest: string }> = [];
  let skipped = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const h = headers[i];
    const date = h ? toDate(h, order) : null;
    if (h && date) {
      raw.push({ ts: date, rest: h.rest });
    } else if (raw.length > 0) {
      raw[raw.length - 1].rest += "\n" + cleaned[i];
    } else if (cleaned[i].trim()) {
      skipped++;
    }
  }

  const messages: ChatMessage[] = [];
  const senderCounts = new Map<string, number>();
  for (const r of raw) {
    const s = splitSender(r.rest);
    if (!s.sender) {
      messages.push({ ts: r.ts, sender: null, text: s.body.replaceAll(SYS_MARK, "").trim(), kind: "system" });
      continue;
    }
    const c = classify(s.body.replace(/\s+$/, ""));
    if (c.kind === "system") {
      // iOS attributes notices to the group name; do not treat that as a member.
      messages.push({ ts: r.ts, sender: null, text: c.text, kind: "system" });
      continue;
    }
    messages.push({ ts: r.ts, sender: s.sender, ...c });
    senderCounts.set(s.sender, (senderCounts.get(s.sender) ?? 0) + 1);
  }

  const members = [...senderCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([name]) => name);

  if (!messages.some((m) => m.kind !== "system")) throw new ChatParseError("no_messages");

  return { messages, members, dateOrder: order, platform, skippedLines: skipped };
}

/** Reads a WhatsApp export the user dropped: either the .txt itself or the .zip WhatsApp produces. */
export async function readExportFile(file: File): Promise<string> {
  const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
  if (!isZip) return stripBom(await file.text());
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const txts = Object.values(zip.files).filter((f) => !f.dir && /\.txt$/i.test(f.name) && !f.name.startsWith("__MACOSX"));
  if (txts.length === 0) throw new ChatParseError("no_txt_in_zip");
  const preferred =
    txts.find((f) => /(^|\/)_chat\.txt$/i.test(f.name)) ?? txts.find((f) => /whatsapp/i.test(f.name));
  if (preferred) return stripBom(await preferred.async("string"));
  // Fall back to the largest text file in the archive.
  const contents = await Promise.all(txts.map((f) => f.async("string")));
  return stripBom(contents.reduce((a, b) => (b.length > a.length ? b : a)));
}

function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

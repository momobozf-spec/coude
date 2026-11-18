import { strFromU8, unzipSync } from "fflate";
import { ChatParseError, MAX_TEXT_BYTES } from "./parser";

/** Picks the chat text out of a WhatsApp export: the .txt itself or the .zip WhatsApp produces. Pure function, testable in Node. */
export function chatTextFromBytes(bytes: Uint8Array, fileName: string, mimeType?: string | null): string {
  if (bytes.byteLength > MAX_TEXT_BYTES) throw new ChatParseError("too_large");
  const isZip =
    /\.zip$/i.test(fileName) ||
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    // PK\x03\x04 magic number: WhatsApp on Android sometimes shares the zip without extension.
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04);
  if (!isZip) return stripBom(strFromU8(bytes));

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (f) => /\.txt$/i.test(f.name) && !f.name.startsWith("__MACOSX") });
  } catch {
    throw new ChatParseError("no_txt_in_zip");
  }
  const names = Object.keys(entries);
  if (names.length === 0) throw new ChatParseError("no_txt_in_zip");
  const preferred = names.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ?? names.find((n) => /whatsapp/i.test(n));
  const pick = preferred ?? names.reduce((a, b) => (entries[b].byteLength > entries[a].byteLength ? b : a));
  return stripBom(strFromU8(entries[pick]));
}

function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

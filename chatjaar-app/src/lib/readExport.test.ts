import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { chatTextFromBytes } from "./readExport";
import { ChatParseError, parseChat } from "./parser";
import { fingerprint } from "./analyze-core";
import { computeStats } from "./stats";

const CHAT = [
  "01/02/2026, 10:00 - Sara: Hallo",
  "01/02/2026, 10:01 - Yassine: Hey 😂",
  "13/02/2026, 23:15 - Sara: Wie komt er?",
].join("\n");

describe("chatTextFromBytes", () => {
  it("reads a plain .txt (with BOM)", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8(CHAT)]);
    expect(chatTextFromBytes(bytes, "WhatsApp Chat met Vrienden.txt")).toBe(CHAT);
  });

  it("reads _chat.txt from an iOS zip and ignores other files", () => {
    const zip = zipSync({ "_chat.txt": strToU8(CHAT), "IMG-0001.jpg": new Uint8Array([1, 2, 3]), "notes.txt": strToU8("x") });
    expect(chatTextFromBytes(zip, "WhatsApp Chat - Vrienden.zip")).toBe(CHAT);
  });

  it("detects a zip without extension by its magic number (Android share)", () => {
    const zip = zipSync({ "WhatsApp Chat with Friends.txt": strToU8(CHAT) });
    expect(chatTextFromBytes(zip, "content", "application/octet-stream")).toBe(CHAT);
  });

  it("throws no_txt_in_zip for a zip without chat", () => {
    const zip = zipSync({ "photo.jpg": new Uint8Array([1, 2, 3]) });
    expect(() => chatTextFromBytes(zip, "x.zip")).toThrow(ChatParseError);
  });

  it("gives the same fingerprint for the same chat and a different one for another chat", () => {
    const a = computeStats(parseChat(CHAT).messages);
    const b = computeStats(parseChat(CHAT + "\n14/02/2026, 08:00 - Yassine: Ik!").messages);
    expect(fingerprint(a)).toBe(fingerprint(computeStats(parseChat(CHAT).messages)));
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});

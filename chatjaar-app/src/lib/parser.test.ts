import { describe, expect, it } from "vitest";
import { ChatParseError, parseChat } from "./parser";

const LRM = "‎";
const NNBSP = " ";

const IOS_NL = [
  `[01/01/2026, 10:00:00] Vrienden 🎉: ${LRM}Berichten en oproepen worden end-to-end versleuteld.`,
  `${LRM}[01/01/2026, 10:00:05] Vrienden 🎉: ${LRM}Sara heeft deze groep gemaakt`,
  `[01/01/2026, 10:01:00] Sara: Gelukkig nieuwjaar allemaal!`,
  `[01/01/2026, 10:02:13] Yassine: Insgelijks 🎉🎉`,
  `en nog een regel`,
  `${LRM}[01/01/2026, 10:03:00] Yassine: ${LRM}afbeelding weggelaten`,
  `${LRM}[13/01/2026, 23:59:59] Sara: ${LRM}audio weggelaten`,
  `${LRM}[14/01/2026, 00:10:00] Sara: ${LRM}Dit bericht is verwijderd.`,
  `[15/01/2026, 08:00:00] Yassine: Wie komt er zaterdag? <Dit bericht is bewerkt>`,
].join("\n");

const ANDROID_NL = [
  `01-01-2026 10:00 - Berichten en oproepen worden end-to-end versleuteld. Niemand buiten deze chat kan ze lezen.`,
  `01-01-2026 10:01 - Sara: Gelukkig nieuwjaar`,
  `01-01-2026 10:02 - Yassine: <Media weggelaten>`,
  `25-12-2026 22:15 - Sara: Zalig kerstfeest`,
  `tweede regel`,
].join("\n");

const ANDROID_US = [
  `1/2/26, 9:05${NNBSP}PM - Messages and calls are end-to-end encrypted.`,
  `1/2/26, 9:06${NNBSP}PM - Mike: hey`,
  `1/13/26, 12:30${NNBSP}AM - Anna: late night`,
  `1/13/26, 12:31${NNBSP}PM - Anna: PTT-20260113-WA0001.opus (file attached)`,
].join("\n");

const ANDROID_FR = [
  `09/11/2026 à 23:34 - Mohamed: Salut tout le monde`,
  `09/11/2026 à 23:35 - Inès: <Médias omis>`,
  `10/11/2026 à 07:00 - Inès: Ce message a été supprimé`,
].join("\n");

const IOS_FR = [
  `[09/11/2026 23:34:12] Mohamed: Bonsoir`,
  `${LRM}[09/11/2026 23:35:00] Inès: ${LRM}audio omis`,
  `${LRM}[09/11/2026 23:36:00] Inès: ${LRM}image absente`,
].join("\n");

describe("parseChat", () => {
  it("parses iOS Dutch exports including system lines, media and multiline", () => {
    const r = parseChat(IOS_NL);
    expect(r.platform).toBe("ios");
    expect(r.dateOrder).toBe("DMY");
    expect(r.members).toEqual(["Sara", "Yassine"]);
    const user = r.messages.filter((m) => m.sender);
    expect(user).toHaveLength(6);
    expect(user[1].text).toBe("Insgelijks 🎉🎉\nen nog een regel");
    expect(user[2]).toMatchObject({ kind: "media", mediaType: "image" });
    expect(user[3]).toMatchObject({ kind: "media", mediaType: "audio" });
    expect(user[3].ts.getUTCHours()).toBe(23);
    expect(user[3].ts.getUTCDate()).toBe(13);
    expect(user[4].kind).toBe("deleted");
    expect(user[5]).toMatchObject({ kind: "text", text: "Wie komt er zaterdag?", edited: true });
    expect(r.messages.filter((m) => m.kind === "system")).toHaveLength(2);
  });

  it("parses Android Dutch exports", () => {
    const r = parseChat(ANDROID_NL);
    expect(r.platform).toBe("android");
    expect(r.members.sort()).toEqual(["Sara", "Yassine"]);
    const last = r.messages[r.messages.length - 1];
    expect(last.text).toBe("Zalig kerstfeest\ntweede regel");
    expect(last.ts.getUTCMonth()).toBe(11);
    expect(r.messages[2]).toMatchObject({ kind: "media", mediaType: "unknown" });
  });

  it("parses US Android exports with AM/PM and month-first dates", () => {
    const r = parseChat(ANDROID_US);
    expect(r.dateOrder).toBe("MDY");
    const late = r.messages.find((m) => m.text === "late night")!;
    expect(late.ts.getUTCHours()).toBe(0);
    expect(late.ts.getUTCDate()).toBe(13);
    const voice = r.messages.find((m) => m.mediaType === "audio")!;
    expect(voice.ts.getUTCHours()).toBe(12);
    const first = r.messages.find((m) => m.text === "hey")!;
    expect(first.ts.getUTCHours()).toBe(21);
  });

  it("parses French Android and iOS exports", () => {
    const a = parseChat(ANDROID_FR);
    expect(a.members.sort()).toEqual(["Inès", "Mohamed"]);
    expect(a.messages[1].kind).toBe("media");
    expect(a.messages[2].kind).toBe("deleted");
    const i = parseChat(IOS_FR);
    expect(i.messages[1]).toMatchObject({ kind: "media", mediaType: "audio" });
    expect(i.messages[2]).toMatchObject({ kind: "media", mediaType: "image" });
  });

  it("keeps colons inside message text", () => {
    const r = parseChat(`01-01-2026 10:01 - Sara: tijd: 10:30, plaats: station`);
    expect(r.messages[0]).toMatchObject({ sender: "Sara", text: "tijd: 10:30, plaats: station" });
  });

  it("rejects files that are not a chat export", () => {
    expect(() => parseChat("")).toThrow(ChatParseError);
    expect(() => parseChat("hallo dit is geen chat\nnog een regel")).toThrow(ChatParseError);
  });
});

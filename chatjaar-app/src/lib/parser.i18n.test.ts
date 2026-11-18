import { describe, expect, it } from "vitest";
import { parseChat } from "./parser";
import { LAUGH } from "./stats";

const LRM = "‎";

const ANDROID_DE = [
  `01.01.26, 10:00 - Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt.`,
  `01.01.26, 10:01 - Lena: Frohes neues Jahr!`,
  `01.01.26, 10:02 - Jonas: <Medien ausgeschlossen>`,
  `13.01.26, 23:15 - Lena: Diese Nachricht wurde gelöscht`,
  `14.01.26, 08:00 - Jonas: Wer kommt am Samstag? <Diese Nachricht wurde bearbeitet>`,
].join("\n");

const IOS_DE = [
  `[01.01.26, 10:00:00] Freunde: ${LRM}Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt.`,
  `[01.01.26, 10:01:00] Lena: Hallo zusammen`,
  `${LRM}[01.01.26, 10:02:00] Jonas: ${LRM}Bild weggelassen`,
  `${LRM}[01.01.26, 10:03:00] Jonas: ${LRM}Audio weggelassen`,
  `${LRM}[01.01.26, 10:04:00] Lena: ${LRM}Sticker weggelassen`,
].join("\n");

const ANDROID_ES = [
  `1/1/26, 10:00 - Los mensajes y las llamadas están cifrados de extremo a extremo.`,
  `1/1/26, 10:01 - Lucía: ¡Feliz año!`,
  `1/1/26, 10:02 - Pablo: <Multimedia omitido>`,
  `13/1/26, 23:15 - Lucía: Se eliminó este mensaje.`,
  `14/1/26, 21:47 - Pablo: jajaja vale <Se editó este mensaje.>`,
].join("\n");

const IOS_ES = [
  `[1/1/26, 10:00:00] Amigos: ${LRM}Los mensajes y las llamadas están cifrados de extremo a extremo.`,
  `[13/1/26, 10:01:00] Lucía: Hola`,
  `${LRM}[13/1/26, 10:02:00] Pablo: ${LRM}imagen omitida`,
  `${LRM}[13/1/26, 10:03:00] Pablo: ${LRM}audio omitido`,
  `${LRM}[13/1/26, 10:04:00] Lucía: ${LRM}Eliminaste este mensaje.`,
].join("\n");

describe("parser: German and Spanish exports", () => {
  it("parses Android DE (dots in date, media, deleted, edited)", () => {
    const r = parseChat(ANDROID_DE);
    expect(r.members.sort()).toEqual(["Jonas", "Lena"]);
    expect(r.dateOrder).toBe("DMY");
    const kinds = r.messages.filter((m) => m.sender).map((m) => m.kind);
    expect(kinds).toEqual(["text", "media", "deleted", "text"]);
    const edited = r.messages.find((m) => m.edited);
    expect(edited?.text).toBe("Wer kommt am Samstag?");
    expect(r.messages[r.messages.length - 1].ts.getUTCDate()).toBe(14);
  });

  it("parses iOS DE media types", () => {
    const r = parseChat(IOS_DE);
    const media = r.messages.filter((m) => m.kind === "media").map((m) => m.mediaType);
    expect(media).toEqual(["image", "audio", "sticker"]);
    expect(r.members).not.toContain("Freunde");
  });

  it("parses Android ES (media, deleted, edited)", () => {
    const r = parseChat(ANDROID_ES);
    expect(r.members.sort()).toEqual(["Lucía", "Pablo"]);
    const kinds = r.messages.filter((m) => m.sender).map((m) => m.kind);
    expect(kinds).toEqual(["text", "media", "deleted", "text"]);
    expect(r.messages.find((m) => m.edited)?.text).toBe("jajaja vale");
    expect(r.dateOrder).toBe("DMY");
  });

  it("parses iOS ES media types and own deletions", () => {
    const r = parseChat(IOS_ES);
    expect(r.messages.filter((m) => m.kind === "media").map((m) => m.mediaType)).toEqual(["image", "audio"]);
    expect(r.messages.filter((m) => m.kind === "deleted")).toHaveLength(1);
  });

  it("detects Spanish laughter", () => {
    expect(LAUGH.test("jajaja qué bueno")).toBe(true);
    expect(LAUGH.test("jejeje")).toBe(true);
    expect(LAUGH.test("ja ich komme")).toBe(false);
  });
});

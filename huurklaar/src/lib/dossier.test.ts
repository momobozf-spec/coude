import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildLetter, EXAMPLE, restore } from "./dossier";
import { getDict } from "./i18n";
import { buildDossierPdf } from "./pdf";

describe("buildLetter", () => {
  it("vult alle plaatshouders in, NL en FR", () => {
    for (const l of ["nl", "fr"] as const) {
      const letter = buildLetter(EXAMPLE, getDict(l).d, l);
      expect(letter).not.toMatch(/\{\w+\}/);
      expect(letter).toContain("Sara Peeters");
      expect(letter).toContain("Lange Kievitstraat 12");
    }
  });
  it("noemt de verhouding inkomen/maandlast correct", () => {
    // 3.800 / 1.010 = 3,76
    expect(buildLetter(EXAMPLE, getDict("nl").d, "nl")).toContain("3,8 keer");
  });
});

describe("restore", () => {
  it("weigert rommel en herstelt geldige velden", () => {
    expect(restore(null)).toBeNull();
    const r = restore({ rent: 900, region: "XX", docs: ["d_id", "hack"], job: "boss", about: 42 });
    expect(r?.rent).toBe(900);
    expect(r?.region).toBe("VL");
    expect(r?.docs).toEqual(["d_id"]);
    expect(r?.job).toBe("vast");
    expect(r?.about).toBe("");
  });
});

describe("buildDossierPdf", () => {
  it("maakt een geldige PDF met bijlagen en vreemde tekens", async () => {
    const att = await PDFDocument.create();
    att.addPage();
    att.addPage();
    const attBytes = await att.save();
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
    const bytes = await buildDossierPdf({
      title: "Huurders-cv",
      name: "Sara Peeters – مرحبا 😀",
      forLine: "Kandidatuur voor: Lange Kievitstraat 12",
      facts: [["Huishouden", "2"], ["Netto-inkomen", "€ 3.800 / m"]],
      contact: "sara@example.com",
      letter: "Beste verhuurder,\n\nDit is een test met een héél lang woord: " + "x".repeat(300),
      attachments: [
        { label: "Loonfiche", file: new File([attBytes as BlobPart], "loon.pdf", { type: "application/pdf" }) },
        { label: "ID", file: new File([png], "id.png", { type: "image/png" }) },
      ],
      attachmentsLabel: "Bijlagen",
    });
    const doc = await PDFDocument.load(bytes);
    // cv + brief + 2 pdf-pagina's + 1 afbeelding
    expect(doc.getPageCount()).toBe(5);
  });
});

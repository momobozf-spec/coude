// Dossier-PDF, volledig in de browser gemaakt. Bijlagen verlaten het toestel niet.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfAttachment {
  label: string;
  file: File;
}
export interface PdfInput {
  title: string;
  name: string;
  forLine: string;
  facts: [string, string][];
  contact: string;
  letter: string;
  attachments: PdfAttachment[];
  attachmentsLabel: string;
}

const A4: [number, number] = [595.28, 841.89];
const M = 56;
const INK = rgb(0.08, 0.14, 0.17);
const MUTED = rgb(0.34, 0.4, 0.43);
const ACCENT = rgb(0.7, 0.27, 0.18);

export async function buildDossierPdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.title} – ${input.name}`);
  pdf.setCreator("Huurklaar");
  pdf.setProducer("Huurklaar");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = makeSanitizer(regular);

  // Pagina 1: huurders-cv
  let page = pdf.addPage(A4);
  let y = A4[1] - M;
  page.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: ACCENT });
  page.drawText(safe(input.title.toUpperCase()), { x: M, y: (y -= 6), size: 9, font: bold, color: ACCENT });
  page.drawText(safe(input.name), { x: M, y: (y -= 34), size: 26, font: bold, color: INK });
  y -= 22;
  y = paragraph(page, safe(input.forLine), M, y, A4[0] - 2 * M, regular, 11, MUTED);
  y -= 18;
  const colW = (A4[0] - 2 * M - 24) / 2;
  input.facts.forEach(([k, v], i) => {
    const col = i % 2;
    const x = M + col * (colW + 24);
    if (col === 0 && i > 0) y -= 50;
    page.drawLine({ start: { x, y }, end: { x: x + colW, y }, thickness: 0.6, color: rgb(0.85, 0.88, 0.89) });
    page.drawText(safe(k.toUpperCase()), { x, y: y - 14, size: 8, font: bold, color: MUTED });
    page.drawText(safe(v), { x, y: y - 31, size: 13, font: regular, color: INK, maxWidth: colW });
  });
  y -= 72;
  if (input.contact) y = paragraph(page, safe(input.contact), M, y, A4[0] - 2 * M, regular, 11, INK);
  if (input.attachments.length) {
    y -= 20;
    page.drawText(safe(input.attachmentsLabel.toUpperCase()), { x: M, y, size: 8, font: bold, color: MUTED });
    y -= 16;
    input.attachments.forEach((a, i) => {
      y = paragraph(page, safe(`${i + 1}. ${a.label} – ${a.file.name}`), M, y, A4[0] - 2 * M, regular, 10, INK) - 2;
    });
  }

  // Pagina 2+: motivatiebrief
  page = pdf.addPage(A4);
  y = A4[1] - M;
  for (const block of input.letter.split("\n")) {
    if (!block.trim()) { y -= 10; continue; }
    const lines = wrap(safe(block), regular, 11, A4[0] - 2 * M);
    for (const line of lines) {
      if (y < M + 14) { page = pdf.addPage(A4); y = A4[1] - M; }
      page.drawText(line, { x: M, y, size: 11, font: regular, color: INK });
      y -= 16;
    }
  }

  // Bijlagen
  for (const a of input.attachments) {
    const bytes = new Uint8Array(await a.file.arrayBuffer());
    const type = a.file.type || guessType(a.file.name);
    if (type === "application/pdf") {
      const src = await PDFDocument.load(bytes);
      const copied = await pdf.copyPages(src, src.getPageIndices());
      copied.forEach((p) => pdf.addPage(p));
    } else if (type === "image/jpeg" || type === "image/png") {
      const img = type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const p = pdf.addPage(A4);
      const maxW = A4[0] - 2 * M, maxH = A4[1] - 2 * M - 20;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      p.drawText(safe(a.label), { x: M, y: A4[1] - M + 4, size: 9, font: bold, color: MUTED });
      p.drawImage(img, { x: (A4[0] - w) / 2, y: A4[1] - M - 14 - h, width: w, height: h });
    }
  }

  // Paginanummers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: A4[0] - M - regular.widthOfTextAtSize(label, 8), y: 24, size: 8, font: regular, color: MUTED });
  });

  return pdf.save();
}

export function guessType(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "";
}

function paragraph(page: PDFPage, text: string, x: number, y: number, w: number, font: PDFFont, size: number, color = INK) {
  for (const line of wrap(text, font, size, w)) {
    page.drawText(line, { x, y, size, font, color });
    y -= size * 1.45;
  }
  return y;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
      while (font.widthOfTextAtSize(cur, size) > width && cur.length > 1) {
        let cut = cur.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(cur.slice(0, cut), size) > width) cut--;
        lines.push(cur.slice(0, cut));
        cur = cur.slice(cut);
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Standaardfonts kennen alleen WinAnsi-tekens; vervang de rest zodat de PDF niet faalt. */
function makeSanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  const map: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", " ": " " };
  return (s: string) =>
    Array.from(s.replace(/\r/g, ""))
      .map((ch) => {
        const cp = ch.codePointAt(0)!;
        if (supported.has(cp)) return ch;
        if (map[ch] && supported.has(map[ch].codePointAt(0)!)) return map[ch];
        return ch === "\t" ? " " : "?";
      })
      .join("");
}

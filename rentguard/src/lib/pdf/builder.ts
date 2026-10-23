import 'server-only';

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from 'pdf-lib';

/**
 * Gedeelde PDF-opbouw voor rapporten en brieven.
 *
 * Bewust met de standaardlettertypes van PDF: die vergen geen extern bestand en
 * dekken met WinAnsi de Nederlandse en Franse tekens. Tekens die WinAnsi niet
 * kent, worden vervangen in plaats van de generatie te laten crashen — een
 * rapport dat niet gemaakt wordt, helpt niemand.
 */

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = 50;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

export const COLORS = {
  text: rgb(0.06, 0.09, 0.16),
  muted: rgb(0.39, 0.45, 0.55),
  line: rgb(0.85, 0.88, 0.92),
  warning: rgb(0.55, 0.34, 0.02),
  box: rgb(0.97, 0.98, 0.99),
} as const;

/**
 * Vervangt tekens die de standaardlettertypes niet kunnen weergeven.
 * Zonder dit werpt pdf-lib bij bijvoorbeeld een smalle spatie uit een
 * gekopieerde tekst.
 */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–]/g, '-')
    .replace(/[—]/g, '--')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
}

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

export class PdfBuilder {
  readonly doc: PDFDocument;
  readonly fonts: PdfFonts;
  private page: PDFPage;
  private cursorY: number;
  private pageNumber = 1;
  private readonly footerText: string;

  private constructor(doc: PDFDocument, fonts: PdfFonts, footerText: string) {
    this.doc = doc;
    this.fonts = fonts;
    this.footerText = footerText;
    this.page = doc.addPage([A4.width, A4.height]);
    this.cursorY = A4.height - MARGIN;
    this.drawFooter();
  }

  static async create(footerText: string): Promise<PdfBuilder> {
    const doc = await PDFDocument.create();
    const fonts: PdfFonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      mono: await doc.embedFont(StandardFonts.Courier),
    };
    return new PdfBuilder(doc, fonts, footerText);
  }

  get currentPage(): PDFPage {
    return this.page;
  }

  get y(): number {
    return this.cursorY;
  }

  /** Ruimte die nog beschikbaar is boven de voettekst. */
  get remaining(): number {
    return this.cursorY - (MARGIN + 34);
  }

  newPage(): void {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.cursorY = A4.height - MARGIN;
    this.pageNumber += 1;
    this.drawFooter();
  }

  ensure(space: number): void {
    if (this.remaining < space) this.newPage();
  }

  move(delta: number): void {
    this.cursorY -= delta;
  }

  private drawFooter(): void {
    const size = 7.5;
    const lines = wrapText(
      toWinAnsi(this.footerText),
      this.fonts.regular,
      size,
      CONTENT_WIDTH - 40,
    );

    this.page.drawLine({
      start: { x: MARGIN, y: MARGIN + 26 },
      end: { x: A4.width - MARGIN, y: MARGIN + 26 },
      thickness: 0.5,
      color: COLORS.line,
    });

    lines.slice(0, 2).forEach((line, index) => {
      this.page.drawText(line, {
        x: MARGIN,
        y: MARGIN + 14 - index * 9,
        size,
        font: this.fonts.regular,
        color: COLORS.muted,
      });
    });

    this.page.drawText(String(this.pageNumber), {
      x: A4.width - MARGIN - 10,
      y: MARGIN + 14,
      size,
      font: this.fonts.regular,
      color: COLORS.muted,
    });
  }

  heading(text: string, size = 16): void {
    this.ensure(size + 14);
    this.page.drawText(toWinAnsi(text), {
      x: MARGIN,
      y: this.cursorY - size,
      size,
      font: this.fonts.bold,
      color: COLORS.text,
    });
    this.cursorY -= size + 10;
  }

  paragraph(
    text: string,
    options: { size?: number; color?: RGB; font?: PDFFont; indent?: number } = {},
  ): void {
    const size = options.size ?? 10;
    const font = options.font ?? this.fonts.regular;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.45;

    const lines = wrapText(
      toWinAnsi(text),
      font,
      size,
      CONTENT_WIDTH - indent,
    );

    for (const line of lines) {
      this.ensure(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.cursorY - size,
        size,
        font,
        color: options.color ?? COLORS.text,
      });
      this.cursorY -= lineHeight;
    }
  }

  bullets(items: string[], options: { size?: number; color?: RGB } = {}): void {
    for (const item of items) {
      this.paragraph(`- ${item}`, { ...options, indent: 10 });
    }
  }

  keyValue(label: string, value: string): void {
    const size = 10;
    const lineHeight = size * 1.5;
    this.ensure(lineHeight);

    this.page.drawText(toWinAnsi(label), {
      x: MARGIN,
      y: this.cursorY - size,
      size,
      font: this.fonts.regular,
      color: COLORS.muted,
    });

    const valueLines = wrapText(
      toWinAnsi(value),
      this.fonts.bold,
      size,
      CONTENT_WIDTH - 170,
    );

    valueLines.forEach((line, index) => {
      if (index > 0) this.ensure(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + 170,
        y: this.cursorY - size - index * lineHeight,
        size,
        font: this.fonts.bold,
        color: COLORS.text,
      });
    });

    this.cursorY -= lineHeight * valueLines.length;
  }

  divider(): void {
    this.ensure(14);
    this.page.drawLine({
      start: { x: MARGIN, y: this.cursorY - 6 },
      end: { x: A4.width - MARGIN, y: this.cursorY - 6 },
      thickness: 0.5,
      color: COLORS.line,
    });
    this.cursorY -= 14;
  }

  /** Kader met een titel, voor waarschuwingen en toelichtingen. */
  box(title: string, lines: string[], tone: 'neutral' | 'warning' = 'neutral'): void {
    const size = 9.5;
    const lineHeight = size * 1.45;
    const wrapped = lines.flatMap((line) =>
      wrapText(toWinAnsi(line), this.fonts.regular, size, CONTENT_WIDTH - 24),
    );
    const height = 20 + wrapped.length * lineHeight + 12;

    this.ensure(height + 8);

    const top = this.cursorY;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: COLORS.box,
      borderColor: tone === 'warning' ? COLORS.warning : COLORS.line,
      borderWidth: tone === 'warning' ? 1 : 0.5,
    });

    this.page.drawText(toWinAnsi(title), {
      x: MARGIN + 12,
      y: top - 16,
      size: 10,
      font: this.fonts.bold,
      color: tone === 'warning' ? COLORS.warning : COLORS.text,
    });

    wrapped.forEach((line, index) => {
      this.page.drawText(line, {
        x: MARGIN + 12,
        y: top - 30 - index * lineHeight,
        size,
        font: this.fonts.regular,
        color: COLORS.text,
      });
    });

    this.cursorY = top - height - 10;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current !== '') lines.push(current);

      // Een enkel woord dat te lang is (bv. een hash) breken wij hard af.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
    if (current !== '') lines.push(current);
  }

  return lines;
}

/**
 * Zet een afbeelding om naar iets dat pdf-lib kan insluiten.
 *
 * JPEG en PNG gaan rechtstreeks. WebP wordt omgezet naar JPEG. Lukt het niet,
 * dan geven wij null terug: het rapport vermeldt de foto dan met haar hash en
 * tijdstempel, met de melding dat de afbeelding niet kon worden weergegeven.
 * Stil weglaten zou het dossier onvolledig maken zonder dat iemand het merkt.
 */
export async function toEmbeddable(
  bytes: Uint8Array,
  contentType: string,
  maxWidthPx = 1400,
): Promise<{ bytes: Uint8Array; format: 'jpg' | 'png' } | null> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(Buffer.from(bytes), { failOn: 'none' });
    const metadata = await image.metadata();

    const resized =
      metadata.width && metadata.width > maxWidthPx
        ? image.resize({ width: maxWidthPx })
        : image;

    if (contentType === 'image/png') {
      return { bytes: new Uint8Array(await resized.png().toBuffer()), format: 'png' };
    }

    return {
      bytes: new Uint8Array(await resized.jpeg({ quality: 82 }).toBuffer()),
      format: 'jpg',
    };
  } catch {
    return null;
  }
}

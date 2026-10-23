/**
 * A minimal PDF writer.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * No PDF library is installed, and pulling one in is a dependency decision that
 * belongs to whoever owns the deployment. The alternative — shipping a mock and
 * calling it "PDF support" — would mean the product claims a capability it does
 * not have. So this writes real PDF 1.4 bytes: a file that opens in any reader.
 *
 * ── What it is not ───────────────────────────────────────────────────────────
 * It handles left-aligned text in the 14 standard fonts, and nothing else. No
 * images, no tables, no wrapping beyond what the caller does, no Unicode beyond
 * WinAnsi. Anything richer means adopting a real library, and this file is
 * deliberately small enough to throw away when that happens.
 *
 * Pure: bytes in, bytes out, no I/O.
 */

export interface PdfLine {
  text: string
  /** Points. Defaults to 11. */
  size?: number
  bold?: boolean
  /** Extra vertical space before this line, in points. */
  spaceBefore?: number
}

export interface PdfDocumentInput {
  title: string
  lines: readonly PdfLine[]
}

const PAGE_WIDTH = 595 // A4 at 72 dpi
const PAGE_HEIGHT = 842
const MARGIN = 56
const DEFAULT_SIZE = 11
const LINE_GAP = 5

/**
 * WinAnsi-safe text.
 *
 * The standard fonts cannot represent characters outside WinAnsiEncoding, and a
 * silently mangled byte would corrupt the file. Unsupported characters are
 * transliterated where there is an obvious equivalent and dropped otherwise.
 */
function encodeText(text: string): string {
  return text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    // Currency symbols become codes. The trailing `\s*` is deliberate: it
    // absorbs a space that is already there, so "€ 10" and "€10" both render as
    // "EUR 10" rather than one of them picking up a double space.
    .replace(/€\s*/g, 'EUR ')
    .replace(/£\s*/g, 'GBP ')
    .replace(/₺\s*/g, 'TRY ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    // PDF string literals: these three characters must be escaped.
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

interface Page {
  content: string
}

export function renderPdf(input: PdfDocumentInput): Buffer {
  const pages: Page[] = []

  let stream = ''
  let cursorY = PAGE_HEIGHT - MARGIN

  const flushPage = () => {
    if (stream.length > 0) pages.push({ content: stream })
    stream = ''
    cursorY = PAGE_HEIGHT - MARGIN
  }

  for (const line of input.lines) {
    const size = line.size ?? DEFAULT_SIZE
    const advance = size + LINE_GAP + (line.spaceBefore ?? 0)

    // Break the page before drawing, so a line is never clipped at the bottom.
    if (cursorY - advance < MARGIN) flushPage()

    cursorY -= advance

    const font = line.bold ? '/F2' : '/F1'
    stream +=
      `BT ${font} ${size} Tf 1 0 0 1 ${MARGIN} ${cursorY.toFixed(2)} Tm ` +
      `(${encodeText(line.text)}) Tj ET\n`
  }

  flushPage()
  if (pages.length === 0) pages.push({ content: '' })

  return assemble(input.title, pages)
}

/**
 * Build the PDF file structure.
 *
 * Objects are written in order and their byte offsets recorded, because the
 * cross-reference table at the end must point at each one exactly.
 */
function assemble(title: string, pages: readonly Page[]): Buffer {
  const chunks: Buffer[] = []
  const offsets: number[] = []
  let position = 0

  const push = (text: string) => {
    const buffer = Buffer.from(text, 'latin1')
    chunks.push(buffer)
    position += buffer.length
  }

  const pushObject = (index: number, body: string) => {
    offsets[index] = position
    push(`${index} 0 obj\n${body}\nendobj\n`)
  }

  push('%PDF-1.4\n')
  // A binary comment marks the file as non-ASCII for transfer tools.
  push('%\xE2\xE3\xCF\xD3\n')

  // 1 catalog, 2 pages tree, 3 font, 4 bold font, then per page: page + content.
  const firstPageObject = 5
  const pageIds = pages.map((_, i) => firstPageObject + i * 2)
  const contentIds = pages.map((_, i) => firstPageObject + i * 2 + 1)

  pushObject(1, '<< /Type /Catalog /Pages 2 0 R >>')

  pushObject(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )

  pushObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  pushObject(
    4,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  )

  pages.forEach((page, index) => {
    const pageId = pageIds[index] as number
    const contentId = contentIds[index] as number

    pushObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    )

    const content = page.content
    pushObject(
      contentId,
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
    )
  })

  const infoId = firstPageObject + pages.length * 2
  pushObject(infoId, `<< /Title (${encodeText(title)}) /Producer (Barakah) >>`)

  const objectCount = infoId + 1
  const xrefPosition = position

  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`
  for (let i = 1; i < objectCount; i += 1) {
    xref += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`
  }
  push(xref)

  push(
    `trailer\n<< /Size ${objectCount} /Root 1 0 R /Info ${infoId} 0 R >>\n` +
      `startxref\n${xrefPosition}\n%%EOF\n`,
  )

  return Buffer.concat(chunks)
}

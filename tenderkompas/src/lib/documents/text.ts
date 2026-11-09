/**
 * Tekstextractie met expliciete dekkingsstatus. Een onleesbaar of slecht leesbaar document
 * mag nooit leiden tot onterechte zekerheid: de status wordt in de beoordeling meegenomen.
 */
export type TextExtraction = {
  status: "ok" | "low_coverage" | "failed";
  detail: string;
  pages: string[];
  pageCount: number;
  textChars: number;
};

export const ALLOWED_UPLOAD_TYPES = {
  "application/pdf": "pdf",
  "text/plain": "txt",
} as const;

export function sniffType(buf: Buffer, declared: string): keyof typeof ALLOWED_UPLOAD_TYPES | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (declared === "text/plain" || declared === "") {
    if (buf.includes(0)) return null;
    return "text/plain";
  }
  return null;
}

export async function extractText(buf: Buffer, mime: keyof typeof ALLOWED_UPLOAD_TYPES): Promise<TextExtraction> {
  if (mime === "text/plain") {
    const text = buf.toString("utf8");
    const chars = text.replace(/\s/g, "").length;
    return chars > 0
      ? { status: "ok", detail: "Tekstbestand", pages: [text], pageCount: 1, textChars: text.length }
      : { status: "failed", detail: "Leeg tekstbestand", pages: [], pageCount: 0, textChars: 0 };
  }
  try {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await pdfExtract(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t) => t ?? "");
    const charsPerPage = pages.map((p) => p.replace(/\s/g, "").length);
    const total = charsPerPage.reduce((a, b) => a + b, 0);
    const sparse = charsPerPage.filter((c) => c < 50).length;
    if (totalPages === 0 || total === 0)
      return { status: "failed", detail: "Geen tekst gevonden (mogelijk gescand document zonder tekstlaag).", pages, pageCount: totalPages, textChars: 0 };
    const avg = total / totalPages;
    if (avg < 200 || sparse / totalPages > 0.3)
      return {
        status: "low_coverage",
        detail: `Beperkte tekstdekking: gemiddeld ${Math.round(avg)} tekens/pagina, ${sparse} van ${totalPages} pagina's (bijna) zonder tekst.`,
        pages,
        pageCount: totalPages,
        textChars: total,
      };
    return { status: "ok", detail: `${totalPages} pagina's, ${total} tekens`, pages, pageCount: totalPages, textChars: total };
  } catch (e) {
    return { status: "failed", detail: `PDF kon niet gelezen worden: ${e instanceof Error ? e.message.slice(0, 200) : "onbekende fout"}`, pages: [], pageCount: 0, textChars: 0 };
  }
}

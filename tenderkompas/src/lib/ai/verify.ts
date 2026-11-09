import type { ExtractionOutput } from "./schema";

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’“”]/g, "'")
    .replace(/[-‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministische bewijscontrole: het citaat moet letterlijk (genormaliseerd) in het opgegeven document staan.
 * Zo worden verzonnen waarden of citaten onderschept; de beheerder verifieert daarna inhoudelijk.
 */
export function quoteFound(quote: string, docPages: string[] | undefined, page: number | null): { found: boolean; page: number | null } {
  if (!docPages || !quote.trim()) return { found: false, page: null };
  const q = norm(quote);
  if (q.length < 8) return { found: false, page: null };
  if (page && docPages[page - 1] && norm(docPages[page - 1]).includes(q)) return { found: true, page };
  const idx = docPages.findIndex((p) => norm(p).includes(q));
  if (idx >= 0) return { found: true, page: idx + 1 };
  // Citaat over paginagrens
  if (norm(docPages.join(" ")).includes(q)) return { found: true, page: null };
  return { found: false, page: null };
}

/** Controleert dat de opgegeven waarde zelf in het citaat voorkomt (voorkomt "juist citaat, verkeerde waarde"). */
export function valueInQuote(raw: string, quote: string): boolean {
  const digits = raw.match(/\d+/g);
  if (!digits) return norm(quote).includes(norm(raw));
  const q = quote.replace(/[\s.,]/g, "");
  return digits.every((d) => q.includes(d));
}

export type VerifiedItem<T> = T & { verificationStatus: "unverified" | "evidence_not_found"; verifiedPage: number | null; issues: string[] };

export function verifyExtraction(out: ExtractionOutput, docs: Map<string, { pages: string[]; textStatus: string }>) {
  const issues: string[] = [];
  const facts = out.facts.map((f) => {
    const d = docs.get(f.evidence.document_id);
    const res = quoteFound(f.evidence.quote, d?.pages, f.evidence.page);
    const itemIssues: string[] = [];
    if (!d) itemIssues.push("onbekend document-ID");
    if (!res.found) itemIssues.push("citaat niet teruggevonden in document");
    if (res.found && !valueInQuote(f.raw_value, f.evidence.quote)) itemIssues.push("waarde komt niet voor in citaat");
    if (itemIssues.length) issues.push(`feit ${f.key}: ${itemIssues.join(", ")}`);
    return {
      ...f,
      verificationStatus: (itemIssues.length ? "evidence_not_found" : "unverified") as "unverified" | "evidence_not_found",
      verifiedPage: res.page,
      issues: itemIssues,
    };
  });
  const requirements = out.requirements.map((r) => {
    const d = docs.get(r.evidence.document_id);
    const res = quoteFound(r.evidence.quote, d?.pages, r.evidence.page);
    const itemIssues: string[] = [];
    if (!d) itemIssues.push("onbekend document-ID");
    if (!res.found) itemIssues.push("citaat niet teruggevonden in document");
    let consortium = r.consortium;
    if (consortium === "documented") {
      const cq = r.consortium_quote ? quoteFound(r.consortium_quote, d?.pages, null) : { found: false };
      if (!cq.found) {
        consortium = "unknown"; // samenwerking enkel als de bron het aantoonbaar vermeldt
        itemIssues.push("citaat over samenwerking niet teruggevonden → 'te controleren'");
      }
    }
    if (itemIssues.length) issues.push(`voorwaarde "${r.text.slice(0, 50)}": ${itemIssues.join(", ")}`);
    return {
      ...r,
      consortium,
      verificationStatus: (!res.found || !d ? "evidence_not_found" : "unverified") as "unverified" | "evidence_not_found",
      verifiedPage: res.page,
      issues: itemIssues,
    };
  });
  return { facts, requirements, issues };
}

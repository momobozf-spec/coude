import type { document as documentTable, fact as factTable, notice as noticeTable, requirement as requirementTable } from "@/db/schema";
import { describeDeadline, formatBrussels } from "@/lib/time";
import { FACT_LABEL, money } from "@/lib/labels";
import { VerificationBadge } from "./ui";

type Fact = typeof factTable.$inferSelect;
type Req = typeof requirementTable.$inferSelect;
type Doc = typeof documentTable.$inferSelect;
type Notice = typeof noticeTable.$inferSelect;

const DEADLINE_KEYS = new Set(["submission_deadline", "participation_deadline", "questions_deadline"]);

export function FactValue({ f }: { f: Fact }) {
  if (DEADLINE_KEYS.has(f.key)) {
    const d = describeDeadline(f);
    return (
      <span>
        <span className="font-medium">{d.label}</span>
        {d.caveat && <span className="block text-xs text-warn-700">{d.caveat}</span>}
        <span className="block text-xs text-muted">Bronwaarde: “{f.rawValue}”</span>
      </span>
    );
  }
  if (f.valueNumber !== null && (f.key.endsWith("value") || f.key === "published_budget")) {
    return (
      <span>
        <span className="font-medium">{money(f.valueNumber, f.unit)}</span>
        {!f.unit && <span className="block text-xs text-warn-700">munteenheid niet vermeld</span>}
        {f.key === "framework_max_value" && <span className="block text-xs text-muted">Plafond voor alle opdrachtnemers samen; geen gegarandeerde omzet.</span>}
      </span>
    );
  }
  return <span className="font-medium">{f.rawValue}</span>;
}

/** Herleidbaarheid: officiële bron, documentversie, locatie, citaat, extractie- en verificatiestatus. */
export function Evidence({
  item,
  docs,
  notices,
  docHref,
}: {
  item: Pick<Fact, "locator" | "evidenceSnippet" | "documentId" | "documentVersion" | "sourceNoticeId" | "extractionMethod" | "verificationStatus">;
  docs: Doc[];
  notices: Notice[];
  docHref?: (id: string) => string;
}) {
  const doc = item.documentId ? docs.find((d) => d.id === item.documentId) : null;
  const n = item.sourceNoticeId ? notices.find((x) => x.id === item.sourceNoticeId) : null;
  return (
    <div className="space-y-1 text-xs">
      <VerificationBadge status={item.verificationStatus} method={item.extractionMethod} />
      {n && (
        <div className="text-muted">
          Publicatie {n.url ? <a className="underline" href={n.url} target="_blank" rel="noreferrer noopener">{n.publicationNumber}</a> : n.publicationNumber}
          {n.publicationDateRaw ? ` (${n.publicationDateRaw})` : ""}
        </div>
      )}
      {doc && (
        <div className="text-muted">
          Document {docHref ? <a className="underline" href={docHref(doc.id)}>{doc.filename}</a> : doc.filename} v{item.documentVersion ?? doc.version}
        </div>
      )}
      {item.locator && <div className="text-muted">Locatie: {item.locator}</div>}
      {item.evidenceSnippet && <blockquote className="border-l-2 border-navy-100 pl-2 italic text-ink/80">“{item.evidenceSnippet}”</blockquote>}
    </div>
  );
}

export function LastChecked({ at }: { at: Date | null }) {
  return <span className="text-xs text-muted">Laatste controle bron: {at ? formatBrussels(at) : "onbekend"}</span>;
}

export function factsVisible(facts: Fact[]) {
  return facts.filter((f) => !f.supersededAt);
}
export function requirementsVisible(reqs: Req[]) {
  return reqs.filter((r) => !r.supersededAt);
}
export { FACT_LABEL };

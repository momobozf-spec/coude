import { ADVICE_LABEL } from "./assessment-engine";
import type { Advice } from "@/db/schema";
import { formatBrussels } from "@/lib/time";

export type DigestItem = {
  title: string;
  buyerName: string | null;
  advice: Advice;
  relevanceScore: number | null;
  nextDeadlineLabel: string;
  deadlineCaveat: string | null;
  fitExplanation: string | null;
  nextAction: string | null;
  url: string;
  changePending?: boolean;
  changeNote?: string | null;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const FOOTER =
  "TenderKompas IT selecteert uit de bronnen die wij opvolgen (zie portaal → Bronnen). Wij geven geen garantie op volledigheid, toelating of het winnen van opdrachten. De relevantiescore is geen winkans.";

export function renderDigest(input: {
  kind: "weekly" | "change_alert";
  organizationName: string;
  periodStart: Date;
  periodEnd: Date;
  items: DigestItem[];
  intro?: string | null;
  portalUrl: string;
}) {
  const period = `${formatBrussels(input.periodStart, false)} – ${formatBrussels(input.periodEnd, false)}`;
  const subject =
    input.kind === "weekly"
      ? input.items.length
        ? `TenderKompas: ${input.items.length} gecontroleerde kans${input.items.length === 1 ? "" : "en"} (${period})`
        : `TenderKompas: deze week geen geschikte kansen (${period})`
      : `TenderKompas: wijziging bij ${input.items.length} gevolgde opdracht${input.items.length === 1 ? "" : "en"}`;

  const emptyText =
    input.kind === "weekly"
      ? "Deze week hebben we geen opdrachten gevonden die na controle voldoende aansluiten bij uw profiel. We sturen liever niets dan iets dat u tijd kost. Uw profiel bijwerken kan de selectie verbeteren."
      : "Geen wijzigingen bij gevolgde opdrachten.";

  const lines: string[] = [];
  lines.push(`Selectie voor ${input.organizationName} — ${period}`);
  if (input.intro) lines.push("", input.intro);
  lines.push("");
  if (!input.items.length) lines.push(emptyText);
  input.items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title}`);
    if (it.buyerName) lines.push(`   Opdrachtgever: ${it.buyerName}`);
    lines.push(`   Advies: ${ADVICE_LABEL[it.advice]}${it.relevanceScore !== null ? ` · relevantiescore ${it.relevanceScore}/100 (geen winkans)` : ""}`);
    lines.push(`   Eerstvolgende deadline: ${it.nextDeadlineLabel}${it.deadlineCaveat ? ` (${it.deadlineCaveat})` : ""}`);
    if (it.changePending) lines.push(`   Let op: ${it.changeNote ?? "een wijziging in de bron wordt nog gecontroleerd."}`);
    if (it.fitExplanation) lines.push(`   Waarom: ${it.fitExplanation}`);
    if (it.nextAction) lines.push(`   Volgende stap: ${it.nextAction}`);
    lines.push(`   Details: ${it.url}`, "");
  });
  lines.push("", `Portaal: ${input.portalUrl}`, "", FOOTER);
  const textBody = lines.join("\n");

  const card = (it: DigestItem) => `
  <tr><td style="padding:16px;border:1px solid #dbe2ea;border-radius:8px;background:#ffffff">
    <div style="font-size:16px;font-weight:600;color:#0b2545">${escapeHtml(it.title)}</div>
    ${it.buyerName ? `<div style="color:#475569;font-size:13px;margin-top:2px">${escapeHtml(it.buyerName)}</div>` : ""}
    <div style="margin-top:8px;font-size:13px;color:#0f172a"><strong>Advies:</strong> ${escapeHtml(ADVICE_LABEL[it.advice])}${
      it.relevanceScore !== null ? ` · relevantiescore ${it.relevanceScore}/100 <span style="color:#64748b">(geen winkans)</span>` : ""
    }</div>
    <div style="font-size:13px;color:#0f172a"><strong>Eerstvolgende deadline:</strong> ${escapeHtml(it.nextDeadlineLabel)}${
      it.deadlineCaveat ? ` <span style="color:#92400e">(${escapeHtml(it.deadlineCaveat)})</span>` : ""
    }</div>
    ${it.changePending ? `<div style="margin-top:6px;font-size:13px;color:#92400e;background:#fef3c7;padding:6px 8px;border-radius:4px">${escapeHtml(it.changeNote ?? "Een wijziging in de bron wordt nog gecontroleerd.")}</div>` : ""}
    ${it.fitExplanation ? `<div style="margin-top:8px;font-size:13px;color:#334155">${escapeHtml(it.fitExplanation)}</div>` : ""}
    ${it.nextAction ? `<div style="margin-top:6px;font-size:13px;color:#334155"><strong>Volgende stap:</strong> ${escapeHtml(it.nextAction)}</div>` : ""}
    <div style="margin-top:10px"><a href="${escapeHtml(it.url)}" style="color:#1d4ed8;font-size:13px">Bekijk details en bronnen →</a></div>
  </td></tr><tr><td style="height:12px"></td></tr>`;

  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f4f6f9;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#0b2545;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0">
  <div style="font-size:18px;font-weight:600">TenderKompas IT</div>
  <div style="font-size:13px;opacity:.85">${escapeHtml(input.kind === "weekly" ? "Wekelijkse selectie" : "Wijzigingsmelding")} · ${escapeHtml(input.organizationName)} · ${escapeHtml(period)}</div>
</td></tr>
<tr><td style="padding:16px 4px">
${input.intro ? `<p style="font-size:14px;color:#0f172a">${escapeHtml(input.intro)}</p>` : ""}
${input.items.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${input.items.map(card).join("")}</table>` : `<p style="font-size:14px;color:#0f172a;background:#fff;border:1px solid #dbe2ea;border-radius:8px;padding:16px">${escapeHtml(emptyText)}</p>`}
<p style="font-size:13px"><a href="${escapeHtml(input.portalUrl)}" style="color:#1d4ed8">Naar het klantportaal</a></p>
<p style="font-size:12px;color:#64748b">${escapeHtml(FOOTER)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, textBody };
}

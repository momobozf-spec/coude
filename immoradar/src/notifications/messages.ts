import { formatPrice, relativeTime } from "@/lib/format";
import { escapeHtml } from "./telegram";

export interface OpportunityMessageInput {
  id: string;
  headline: string;
  score: number;
  type: string;
  place: string | null;
  price: number | null;
  detectedAt: Date;
  crmMatched: boolean;
  contactName: string | null;
  relationshipLabel: string | null;
  assignedName: string | null;
  reasons: string[];
  appUrl: string;
  now: Date;
}

export function hotOpportunityMessage(o: OpportunityMessageInput): string {
  const lines = [
    o.crmMatched ? "🚨 <b>HIGH PRIORITY SELLER OPPORTUNITY</b>" : "🔥 <b>HOT SELLER OPPORTUNITY</b>",
    "",
    `<b>${escapeHtml(o.place ?? "Unknown location")}</b>`,
    formatPrice(o.price),
    "",
    `${escapeHtml(o.headline)}`,
    `Detected: ${relativeTime(o.detectedAt, o.now)}`,
  ];
  if (o.crmMatched && o.contactName) {
    lines.push("", "<b>CRM MATCH FOUND</b>", escapeHtml(o.contactName));
    if (o.relationshipLabel) lines.push(`Relationship: ${escapeHtml(o.relationshipLabel)}`);
  }
  if (o.assignedName) lines.push(`Assigned agent: ${escapeHtml(o.assignedName)}`);
  lines.push("", `Opportunity Score: <b>${o.score}/100</b>`);
  if (o.reasons.length) lines.push("", "Reasons:", ...o.reasons.slice(0, 5).map((r) => `+ ${escapeHtml(r)}`));
  lines.push("", `${o.appUrl}/opportunities/${o.id}`);
  return lines.join("\n");
}

export interface DigestInput {
  recipientName: string;
  counts: Array<{ label: string; count: number }>;
  total: number;
  top: OpportunityMessageInput | null;
  appUrl: string;
}

export function morningDigestMessage(d: DigestInput): string {
  const lines = [`☀️ <b>GOOD MORNING ${escapeHtml(d.recipientName.toUpperCase())}</b>`, ""];
  if (d.total === 0) {
    lines.push("No new opportunities need your attention today.", "", `${d.appUrl}/`);
    return lines.join("\n");
  }
  lines.push(`<b>${d.total} opportunit${d.total === 1 ? "y needs" : "ies need"} attention</b>`, "");
  for (const c of d.counts) if (c.count > 0) lines.push(`${c.count} ${escapeHtml(c.label)}`);
  if (d.top) {
    lines.push("", "<b>TOP OPPORTUNITY</b>", "", escapeHtml(d.top.place ?? "Unknown location"), formatPrice(d.top.price), "", `Score: <b>${d.top.score}</b>`, "");
    lines.push(...d.top.reasons.slice(0, 3).map((r) => escapeHtml(r)).join("\n+\n").split("\n"));
    lines.push("", `${d.appUrl}/opportunities/${d.top.id}`);
  }
  lines.push("", `${d.appUrl}/`);
  return lines.join("\n");
}

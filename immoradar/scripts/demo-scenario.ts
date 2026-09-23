import "dotenv/config";
import { createPrismaClient } from "../src/lib/db";
import { formatPrice, relativeTime } from "../src/lib/format";

/**
 * Walks the 20-step final demonstration against the current database and
 * prints what ImmoRadar actually recorded for Scenario B (Pieter Janssens).
 * Read-only. Run `npm run db:seed` first.
 */
const db = createPrismaClient();
const step = (n: number, title: string, detail?: string) => console.log(`${String(n).padStart(2, " ")}. ${title}${detail ? `\n    ${detail.split("\n").join("\n    ")}` : ""}`);

async function main() {
  const now = new Date();
  const listing = await db.listing.findFirst({ where: { sourceListingId: "IP-1001" }, include: { source: true, property: { include: { listings: { include: { source: true } } } }, snapshots: { orderBy: { capturedAt: "asc" } }, events: { orderBy: { occurredAt: "asc" } } } });
  if (!listing?.property) throw new Error("Fixture listing IP-1001 not found. Run `npm run db:seed` first.");
  const p = listing.property;
  step(1, "A property listing enters ImmoRadar", `${listing.source.name} · ${listing.sourceListingId} · "${listing.title}"`);
  step(2, "The listing is normalized", `${p.addressLine} · key ${p.normalizedAddressKey} · ${formatPrice(listing.currentPrice)} · ${listing.listingType}`);
  step(3, "Property matching identifies the physical property", `${p.listings.length} advertisement(s) on one Property: ${p.listings.map((l) => `${l.source.name} (${l.matchDecision} ${Math.round((l.matchConfidence ?? 0) * 100)}%)`).join(", ")}`);
  step(4, "Seller is classified as PRIVATE", `${listing.sellerType} · confidence ${Math.round(listing.sellerConfidence * 100)}% · ${(listing.sellerReasons as string[]).join("; ")}`);
  step(5, "Listing history is stored", `${listing.snapshots.length} snapshot(s), first captured ${listing.snapshots[0]?.capturedAt.toISOString()}`);
  step(6, "Market event: FSBO_DETECTED", listing.events.map((e) => e.type).join(", "));
  const opp = await db.opportunity.findFirst({ where: { propertyId: p.id, crmMatched: true }, orderBy: { score: "desc" }, include: { agency: { include: { territories: true } }, contact: { include: { relationships: true } }, assignedUser: true, alerts: true, activities: { orderBy: { createdAt: "asc" } } } });
  if (!opp?.contact) throw new Error("No CRM-matched opportunity found for the fixture property.");
  step(7, "Opportunity is created", `${opp.agency.name} · ${opp.type} · status ${opp.status}`);
  step(8, "LeadRevive searches the agency CRM", `${await db.crmContact.count({ where: { agencyId: opp.agencyId } })} contacts scanned for phone / email / address / relationship matches`);
  const rel = opp.contact.relationships[0];
  step(9, "Existing contact is discovered", `${opp.contact.firstName} ${opp.contact.lastName} · ${rel ? `${rel.relationshipType} — ${rel.year}` : ""} · match ${Math.round((opp.crmMatchConfidence ?? 0) * 100)}% (${(opp.crmMatchReasons as string[]).join(", ")})`);
  step(10, "Relationship score calculated", `${opp.relationshipScore}/100`);
  step(11, "Intent score calculated", `${opp.intentScore}/100`);
  step(12, "Combined Opportunity Score", `${opp.score}/100`);
  step(13, "Agency territory matches", `${opp.territoryScore}/100 · territories: ${opp.agency.territories.map((t) => t.value).join(", ")}`);
  step(14, "Opportunity assigned", opp.assignedUser ? `${opp.assignedUser.name} (auto-assigned from the CRM contact)` : "unassigned");
  const alert = opp.alerts[0];
  step(15, "Telegram alert generated", alert ? `${alert.type} · ${alert.status} · ${relativeTime(alert.createdAt, now)}` : "none (score below threshold or signal too old)");
  step(16, "Agent opens Today's Opportunities", `http://localhost:3000/  (sign in as ${opp.assignedUser?.email ?? "an Immo Gent user"}, password immoradar)`);
  step(17, "Agent sees", opp.headline.toUpperCase());
  step(18, "Agent opens the complete view", `http://localhost:3000/opportunities/${opp.id}  → property timeline, CRM relationship, market signals, scoring explanation`);
  step(19, "Agent marks CONTACTED", opp.status === "CONTACTED" ? "already contacted" : "click “Mark contacted” in the UI (or use the workflow service)");
  step(20, "Manager analytics update", "http://localhost:3000/analytics  → contacted count for CRM + Market Match and for the agent");
  console.log("\nScore reasons:");
  for (const r of (opp.scoreReasons as Array<{ label: string; kind: string }>) ?? []) console.log(`  + [${r.kind}] ${r.label}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

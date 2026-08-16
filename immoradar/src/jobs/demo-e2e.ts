/**
 * Final demonstration: the complete 20-step flagship scenario from listing
 * ingestion to manager analytics. Run after seeding:
 *   npm run demo:e2e
 */

import { IngestionService } from "@/ingestion/ingestion-service";
import { prisma } from "@/lib/db";
import { normalizeListing } from "@/normalization/listing-normalizer";
import { AlertService } from "@/services/alert-service";
import { AnalyticsService } from "@/services/analytics-service";
import { OpportunityService } from "@/services/opportunity-service";
import { WorkflowService } from "@/services/workflow-service";

function step(n: number, message: string) {
  console.log(`\n[${String(n).padStart(2, "0")}] ${message}`);
}

async function main() {
  const hero = await prisma.agency.findUniqueOrThrow({ where: { slug: "immo-vandenberghe" } });
  const thomas = await prisma.user.findFirstOrThrow({
    where: { agencyId: hero.id, firstName: "Thomas" },
  });
  const admin = await prisma.user.findFirstOrThrow({
    where: { agencyId: hero.id, role: "AGENCY_ADMIN" },
  });
  const source = await prisma.source.findUniqueOrThrow({ where: { code: "fixture-portal-a" } });

  const runId = Date.now().toString(36).toUpperCase();
  const sourceListingId = `DEMO-${runId}`;
  const houseNumber = String(10 + (Date.now() % 170));

  step(1, "A property listing enters ImmoRadar");
  const raw = {
    source: "fixture-portal-a",
    sourceListingId,
    sourceUrl: `https://portal-a.example/listing/${sourceListingId}`,
    listingType: "sale",
    title: "Ruime burgerwoning met stadstuin — Gent",
    description: "Verkoop door particulier, zonder makelaar. Karaktervolle burgerwoning nabij het centrum.",
    price: "€ 625.000",
    address: `Coupure ${houseNumber}, 9000 Gent`,
    surfaceArea: "205 m²",
    bedrooms: "4",
    propertyType: "woning",
    sellerName: "Pieter Janssens",
    sellerPhone: "0472 12 34 56",
    sellerKind: "particulier",
    sellerListingCount: 1,
  };
  console.log(`     ${raw.title} — ${raw.price} (${raw.address})`);

  step(2, "The listing is normalized");
  const normalized = normalizeListing(raw);
  console.log(`     price=${normalized.price} street=${normalized.street} pc=${normalized.postalCode} phone=${normalized.sellerPhone}`);

  step(3, "Property matching identifies the physical property");
  const ingestion = new IngestionService(prisma);
  const { listingId } = await ingestion.ingestListing(source.id, normalized, new Date());
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { property: true, events: true, snapshots: true },
  });
  console.log(`     propertyId=${listing.propertyId} (${listing.property?.address})`);

  step(4, "Seller is classified as PRIVATE");
  console.log(`     sellerType=${listing.sellerType} confidence=${listing.sellerConfidence}`);
  if (listing.sellerType !== "PRIVATE") throw new Error("Expected PRIVATE seller");

  step(5, "Listing history is stored");
  console.log(`     ${listing.snapshots.length} snapshot(s) captured`);

  step(6, "Market event: FSBO_DETECTED");
  const fsbo = listing.events.find((e) => e.type === "FSBO_DETECTED");
  if (!fsbo) throw new Error("Expected FSBO_DETECTED event");
  console.log(`     events: ${listing.events.map((e) => e.type).join(", ")}`);

  step(7, "Opportunity is created");
  const opportunityService = new OpportunityService(prisma);
  await opportunityService.generateForAgency(hero.id);
  const opportunity = await prisma.opportunity.findFirstOrThrow({
    where: { agencyId: hero.id, listingId },
    include: {
      contact: true,
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
      signals: true,
    },
  });
  console.log(`     type=${opportunity.type} origin=${opportunity.origin}`);

  step(8, "LeadRevive searches the agency CRM");
  step(9, "Existing contact is discovered: Previous buyer — 2019");
  if (!opportunity.contact) throw new Error("Expected CRM match");
  console.log(
    `     ${opportunity.contact.firstName} ${opportunity.contact.lastName} (${opportunity.contact.contactType}, since ${opportunity.contact.sourceCreatedAt?.getFullYear()})`,
  );
  console.log(`     match confidence=${opportunity.crmMatchConfidence} reasons=${JSON.stringify(opportunity.crmMatchReasons)}`);

  const score = opportunity.scores[0]!;
  step(10, "Relationship score calculated");
  console.log(`     relationship=${score.relationshipScore}`);
  step(11, "Intent score calculated");
  console.log(`     intent=${score.intentScore}`);
  step(12, `Combined Opportunity Score: ${score.total}/100`);
  console.log(`     reasons: ${(score.reasons as string[]).join(" | ")}`);
  if (score.total < 90) throw new Error("Expected a top-tier combined score");

  step(13, "Agency territory matches");
  console.log(`     territory component=${score.territoryScore}`);

  step(14, "Opportunity assigned");
  const workflow = new WorkflowService(prisma);
  await workflow.assign(hero.id, opportunity.id, thomas.id, admin.id);
  console.log(`     assigned to ${thomas.firstName} ${thomas.lastName}`);

  step(15, "Telegram alert generated");
  const alerts = new AlertService(prisma);
  const dispatched = await alerts.dispatchInstantAlerts(hero.id);
  const alert = await prisma.alert.findFirst({
    where: { agencyId: hero.id, opportunityId: opportunity.id },
  });
  console.log(`     alert=${alert?.kind ?? "none"} status=${alert?.status} (created ${dispatched.created}, suppressed ${dispatched.suppressed})`);
  if (!alert) throw new Error("Expected an alert for the flagship opportunity");

  step(16, "Agent opens: Today's Opportunities");
  const today = await prisma.opportunity.findMany({
    where: { agencyId: hero.id, status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] } },
    include: { scores: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  const ranked = today.sort((a, b) => (b.scores[0]?.total ?? 0) - (a.scores[0]?.total ?? 0));
  const rank = ranked.findIndex((o) => o.id === opportunity.id) + 1;
  console.log(`     ${ranked.length} open opportunities; flagship ranks #${rank}`);

  step(17, "Agent sees: EXISTING CONTACT + FSBO");
  console.log(`     badge=${opportunity.origin === "CROSS" ? "EXISTING CONTACT + FSBO" : opportunity.type}`);

  step(18, "Agent opens complete timeline, CRM relationship, market signals, scoring explanation");
  const timeline = await prisma.listingEvent.findMany({
    where: { listing: { propertyId: listing.propertyId } },
    orderBy: { occurredAt: "asc" },
  });
  console.log(`     ${timeline.length} timeline events, ${opportunity.signals.length} signals, full score breakdown stored`);

  step(19, "Agent marks: CONTACTED");
  await workflow.changeStatus(hero.id, opportunity.id, "CONTACTED", thomas.id, "Gebeld — interesse in gesprek");
  const updated = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } });
  console.log(`     status=${updated.status}`);

  step(20, "Manager analytics update");
  const analytics = new AnalyticsService(prisma);
  const funnel = await analytics.agencyFunnel(hero.id);
  console.log(
    `     detected=${funnel.overall.detected} contacted=${funnel.overall.contacted} valuations=${funnel.overall.valuationsBooked} won=${funnel.overall.mandatesWon} conversion=${funnel.overall.conversionRate ?? "-"}%`,
  );

  console.log("\n✅ Complete end-to-end scenario succeeded.");
}

main()
  .catch((err) => {
    console.error("❌ Demo failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

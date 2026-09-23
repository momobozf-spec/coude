/* eslint-disable no-console */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { normalizeTerritoryValue } from "../src/domain/territory/territory-matcher";
import { normalizeAddress, normalizePersonName, normalizePhone, normalizeEmail } from "../src/normalization/normalizers";
import { canonicalCityName } from "../src/normalization/belgium";
import { normalizeContact } from "../src/crm/contact-normalizer";
import { stableHash } from "../src/lib/hash";
import { detectSnapshotEvents, detectStaleEvents, type ListingState, type SnapshotState } from "../src/events/event-engine";
import { runCollectJob, runLeadReviveJob } from "../src/jobs/pipeline";
import { FixtureImmoPortalCollector } from "../src/collectors/fixtures/fixture-immo-portal";
import { FixturePrivateMarketCollector } from "../src/collectors/fixtures/fixture-private-market";
import { ConsoleTransport } from "../src/notifications/telegram";
import type { CrmContactStatus, CrmContactType, PropertyRelationshipType, PropertyType, SellerType, Prisma } from "../src/generated/prisma/client";
import { CITIES, CONTACT_NOTES, FIRST_NAMES, LAST_NAMES, MARKET_AGENCIES, PRIVATE_DESCRIPTIONS, PROFESSIONAL_DESCRIPTIONS, mulberry32, type CityDef } from "./seed-data";

process.env["LOG_LEVEL"] = process.env["LOG_LEVEL"] ?? "warn";

const db = createPrismaClient();
const rnd = mulberry32(20260923);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const between = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const NOW = new Date();
const daysAgo = (d: number, hourJitter = true) => new Date(NOW.getTime() - d * 86400000 - (hourJitter ? between(0, 20) * 3600000 : 0));
const DEMO_PASSWORD = "immoradar";

interface AgencyDef { name: string; slug: string; city: string; territories: Array<{ type: "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE"; value: string }>; users: Array<{ name: string; role: "AGENCY_ADMIN" | "AGENT"; telegram?: string }>; cities: string[] }

const AGENCIES: AgencyDef[] = [
  { name: "Immo Gent", slug: "immo-gent", city: "Gent", cities: ["Gent", "Melle", "Merelbeke"], territories: [{ type: "POSTAL_CODE", value: "9000" }, { type: "POSTAL_CODE", value: "9030" }, { type: "POSTAL_CODE", value: "9040" }, { type: "POSTAL_CODE", value: "9050" }, { type: "MUNICIPALITY", value: "Melle" }, { type: "MUNICIPALITY", value: "Merelbeke" }], users: [{ name: "Sofie Claes", role: "AGENCY_ADMIN" }, { name: "Thomas Peeters", role: "AGENT", telegram: "123456789" }, { name: "Lien Maes", role: "AGENT" }] },
  { name: "Antwerp Vastgoed", slug: "antwerp-vastgoed", city: "Antwerpen", cities: ["Antwerpen"], territories: [{ type: "POSTAL_CODE", value: "2000" }, { type: "POSTAL_CODE", value: "2018" }, { type: "POSTAL_CODE", value: "2600" }, { type: "MUNICIPALITY", value: "Antwerpen" }, { type: "PROVINCE", value: "Antwerpen" }], users: [{ name: "Bart Jacobs", role: "AGENCY_ADMIN" }, { name: "Nadia El Amrani", role: "AGENT" }, { name: "Koen Willems", role: "AGENT" }] },
  { name: "Brugge Immo", slug: "brugge-immo", city: "Brugge", cities: ["Brugge"], territories: [{ type: "POSTAL_CODE", value: "8000" }, { type: "POSTAL_CODE", value: "8200" }, { type: "MUNICIPALITY", value: "Brugge" }, { type: "PROVINCE", value: "West-Vlaanderen" }], users: [{ name: "Katrien Declercq", role: "AGENCY_ADMIN" }, { name: "Wim Verhaeghe", role: "AGENT" }, { name: "Hanne Desmet", role: "AGENT" }] },
  { name: "Leuven Living", slug: "leuven-living", city: "Leuven", cities: ["Leuven"], territories: [{ type: "POSTAL_CODE", value: "3000" }, { type: "POSTAL_CODE", value: "3001" }, { type: "POSTAL_CODE", value: "3010" }, { type: "MUNICIPALITY", value: "Leuven" }, { type: "PROVINCE", value: "Vlaams-Brabant" }], users: [{ name: "Dirk Hermans", role: "AGENCY_ADMIN" }, { name: "Julie Lambert", role: "AGENT" }, { name: "Stijn Aerts", role: "AGENT" }] },
  { name: "Brussels Realty", slug: "brussels-realty", city: "Brussel", cities: ["Brussel"], territories: [{ type: "POSTAL_CODE", value: "1000" }, { type: "POSTAL_CODE", value: "1050" }, { type: "POSTAL_CODE", value: "1180" }, { type: "MUNICIPALITY", value: "Brussel" }, { type: "PROVINCE", value: "Brussels" }], users: [{ name: "Camille Dupont", role: "AGENCY_ADMIN" }, { name: "Youssef Lemaire", role: "AGENT" }] },
];

function phone(): string {
  return `04${between(60, 99)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`;
}

function email(first: string, last: string): string {
  const domain = pick(["telenet.be", "gmail.com", "hotmail.com", "skynet.be", "proximus.be", "outlook.com"]);
  return `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `${between(1, 99)}@${domain}`;
}

interface SeededProperty { id: string; city: CityDef; street: string; houseNumber: string; postalCode: string; addressKey: string; propertyType: PropertyType; bedrooms: number; surface: number; basePrice: number }

async function main() {
  console.log("Seeding ImmoRadar demo data…");
  await db.$executeRawUnsafe(`TRUNCATE TABLE "AuditLog","Alert","AlertRule","OpportunityActivity","OpportunityAssignment","OpportunityScore","OpportunitySignal","Opportunity","ContactPropertyRelationship","CrmInteraction","CrmImportRow","CrmContact","CrmImport","ListingEvent","ListingSnapshot","Listing","SellerIdentity","AgencyIdentity","Property","CollectorRun","Source","Territory","Session","User","Agency" RESTART IDENTITY CASCADE`);

  // --- Agencies, users, territories ---------------------------------------
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const agencyIds: Record<string, string> = {};
  const usersByAgency: Record<string, Array<{ id: string; name: string }>> = {};
  for (const a of AGENCIES) {
    const agency = await db.agency.create({ data: { name: a.name, slug: a.slug, city: a.city, alertMinScore: 80, digestHourLocal: 7, telegramChatId: null } });
    agencyIds[a.slug] = agency.id;
    for (const t of a.territories) await db.territory.create({ data: { agencyId: agency.id, type: t.type, value: t.value, normalizedValue: normalizeTerritoryValue(t.type, t.value) } });
    await db.alertRule.createMany({ data: [{ agencyId: agency.id, type: "HOT_OPPORTUNITY", minScore: 80 }, { agencyId: agency.id, type: "CRM_MARKET_MATCH", minScore: 0 }, { agencyId: agency.id, type: "MORNING_DIGEST", minScore: 0 }] });
    usersByAgency[a.slug] = [];
    for (const u of a.users) {
      const user = await db.user.create({ data: { agencyId: agency.id, name: u.name, email: `${u.name.toLowerCase().replace(/\s+/g, ".")}@${a.slug}.be`, passwordHash, role: u.role, telegramChatId: u.telegram ?? null } });
      usersByAgency[a.slug]!.push({ id: user.id, name: user.name });
    }
  }
  await db.user.create({ data: { agencyId: null, name: "Platform Admin", email: "admin@immoradar.be", passwordHash, role: "PLATFORM_ADMIN" } });
  for (const name of MARKET_AGENCIES) await db.agencyIdentity.create({ data: { name, normalizedName: name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() } });

  // --- Sources -------------------------------------------------------------------
  const archive = await db.source.create({ data: { key: "demo-archive", name: "Demo archive (seeded history)", kind: "FIXTURE", enabled: false, health: "DISABLED", accessNote: "Synthetic seeded history — not collected" } });
  const feed = await db.source.create({ data: { key: "demo-feed", name: "Demo private feed (seeded history)", kind: "FIXTURE", enabled: false, health: "DISABLED", accessNote: "Synthetic seeded history — not collected" } });

  // --- Properties ----------------------------------------------------------------
  const properties: SeededProperty[] = [];
  const cityWeights: Array<[CityDef, number]> = CITIES.map((c) => [c, c.city === "Gent" ? 40 : c.city === "Melle" || c.city === "Merelbeke" ? 8 : 20]);
  // Reserve the addresses used by the fixture collectors so they enter as genuinely new properties.
  const usedAddresses = new Set<string>(["kortrijksesteenweg|123|9000", "coupure links|45|9000", "krijtestraat|8|9830", "brusselsesteenweg|210|9090", "volkstraat|30|2000", "ezelstraat|77|8000", "tiensestraat|140|3000"]);
  while (properties.length < 150) {
    const total = cityWeights.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    let city = CITIES[0]!;
    for (const [c, w] of cityWeights) { r -= w; if (r <= 0) { city = c; break; } }
    const street = pick(city.streets);
    const houseNumber = String(between(1, 250));
    const postalCode = pick(city.postalCodes);
    const addr = normalizeAddress({ street, houseNumber, postalCode, city: city.city });
    if (!addr.addressKey || usedAddresses.has(addr.addressKey)) continue;
    usedAddresses.add(addr.addressKey);
    const propertyType: PropertyType = pick(["HOUSE", "HOUSE", "HOUSE", "APARTMENT", "APARTMENT", "LAND", "COMMERCIAL"]);
    const bedrooms = propertyType === "APARTMENT" ? between(1, 3) : propertyType === "HOUSE" ? between(2, 5) : 0;
    const surface = propertyType === "APARTMENT" ? between(55, 140) : propertyType === "HOUSE" ? between(110, 320) : between(300, 1500);
    const basePrice = Math.round((city.priceLevel * (propertyType === "APARTMENT" ? 0.75 : propertyType === "LAND" ? 0.6 : propertyType === "COMMERCIAL" ? 0.9 : 1.1) * (0.8 + rnd() * 0.6)) / 5000) * 5000;
    const p = await db.property.create({ data: { addressLine: addr.addressLine, street: addr.street, houseNumber: addr.houseNumber, postalCode, city: addr.city, municipality: addr.municipality, province: addr.province, propertyType, bedrooms, surfaceArea: surface, normalizedAddressKey: addr.addressKey } });
    properties.push({ id: p.id, city, street, houseNumber, postalCode, addressKey: addr.addressKey, propertyType, bedrooms, surface, basePrice });
  }

  // --- Listings with history -----------------------------------------------------
  interface ListingPlan { property: SeededProperty; sourceId: string; sellerType: SellerType; sellerName: string; sellerPhone: string | null; firstSeenDaysAgo: number; steps: Array<{ daysAgo: number; price: number; status: "ACTIVE" | "REMOVED"; sellerType?: SellerType }>; finalStatus: "ACTIVE" | "REMOVED"; relistOf?: string; description: string; title: string; listingType: "SALE" | "RENT" }
  const plans: ListingPlan[] = [];
  let listingCounter = 0;
  const makePlan = (property: SeededProperty, over: Partial<ListingPlan> = {}): ListingPlan => {
    const sellerType: SellerType = over.sellerType ?? pick(["PRIVATE", "PRIVATE", "PROFESSIONAL", "PROFESSIONAL", "PROFESSIONAL"]);
    const firstSeenDaysAgo = over.firstSeenDaysAgo ?? between(1, 180);
    const price = over.steps?.[0]?.price ?? property.basePrice;
    const agencyName = pick(MARKET_AGENCIES);
    const sellerName = sellerType === "PRIVATE" ? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` : agencyName;
    const steps: ListingPlan["steps"] = over.steps ?? [{ daysAgo: firstSeenDaysAgo, price, status: "ACTIVE" }];
    if (!over.steps) {
      // Random extra history: price drops, sometimes removal
      const changes = rnd() < 0.8 ? between(1, 4) : 0;
      let current = price;
      let day = firstSeenDaysAgo;
      for (let i = 0; i < changes && day > 3; i++) {
        day = day - between(2, Math.max(3, Math.floor(day / 2)));
        // Mostly drops, occasionally a small increase.
        const pct = rnd() < 0.1 ? between(1, 3) : -between(2, 8);
        current = Math.round((current * (1 + pct / 100)) / 1000) * 1000;
        steps.push({ daysAgo: day, price: current, status: "ACTIVE" });
      }
      if (rnd() < 0.15 && day > 2) steps.push({ daysAgo: day - 1, price: current, status: "REMOVED" });
    }
    const finalStatus = steps[steps.length - 1]!.status;
    const typeLabel = property.propertyType === "APARTMENT" ? "Appartement" : property.propertyType === "HOUSE" ? "Woning" : property.propertyType === "LAND" ? "Bouwgrond" : "Handelspand";
    return { property, sourceId: over.sourceId ?? (rnd() < 0.7 ? archive.id : feed.id), sellerType, sellerName, sellerPhone: sellerType === "PRIVATE" ? phone() : null, firstSeenDaysAgo, steps, finalStatus, description: over.description ?? (sellerType === "PRIVATE" ? pick(PRIVATE_DESCRIPTIONS) : pick(PROFESSIONAL_DESCRIPTIONS).replace("{agency}", agencyName)), title: over.title ?? `${typeLabel} te koop in ${property.city.city}${sellerType === "PRIVATE" ? " — van eigenaar" : ""}`, listingType: over.listingType ?? "SALE", relistOf: over.relistOf };
  };

  const gentProps = properties.filter((p) => p.city.city === "Gent");
  // Scenario C: private seller, 67 days online, 2 price drops (Gent)
  const scenarioC = gentProps[0]!;
  plans.push(makePlan(scenarioC, { sellerType: "PRIVATE", firstSeenDaysAgo: 67, steps: [{ daysAgo: 67, price: 449000 + 60000, status: "ACTIVE" }, { daysAgo: 40, price: 449000 + 26000, status: "ACTIVE" }, { daysAgo: 2, price: 449000, status: "ACTIVE" }], sellerName: "Karel Vermeulen", sellerPhone: "0475 66 77 88", title: "Ruime gezinswoning te koop door eigenaar — Gent", description: "Verkoop door particulier, zonder makelaar. Ruime gezinswoning met 4 slaapkamers en tuin. Immokantoren onthouden." }));
  // Scenario E: relisted property with a CRM relationship (Gent) — first listing removed, new listing relisted 3 days ago
  const scenarioE = gentProps[1]!;
  plans.push(makePlan(scenarioE, { sellerType: "PRIVATE", firstSeenDaysAgo: 120, steps: [{ daysAgo: 120, price: 510000, status: "ACTIVE" }, { daysAgo: 95, price: 495000, status: "ACTIVE" }, { daysAgo: 70, price: 475000, status: "ACTIVE" }, { daysAgo: 45, price: 475000, status: "REMOVED" }], sellerName: "Marc Goossens", sellerPhone: "0486 12 12 12", sourceId: archive.id }));
  plans.push(makePlan(scenarioE, { sellerType: "PRIVATE", firstSeenDaysAgo: 3, steps: [{ daysAgo: 3, price: 465000, status: "ACTIVE" }], sellerName: "Marc Goossens", sellerPhone: "0486 12 12 12", sourceId: feed.id, relistOf: "E", title: "Woning te koop — opnieuw beschikbaar, van eigenaar" }));
  // Agency → private example (Antwerpen)
  const antProps = properties.filter((p) => p.city.city === "Antwerpen");
  plans.push(makePlan(antProps[0]!, { sellerType: "PRIVATE", firstSeenDaysAgo: 50, steps: [{ daysAgo: 50, price: 389000, status: "ACTIVE", sellerType: "PROFESSIONAL" }, { daysAgo: 4, price: 375000, status: "ACTIVE", sellerType: "PRIVATE" }], sellerName: "Ilse Cools", sellerPhone: "0477 90 90 90", description: "Eigenaar verkoopt zelf, zonder makelaar. Bezichtiging na afspraak." }));

  // Random listings until 250, some properties get 2 listings (2 sources)
  let pi = 4;
  while (plans.length < 250) {
    const property = properties[pi % properties.length]!;
    pi++;
    plans.push(makePlan(property));
    if (rnd() < 0.25 && plans.length < 250) plans.push(makePlan(property, { sourceId: feed.id, sellerType: plans[plans.length - 1]!.sellerType, sellerName: plans[plans.length - 1]!.sellerName, sellerPhone: plans[plans.length - 1]!.sellerPhone, firstSeenDaysAgo: plans[plans.length - 1]!.firstSeenDaysAgo - between(0, 3) }));
  }

  let snapshotCount = 0;
  let eventCount = 0;
  const sellerIdentities = new Map<string, string>();
  for (const plan of plans) {
    listingCounter++;
    const first = plan.steps[0]!;
    const last = plan.steps[plan.steps.length - 1]!;
    const firstSeenAt = daysAgo(first.daysAgo);
    const lastSeenAt = daysAgo(last.daysAgo);
    const normalizedPhone = normalizePhone(plan.sellerPhone);
    let sellerIdentityId: string | null = null;
    if (normalizedPhone) {
      sellerIdentityId = sellerIdentities.get(normalizedPhone) ?? null;
      if (!sellerIdentityId) {
        const si = await db.sellerIdentity.create({ data: { displayName: plan.sellerName, normalizedName: normalizePersonName(plan.sellerName), normalizedPhone, classifiedType: plan.sellerType } });
        sellerIdentityId = si.id;
        sellerIdentities.set(normalizedPhone, si.id);
      }
    }
    const finalSellerType = last.sellerType ?? plan.sellerType;
    const priceDrops = plan.steps.filter((s, i) => i > 0 && s.price < plan.steps[i - 1]!.price).length;
    const listing = await db.listing.create({
      data: {
        propertyId: plan.property.id, sourceId: plan.sourceId, sourceListingId: `SEED-${listingCounter.toString().padStart(4, "0")}`, sourceUrl: `https://demo-source.example/l/${listingCounter}`,
        listingType: plan.listingType, title: plan.title, description: plan.description, sellerType: finalSellerType, sellerConfidence: finalSellerType === "PRIVATE" ? 0.85 + rnd() * 0.14 : finalSellerType === "PROFESSIONAL" ? 0.9 + rnd() * 0.09 : 0.3,
        sellerReasons: finalSellerType === "PRIVATE" ? ["Explicit private seller indication", "Personal seller name", "No agency identity detected"] : ["Company identity provided", "Professional language detected"],
        sellerIdentityId, currentPrice: last.price, initialPrice: first.price, publishedAt: firstSeenAt, firstSeenAt, lastSeenAt, status: plan.finalStatus, removedAt: plan.finalStatus === "REMOVED" ? lastSeenAt : null,
        relistedAt: plan.relistOf ? firstSeenAt : null, priceDropCount: priceDrops, matchConfidence: 1, matchDecision: "AUTO_MATCH", matchReasons: ["Exact normalized address match"],
      },
    });
    const state: ListingState = { id: listing.id, firstSeenAt, lastSeenAt, status: "ACTIVE", sellerType: first.sellerType ?? plan.sellerType, currentPrice: first.price, missingCount: 0, removedAt: null };
    let previous: SnapshotState | null = null;
    for (const step of plan.steps) {
      const capturedAt = daysAgo(step.daysAgo);
      const sellerType = step.sellerType ?? plan.sellerType;
      const content = { price: step.price, title: plan.title, description: plan.description, sellerName: plan.sellerName, sellerPhone: plan.sellerPhone, sellerEmail: null, sellerType, status: step.status };
      await db.listingSnapshot.create({ data: { listingId: listing.id, capturedAt, ...content, contentHash: stableHash(content), rawData: { seeded: true, price: `€ ${step.price.toLocaleString("nl-BE")}`, address: `${plan.property.street} ${plan.property.houseNumber}, ${plan.property.postalCode} ${plan.property.city.city}` } } });
      snapshotCount++;
      const current: SnapshotState = { price: step.price, sellerType, status: step.status, capturedAt };
      const events = detectSnapshotEvents(state, previous, current);
      if (plan.relistOf && !previous) events.push({ type: "RELISTED", occurredAt: capturedAt, oldPrice: 475000, newPrice: step.price, difference: step.price - 475000, percentage: Number((((step.price - 475000) / 475000) * 100).toFixed(2)), dedupeKey: `${listing.id}:RELISTED:property`, payload: { reason: "property_relisted" } });
      for (const e of events) {
        await db.listingEvent.create({ data: { listingId: listing.id, propertyId: plan.property.id, type: e.type, occurredAt: e.occurredAt, oldPrice: e.oldPrice ?? null, newPrice: e.newPrice ?? null, difference: e.difference ?? null, percentage: e.percentage ?? null, dedupeKey: e.dedupeKey, payload: (e.payload ?? undefined) as Prisma.InputJsonValue | undefined, processedAt: null } });
        eventCount++;
      }
      previous = current;
      state.sellerType = sellerType;
      state.currentPrice = step.price;
      state.status = step.status === "REMOVED" ? "REMOVED" : "ACTIVE";
    }
    if (plan.finalStatus === "ACTIVE") {
      for (const e of detectStaleEvents({ ...state, status: "ACTIVE" }, NOW)) {
        // Stale events occurred when the threshold was crossed, not "now".
        const days = Number((e.payload?.["daysObserved"] as number) ?? 0);
        const threshold = Number(e.type.replace("STALE_", ""));
        const occurredAt = new Date(firstSeenAt.getTime() + threshold * 86400000);
        await db.listingEvent.create({ data: { listingId: listing.id, propertyId: plan.property.id, type: e.type, occurredAt, newPrice: state.currentPrice, dedupeKey: e.dedupeKey, payload: { daysObserved: days } } });
        eventCount++;
      }
    }
  }

  // --- CRM contacts (100 per agency) ---------------------------------------------
  const contactTypes: CrmContactType[] = ["BUYER", "BUYER", "SELLER", "SELLER", "VALUATION_LEAD", "VALUATION_LEAD", "PROSPECT", "PROSPECT", "FORMER_CLIENT", "LANDLORD", "TENANT", "UNKNOWN"];
  let contactsCreated = 0;
  for (const a of AGENCIES) {
    const agencyId = agencyIds[a.slug]!;
    const users = usersByAgency[a.slug]!;
    const localProps = properties.filter((p) => a.cities.includes(p.city.city));
    const imp = await db.crmImport.create({ data: { agencyId, userId: users[0]!.id, adapter: "csv", fileName: `${a.slug}-crm-export.csv`, status: "COMPLETED", totalRows: 100, createdCount: 100, startedAt: daysAgo(10), finishedAt: daysAgo(10) } });
    const specials: Array<Partial<{ first: string; last: string; phone: string; type: CrmContactType; status: CrmContactStatus; lastContactDaysAgo: number; rel: PropertyRelationshipType; year: number; property: SeededProperty; agent: string; notes: string }>> = [];
    if (a.slug === "immo-gent") {
      // Scenario B: Pieter Janssens, previous buyer 2019 of Kortrijksesteenweg 123 (arrives via the fixture collector)
      specials.push({ first: "Pieter", last: "Janssens", phone: "0478 12 34 56", type: "BUYER", status: "WON", lastContactDaysAgo: 400, rel: "BOUGHT", year: 2019, agent: "Thomas Peeters", notes: "Kocht via ons in 2019. Gezin groeit, denkt na over groter wonen." });
      // Scenario D: dormant valuation request, 21 months ago
      specials.push({ first: "Marie", last: "Dubois", phone: "0499 11 22 33", type: "VALUATION_LEAD", status: "ACTIVE", lastContactDaysAgo: 640, rel: "VALUATION_REQUESTED", year: 2024, property: gentProps[5]!, agent: "Thomas Peeters", notes: "Vroeg schatting aan i.v.m. erfenis. Geen mandaat gegeven." });
      // Scenario E: previous seller relationship with the relisted property
      specials.push({ first: "Marc", last: "Goossens", phone: "0486 12 12 12", type: "SELLER", status: "LOST", lastContactDaysAgo: 200, rel: "OWNER", year: 2025, property: scenarioE, agent: "Lien Maes", notes: "Wilde eerst zelf verkopen. Mandaat niet gewonnen." });
      // Scenario C seller is NOT in the CRM (pure market signal).
    }
    for (let i = 0; i < 100; i++) {
      const special = specials[i];
      const first = special?.first ?? pick(FIRST_NAMES);
      const last = special?.last ?? pick(LAST_NAMES);
      const contactType = special?.type ?? pick(contactTypes);
      const status: CrmContactStatus = special?.status ?? (contactType === "BUYER" ? "WON" : contactType === "SELLER" ? pick(["WON", "LOST", "ACTIVE", "CLOSED"]) : contactType === "VALUATION_LEAD" ? pick(["ACTIVE", "LOST", "INACTIVE"]) : pick(["ACTIVE", "INACTIVE", "UNKNOWN"]));
      const lastContactDays = special?.lastContactDaysAgo ?? (rnd() < 0.15 ? -1 : between(5, 2400));
      const agent = special?.agent ? users.find((u) => u.name === special.agent) ?? pick(users) : rnd() < 0.85 ? pick(users) : null;
      const prop = special?.property ?? (rnd() < 0.12 ? pick(localProps) : null);
      const chosenCity = pick(a.cities);
      const cityDef = prop?.city ?? CITIES.find((c) => c.city === chosenCity)!;
      const postalCode = prop?.postalCode ?? pick(cityDef.postalCodes);
      const address = prop ? `${prop.street} ${prop.houseNumber}` : `${pick(cityDef.streets)} ${between(1, 200)}`;
      const emailValue = rnd() < 0.85 ? email(first, last) : null;
      const phoneValue = special?.phone ?? (rnd() < 0.9 ? phone() : null);
      const input = { externalContactId: `${a.slug.toUpperCase().slice(0, 3)}-${(i + 1).toString().padStart(4, "0")}`, firstName: first, lastName: last, email: emailValue, phone: phoneValue, address, postalCode, city: cityDef.city, assignedAgent: agent?.name ?? null, contactType, leadType: null, status, createdAt: daysAgo(lastContactDays < 0 ? between(30, 400) : lastContactDays + between(10, 400)), lastContactAt: lastContactDays < 0 ? null : daysAgo(lastContactDays), notes: (special?.notes ?? pick(CONTACT_NOTES)) || null, propertyRelationship: null, sourceValues: {} as Record<string, unknown> };
      const n = normalizeContact(input);
      const addr = normalizeAddress({ address, postalCode, city: cityDef.city });
      const contact = await db.crmContact.create({
        data: {
          agencyId, externalContactId: input.externalContactId, firstName: first, lastName: last, normalizedName: n.normalizedName, email: emailValue, normalizedEmail: normalizeEmail(emailValue), phone: phoneValue, normalizedPhone: normalizePhone(phoneValue), address, normalizedAddressKey: addr.addressKey, postalCode, city: canonicalCityName(cityDef.city), assignedAgentName: agent?.name ?? null, assignedUserId: agent?.id ?? null, contactType, status, crmCreatedAt: input.createdAt, lastContactAt: input.lastContactAt, notes: input.notes, dedupeKey: n.dedupeKey, importId: imp.id,
          sourceValues: { voornaam: first, naam: last, gsm: phoneValue, email: emailValue, adres: address, postcode: postalCode, gemeente: cityDef.city, makelaar: agent?.name ?? "", type: contactType, status },
        },
      });
      contactsCreated++;
      const relType: PropertyRelationshipType | null = special?.rel ?? (prop ? (contactType === "BUYER" ? "BOUGHT" : contactType === "SELLER" ? (status === "WON" ? "SOLD" : "OWNER") : contactType === "VALUATION_LEAD" ? "VALUATION_REQUESTED" : contactType === "LANDLORD" ? "LANDLORD" : contactType === "TENANT" ? "TENANT" : "OWNER") : null);
      if (relType) {
        const relAddr = special?.first === "Pieter" ? normalizeAddress({ street: "Kortrijksesteenweg", houseNumber: "123", postalCode: "9000", city: "Gent" }) : addr;
        await db.contactPropertyRelationship.create({ data: { agencyId, contactId: contact.id, propertyId: special?.first === "Pieter" ? null : (prop?.id ?? null), addressKey: relAddr.addressKey, postalCode: relAddr.postalCode, relationshipType: relType, year: special?.year ?? (input.lastContactAt ? input.lastContactAt.getUTCFullYear() : null), source: "csv-import", note: special?.first === "Pieter" ? "Kortrijksesteenweg 123, 9000 Gent" : address } });
      }
      if (input.lastContactAt) {
        await db.crmInteraction.create({ data: { agencyId, contactId: contact.id, type: pick(["CALL", "EMAIL", "MEETING", "VALUATION", "VIEWING"]), occurredAt: input.lastContactAt, summary: pick(["Telefonisch contact", "E-mail opvolging", "Bezoek ter plaatse", "Schatting uitgevoerd", "Bezichtiging"]), importId: imp.id } });
      }
      await db.crmImportRow.create({ data: { importId: imp.id, agencyId, rowNumber: i + 1, status: "CREATED", contactId: contact.id, rawData: { voornaam: first, naam: last } } });
    }
  }

  console.log(`Seeded ${AGENCIES.length} agencies, ${AGENCIES.reduce((s, a) => s + a.users.length, 0) + 1} users, ${AGENCIES.reduce((s, a) => s + a.territories.length, 0)} territories, ${contactsCreated} contacts, ${properties.length} properties, ${plans.length} listings, ${snapshotCount} snapshots, ${eventCount} events.`);

  // --- Run the intelligence pipeline on the seeded history + fixture collectors ---
  console.log("Running collectors and the opportunity engine…");
  const transport = new ConsoleTransport();
  const collect = await runCollectJob(db, { now: NOW, transport, collectors: [new FixtureImmoPortalCollector(0), new FixturePrivateMarketCollector(0)] });
  const leadRevive = await runLeadReviveJob(db, { now: NOW });
  const opportunities = await db.opportunity.count();
  const crmMatches = await db.opportunity.count({ where: { crmMatched: true } });
  console.log(`Collected ${collect.runs.reduce((s, r) => s + r.listings, 0)} fixture listings, processed ${collect.events.eventsProcessed} events → ${opportunities} opportunities (${crmMatches} CRM+market matches, ${leadRevive.reduce((s, r) => s + r.opportunitiesCreated, 0)} LeadRevive).`);

  const scenarioB = await db.opportunity.findFirst({ where: { crmMatched: true, contact: { lastName: "Janssens", firstName: "Pieter" } }, orderBy: { score: "desc" }, include: { contact: true, property: true } });
  console.log("\nDemo accounts (password: immoradar)");
  for (const a of AGENCIES) for (const u of a.users) console.log(`  ${u.name.toLowerCase().replace(/\s+/g, ".")}@${a.slug}.be  (${a.name}, ${u.role})`);
  console.log("  admin@immoradar.be  (PLATFORM_ADMIN)");
  if (scenarioB) console.log(`\nScenario B ready: ${scenarioB.headline} — ${scenarioB.property?.addressLine} — score ${scenarioB.score} — contact ${scenarioB.contact?.firstName} ${scenarioB.contact?.lastName}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

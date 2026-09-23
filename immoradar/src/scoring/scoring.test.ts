import { describe, expect, it } from "vitest";
import { scoreIntent } from "./intent-score";
import { scoreRelationship } from "./relationship-score";
import { scoreDormancyTiming, scoreMarketTiming } from "./timing-score";
import { scoreConfidence } from "./confidence-score";
import { scoreOpportunity } from "./opportunity-score";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import { INTENT_WEIGHTS, RELATIONSHIP_WEIGHTS, SCORING_PROFILES } from "./config";

const now = new Date("2026-09-23T08:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);
const monthsAgo = (m: number) => new Date(now.getTime() - m * 30.44 * 86400000);

describe("scoreIntent", () => {
  it("awards the documented weights and returns reasons", () => {
    const r = scoreIntent({ sellerType: "PRIVATE", priceDropCount: 2, daysObserved: 67, relisted: false, agencyToPrivate: false });
    expect(r.raw).toBe(INTENT_WEIGHTS.FSBO + INTENT_WEIGHTS.PRICE_DROP + INTENT_WEIGHTS.MULTIPLE_PRICE_DROPS + INTENT_WEIGHTS.LISTING_OVER_30_DAYS + INTENT_WEIGHTS.LISTING_OVER_60_DAYS);
    expect(r.score).toBe(100);
    expect(r.reasons.map((x) => x.code)).toEqual(["FSBO", "PRICE_DROP", "MULTIPLE_PRICE_DROPS", "LISTING_OVER_30_DAYS", "LISTING_OVER_60_DAYS"]);
  });
  it("scores a bare FSBO as a strong but not maximal signal", () => {
    const r = scoreIntent({ sellerType: "PRIVATE", priceDropCount: 0, daysObserved: 0, relisted: false, agencyToPrivate: false });
    expect(r.raw).toBe(40);
    expect(r.score).toBe(73);
  });
  it("gives zero for a professional listing without other signals", () => {
    expect(scoreIntent({ sellerType: "PROFESSIONAL", priceDropCount: 0, daysObserved: 10, relisted: false, agencyToPrivate: false }).score).toBe(0);
  });
  it("adds relist and agency→private", () => {
    const r = scoreIntent({ sellerType: "PRIVATE", priceDropCount: 0, daysObserved: 0, relisted: true, agencyToPrivate: true });
    expect(r.raw).toBe(80);
    expect(r.reasons.map((x) => x.code)).toContain("AGENCY_TO_PRIVATE");
  });
});

describe("scoreRelationship", () => {
  it("scores a dormant valuation lead at ~82", () => {
    const r = scoreRelationship({ contactType: "VALUATION_LEAD", status: "ACTIVE", relationshipTypes: ["VALUATION_REQUESTED"], lastContactAt: monthsAgo(21), relationshipYear: 2024, assignedAgentAvailable: true, now });
    expect(r.raw).toBe(RELATIONSHIP_WEIGHTS.VALUATION_REQUEST + RELATIONSHIP_WEIGHTS.KNOWN_PROPERTY_RELATIONSHIP + RELATIONSHIP_WEIGHTS.SAME_ASSIGNED_AGENT);
    expect(r.score).toBe(83);
    expect(r.reasons.map((x) => x.label)).toContain("Requested a valuation — 2024");
  });
  it("scores a previous buyer with a known property relationship", () => {
    const r = scoreRelationship({ contactType: "BUYER", status: "WON", relationshipTypes: ["BOUGHT"], lastContactAt: monthsAgo(40), relationshipYear: 2019, assignedAgentAvailable: true, now });
    expect(r.reasons.map((x) => x.code)).toEqual(["PREVIOUS_BUYER", "KNOWN_PROPERTY_RELATIONSHIP", "SAME_ASSIGNED_AGENT"]);
    expect(r.score).toBe(67);
  });
  it("treats a lost seller as a lost mandate and rewards recent interaction", () => {
    const r = scoreRelationship({ contactType: "SELLER", status: "LOST", relationshipTypes: [], lastContactAt: monthsAgo(2), relationshipYear: null, assignedAgentAvailable: false, now });
    expect(r.reasons.map((x) => x.code)).toEqual(["LOST_MANDATE", "RECENT_INTERACTION"]);
  });
  it("returns zero for an unknown contact", () => {
    expect(scoreRelationship({ contactType: "UNKNOWN", status: "UNKNOWN", relationshipTypes: [], lastContactAt: null, relationshipYear: null, assignedAgentAvailable: false, now }).score).toBe(0);
  });
});

describe("timing", () => {
  it("rewards fresh market signals", () => {
    expect(scoreMarketTiming(hoursAgo(0.2), now).score).toBe(100);
    expect(scoreMarketTiming(hoursAgo(5), now).score).toBe(90);
    expect(scoreMarketTiming(hoursAgo(24 * 3), now).score).toBe(70);
    expect(scoreMarketTiming(hoursAgo(24 * 100), now).score).toBe(20);
  });
  it("peaks dormancy timing between 1 and 3 years", () => {
    expect(scoreDormancyTiming(monthsAgo(2), now).score).toBe(25);
    expect(scoreDormancyTiming(monthsAgo(21), now).score).toBe(85);
    expect(scoreDormancyTiming(monthsAgo(50), now).score).toBe(65);
    expect(scoreDormancyTiming(null, now).score).toBe(60);
  });
});

describe("scoreConfidence", () => {
  it("averages available confidences and penalises warnings", () => {
    expect(scoreConfidence({ sellerConfidence: 0.97, propertyMatchConfidence: null, crmMatchConfidence: null, dataWarnings: 0 }).score).toBe(97);
    expect(scoreConfidence({ sellerConfidence: 0.9, propertyMatchConfidence: 1, crmMatchConfidence: 0.96, dataWarnings: 2 }).score).toBe(85);
    expect(scoreConfidence({ sellerConfidence: null, propertyMatchConfidence: null, crmMatchConfidence: null, dataWarnings: 0 }).score).toBe(70);
  });
});

describe("matchTerritory", () => {
  const territories = [
    { type: "POSTAL_CODE" as const, normalizedValue: "9000" },
    { type: "MUNICIPALITY" as const, normalizedValue: "gent" },
    { type: "PROVINCE" as const, normalizedValue: "oost-vlaanderen" },
  ];
  it("matches by most specific level", () => {
    expect(matchTerritory({ postalCode: "9000", municipality: "Gent", province: "Oost-Vlaanderen" }, territories)).toMatchObject({ level: "POSTAL_CODE", score: 100 });
    expect(matchTerritory({ postalCode: "9030", municipality: "Gent", province: "Oost-Vlaanderen" }, territories)).toMatchObject({ level: "MUNICIPALITY", score: 75 });
    expect(matchTerritory({ postalCode: "9800", municipality: "Deinze", province: "Oost-Vlaanderen" }, territories)).toMatchObject({ level: "PROVINCE", score: 40 });
    expect(matchTerritory({ postalCode: "2000", municipality: "Antwerpen", province: "Antwerpen" }, territories)).toMatchObject({ matched: false, score: 0 });
  });
  it("handles no territories", () => {
    expect(matchTerritory({ postalCode: "9000", municipality: "Gent", province: null }, []).matched).toBe(false);
  });
});

describe("scoreOpportunity (combined)", () => {
  const fsboIntent = scoreIntent({ sellerType: "PRIVATE", priceDropCount: 0, daysObserved: 0, relisted: false, agencyToPrivate: false });
  const fresh = scoreMarketTiming(hoursAgo(0.2), now);
  const exact = { score: 100, reasons: ["Exact territory match (postal code 9000)"] };
  const highConf = scoreConfidence({ sellerConfidence: 0.97, propertyMatchConfidence: null, crmMatchConfidence: null, dataWarnings: 0 });

  it("Scenario A — new FSBO, no CRM relationship → ~88", () => {
    const s = scoreOpportunity({ engine: "IMMORADAR", intent: fsboIntent, relationship: null, timing: fresh, territory: exact, confidence: highConf, crmMatchConfidence: null });
    expect(s.total).toBeGreaterThanOrEqual(86);
    expect(s.total).toBeLessThanOrEqual(90);
    expect(s.relationship).toBe(0);
  });

  it("Scenario B — new FSBO + previous buyer in CRM → ~99", () => {
    const rel = scoreRelationship({ contactType: "BUYER", status: "WON", relationshipTypes: ["BOUGHT"], lastContactAt: monthsAgo(40), relationshipYear: 2019, assignedAgentAvailable: true, now });
    const conf = scoreConfidence({ sellerConfidence: 0.97, propertyMatchConfidence: null, crmMatchConfidence: 0.96, dataWarnings: 0 });
    const s = scoreOpportunity({ engine: "IMMORADAR", intent: fsboIntent, relationship: rel, timing: fresh, territory: exact, confidence: conf, crmMatchConfidence: 0.96 });
    expect(s.total).toBeGreaterThanOrEqual(97);
    expect(s.reasons[0]?.code).toBe("CRM_MARKET_MATCH");
    expect(s.reasons.map((r) => r.label)).toContain("Previous buyer — 2019");
  });

  it("Scenario C — private seller, 67 days, 2 price drops → ~94", () => {
    const intent = scoreIntent({ sellerType: "PRIVATE", priceDropCount: 2, daysObserved: 67, relisted: false, agencyToPrivate: false });
    const timing = scoreMarketTiming(hoursAgo(30), now);
    const s = scoreOpportunity({ engine: "IMMORADAR", intent, relationship: null, timing, territory: exact, confidence: highConf, crmMatchConfidence: null });
    expect(s.total).toBeGreaterThanOrEqual(92);
    expect(s.total).toBeLessThanOrEqual(96);
  });

  it("Scenario D — dormant valuation lead, no market signal → moderate score, relationship ~82", () => {
    const rel = scoreRelationship({ contactType: "VALUATION_LEAD", status: "ACTIVE", relationshipTypes: ["VALUATION_REQUESTED"], lastContactAt: monthsAgo(21), relationshipYear: 2024, assignedAgentAvailable: true, now });
    const s = scoreOpportunity({ engine: "LEADREVIVE", intent: { score: 0, reasons: [] }, relationship: rel, timing: scoreDormancyTiming(monthsAgo(21), now), territory: exact, confidence: { score: 80, reasons: [] }, crmMatchConfidence: null });
    expect(s.relationship).toBe(83);
    expect(s.total).toBeGreaterThanOrEqual(65);
    expect(s.total).toBeLessThanOrEqual(85);
  });

  it("never exceeds 100 and never goes below 0", () => {
    const s = scoreOpportunity({ engine: "IMMORADAR", intent: { score: 500, reasons: [] }, relationship: { score: 500, reasons: [] }, timing: { score: 100, reasons: [] }, territory: { score: 100, reasons: [] }, confidence: { score: 100, reasons: [] }, crmMatchConfidence: 2 });
    expect(s.total).toBe(100);
    const z = scoreOpportunity({ engine: "IMMORADAR", intent: { score: -5, reasons: [] }, relationship: null, timing: { score: 0, reasons: [] }, territory: { score: 0, reasons: [] }, confidence: { score: 0, reasons: [] }, crmMatchConfidence: null });
    expect(z.total).toBe(0);
  });

  it("uses normalised weights (profile weights need not sum to 1)", () => {
    const s = scoreOpportunity(
      { engine: "IMMORADAR", intent: { score: 50, reasons: [] }, relationship: null, timing: { score: 50, reasons: [] }, territory: { score: 50, reasons: [] }, confidence: { score: 50, reasons: [] }, crmMatchConfidence: null },
      { ...SCORING_PROFILES, IMMORADAR: { ...SCORING_PROFILES.IMMORADAR, baseWeights: { intent: 3, relationship: 0, timing: 3, territory: 3, confidence: 3 } } },
    );
    expect(s.total).toBe(50);
  });
});

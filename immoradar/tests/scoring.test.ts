import { describe, expect, it } from "vitest";
import { computeIntentScore } from "@/scoring/intent-score";
import { computeRelationshipScore } from "@/scoring/relationship-score";
import {
  computeConfidenceScore,
  computeOpportunityScore,
  computeTerritoryScore,
  computeTimingScore,
} from "@/scoring/opportunity-score";
import { DEFAULT_SCORING_CONFIG } from "@/scoring/config";

const NOW = new Date("2026-08-16T08:00:00Z");

describe("computeIntentScore", () => {
  it("scores a fresh FSBO", () => {
    const result = computeIntentScore({
      isFsbo: true,
      priceDropCount: 0,
      daysObserved: 0,
      relisted: false,
      agencyToPrivate: false,
    });
    expect(result.score).toBe(80); // 40 of maxRawPoints 50
    expect(result.reasons).toContain("Private sale (FSBO)");
  });

  it("accumulates multiple signals and caps at 100", () => {
    const result = computeIntentScore({
      isFsbo: true,
      priceDropCount: 3,
      daysObserved: 67,
      relisted: true,
      agencyToPrivate: false,
    });
    expect(result.score).toBe(100);
    expect(result.reasons).toContain("Multiple price drops (3)");
    expect(result.reasons).toContain("Listed for over 60 days (67)");
  });

  it("scores single price drop lower than multiple", () => {
    const single = computeIntentScore({ isFsbo: false, priceDropCount: 1, daysObserved: 0, relisted: false, agencyToPrivate: false });
    const multiple = computeIntentScore({ isFsbo: false, priceDropCount: 2, daysObserved: 0, relisted: false, agencyToPrivate: false });
    expect(multiple.score).toBeGreaterThan(single.score);
  });
});

describe("computeRelationshipScore", () => {
  it("scores a previous buyer with property relationship and available agent", () => {
    const result = computeRelationshipScore({
      contactType: "BUYER",
      status: "WON",
      hasPropertyRelationship: true,
      lastContactAt: new Date("2020-01-01"),
      assignedAgentActive: true,
      now: NOW,
    });
    // 20 + 15 + 5 = 40 of 80 → 50
    expect(result.score).toBe(50);
    expect(result.reasons).toEqual([
      "Previous buyer",
      "Known property relationship",
      "Previously assigned agent still available",
    ]);
  });

  it("scores a valuation lead highest per point", () => {
    const result = computeRelationshipScore({
      contactType: "VALUATION_LEAD",
      status: "UNKNOWN",
      hasPropertyRelationship: true,
      lastContactAt: null,
      assignedAgentActive: false,
      now: NOW,
    });
    // 30 + 15 = 45 of 80 → 56
    expect(result.score).toBe(56);
  });

  it("adds recent-interaction points", () => {
    const recent = computeRelationshipScore({
      contactType: "SELLER",
      status: "LOST",
      hasPropertyRelationship: false,
      lastContactAt: new Date("2026-07-01"),
      assignedAgentActive: false,
      now: NOW,
    });
    const stale = computeRelationshipScore({
      contactType: "SELLER",
      status: "LOST",
      hasPropertyRelationship: false,
      lastContactAt: new Date("2024-01-01"),
      assignedAgentActive: false,
      now: NOW,
    });
    expect(recent.score).toBeGreaterThan(stale.score);
    expect(recent.reasons).toContain("Recent interaction");
  });
});

describe("timing / territory / confidence components", () => {
  it("timing decays with age", () => {
    const fresh = computeTimingScore({ detectedAt: new Date(NOW.getTime() - 3600_000), now: NOW });
    const old = computeTimingScore({ detectedAt: new Date(NOW.getTime() - 20 * 86400_000), now: NOW });
    expect(fresh.score).toBe(100);
    expect(old.score).toBe(30);
  });

  it("territory precision maps to score", () => {
    expect(computeTerritoryScore({ matched: true, level: "POSTAL_CODE", reasons: [] }).score).toBe(100);
    expect(computeTerritoryScore({ matched: true, level: "MUNICIPALITY", reasons: [] }).score).toBe(85);
    expect(computeTerritoryScore({ matched: true, level: "PROVINCE", reasons: [] }).score).toBe(60);
    expect(computeTerritoryScore({ matched: false, level: null, reasons: [] }).score).toBe(0);
  });

  it("confidence averages available signals", () => {
    const result = computeConfidenceScore({
      sellerConfidence: 0.97,
      propertyMatchConfidence: 0.95,
      crmMatchConfidence: 0.96,
    });
    expect(result.score).toBe(96);
    expect(result.reasons).toContain("High-confidence seller classification");
  });
});

describe("computeOpportunityScore", () => {
  it("scores the flagship scenario (CRM + FSBO) near the top", () => {
    const breakdown = computeOpportunityScore({
      intent: { score: 60, reasons: ["Private sale (FSBO)"] },
      relationship: { score: 63, reasons: ["Previous buyer", "Known property relationship"] },
      timing: { score: 100, reasons: ["Detected within the last 24 hours"] },
      territory: { score: 100, reasons: ["Exact territory match"] },
      confidence: { score: 96, reasons: ["High-confidence seller classification"] },
      crossIntelligence: true,
    });
    expect(breakdown.total).toBeGreaterThanOrEqual(85);
    expect(breakdown.total).toBeLessThanOrEqual(100);
    expect(breakdown.reasons).toContain("Existing CRM relationship + market signal");
  });

  it("is not a simple sum: weights are normalized", () => {
    const all100 = computeOpportunityScore({
      intent: { score: 100, reasons: [] },
      relationship: { score: 100, reasons: [] },
      timing: { score: 100, reasons: [] },
      territory: { score: 100, reasons: [] },
      confidence: { score: 100, reasons: [] },
      crossIntelligence: false,
    });
    expect(all100.total).toBe(100);
  });

  it("redistributes relationship weight for market-only opportunities", () => {
    const marketOnly = computeOpportunityScore({
      intent: { score: 80, reasons: [] },
      relationship: null,
      timing: { score: 100, reasons: [] },
      territory: { score: 100, reasons: [] },
      confidence: { score: 90, reasons: [] },
      crossIntelligence: false,
    });
    // Without redistribution this would be capped at 75; with it it isn't.
    expect(marketOnly.total).toBeGreaterThan(80);
  });

  it("keeps totals within 0-100 even with the cross-intelligence boost", () => {
    const maxed = computeOpportunityScore({
      intent: { score: 100, reasons: [] },
      relationship: { score: 100, reasons: [] },
      timing: { score: 100, reasons: [] },
      territory: { score: 100, reasons: [] },
      confidence: { score: 100, reasons: [] },
      crossIntelligence: true,
    });
    expect(maxed.total).toBe(100);
  });

  it("weights in config sum to 1", () => {
    const w = DEFAULT_SCORING_CONFIG.opportunity.weights;
    expect(w.intent + w.relationship + w.timing + w.territory + w.confidence).toBeCloseTo(1);
  });
});

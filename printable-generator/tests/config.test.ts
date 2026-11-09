import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { disabledFeatureForPath, getFeatures } from "@/lib/features";
import { proxy } from "@/proxy";
import { productionConfigErrors, assertProductionConfig } from "@/lib/env-guard";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { formatPrice, tbcSuffix, PRICE_CURRENCY } from "@/lib/pricing";
import { req } from "./helpers";

describe("feature flags (scope: core only by default)", () => {
  it("all optional modules are off by default", () => {
    for (const v of Object.values(getFeatures())) expect(v).toBe(false);
  });

  it("maps paths of disabled modules", () => {
    expect(disabledFeatureForPath("/marketplace")).toBe("marketplace");
    expect(disabledFeatureForPath("/api/marketplace/products")).toBe("marketplace");
    expect(disabledFeatureForPath("/games/leaderboard")).toBe("games");
    expect(disabledFeatureForPath("/api/webhooks/printful")).toBe("books");
    expect(disabledFeatureForPath("/white-label/setup")).toBe("whiteLabel");
    expect(disabledFeatureForPath("/academy")).toBe("academy");
    expect(disabledFeatureForPath("/dashboard")).toBeNull();
    expect(disabledFeatureForPath("/api/generate")).toBeNull();
    expect(disabledFeatureForPath("/api/stripe/checkout")).toBeNull();
    expect(disabledFeatureForPath("/gamesx")).toBeNull();
  });

  it("proxy answers 404 for disabled modules and lets enabled ones through", async () => {
    const r1 = proxy(new NextRequest("http://localhost/api/marketplace/products"));
    expect(r1.status).toBe(404);
    process.env.NEXT_PUBLIC_FEATURE_MARKETPLACE = "true";
    const r2 = proxy(new NextRequest("http://localhost/api/marketplace/products"));
    expect(r2.status).toBe(200);
    delete process.env.NEXT_PUBLIC_FEATURE_MARKETPLACE;
  });

  it("proxy redirects anonymous users away from /admin", () => {
    const r = proxy(new NextRequest("http://localhost/admin"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login");
  });
});

describe("production guard", () => {
  const good = {
    NODE_ENV: "production",
    AUTH_SECRET: "a".repeat(40),
    DATABASE_URL: "libsql://noor-db.turso.io",
    DATABASE_AUTH_TOKEN: "tok",
    NEXT_PUBLIC_APP_URL: "https://noor.example",
    STRIPE_SECRET_KEY: "sk_live_abc",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRO_MONTHLY_PRICE_ID: "p1",
    STRIPE_PRO_YEARLY_PRICE_ID: "p2",
    STRIPE_SCHOOL_MONTHLY_PRICE_ID: "p3",
    STRIPE_SCHOOL_YEARLY_PRICE_ID: "p4",
  };

  it("accepts a complete production config", () => {
    expect(productionConfigErrors(good)).toEqual([]);
    expect(() => assertProductionConfig(good)).not.toThrow();
  });

  it("refuses dev/fake providers and defaults", () => {
    expect(() => assertProductionConfig({ ...good, STRIPE_SECRET_KEY: "sk_test_dummy_replace_for_real_use" })).toThrow();
    expect(() => assertProductionConfig({ ...good, DATABASE_URL: "file:./prisma/dev.db" })).toThrow(/SQLite/);
    expect(() => assertProductionConfig({ ...good, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
    expect(() => assertProductionConfig({ ...good, ADMIN_PASSWORD: "admin" })).toThrow(/ADMIN_PASSWORD/);
    expect(() => assertProductionConfig({ ...good, NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toThrow();
    expect(() => assertProductionConfig({ ...good, STRIPE_WEBHOOK_SECRET: "" })).toThrow();
    expect(() => assertProductionConfig({ ...good, NEXT_PUBLIC_FEATURE_BOOKS: "true" })).toThrow(/PRINTFUL/);
  });

  it("does not run during build or outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });
});

describe("registration consent", () => {
  it("requires explicit acceptance (18+, terms, privacy)", async () => {
    const res = await registerPOST(req("/api/auth/register", { body: { name: "Ab", email: "new1@example.test", password: "longpassword" } }));
    expect(res.status).toBe(400);
    const ok = await registerPOST(req("/api/auth/register", { body: { name: "Ab", email: "new2@example.test", password: "longpassword", acceptTerms: true } }));
    expect(ok.status).toBe(200);
  });
});

describe("pricing display", () => {
  it("defaults to EUR and marks prices as to be confirmed", () => {
    expect(PRICE_CURRENCY).toBe("EUR");
    expect(formatPrice(12)).toContain("€");
    expect(tbcSuffix("nl")).toBe(" (te bevestigen)");
  });
});

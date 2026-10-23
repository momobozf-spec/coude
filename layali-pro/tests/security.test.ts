import { beforeEach, describe, expect, it } from "vitest";
import { adminProductSchema, parseAdminProductPatch } from "@/lib/admin";
import { checkProductionEnv } from "@/lib/env";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/rateLimit";

describe("adminProductSchema", () => {
  const valid = { name: "Vaas", description: "Mooi", price: "24.95", stock: "3", categoryId: "c1" };

  it("zet tekst uit het formulier om naar getallen", () => {
    const p = adminProductSchema.parse(valid);
    expect(p.price).toBe(24.95);
    expect(p.stock).toBe(3);
    expect(p.status).toBe("ACTIVE");
  });

  it("weigert prijs 0, negatieve voorraad en http-afbeeldingen", () => {
    expect(adminProductSchema.safeParse({ ...valid, price: 0 }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...valid, stock: -1 }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...valid, images: ["http://x.be/a.jpg"] }).success).toBe(false);
  });

  it("PATCH: onbekende velden worden geweigerd en ontbrekende velden niet overschreven", () => {
    expect(parseAdminProductPatch({ id: "andere-id" }).success).toBe(false);
    expect(parseAdminProductPatch({ createdAt: "2020-01-01" }).success).toBe(false);
    const r = parseAdminProductPatch({ featured: true });
    expect(r.success).toBe(true);
    // Belangrijk: geen images: [] of status: ACTIVE die stilletjes meekomen.
    if (r.success) expect(r.data).toEqual({ featured: true });
    const s = parseAdminProductPatch({ stock: "7", status: "DRAFT" });
    if (s.success) expect(s.data).toEqual({ stock: 7, status: "DRAFT" });
  });
});

describe("rate limit en client-IP", () => {
  beforeEach(() => resetRateLimits());

  it("blokkeert na de limiet en laat weer toe na het venster", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0).allowed).toBe(true);
    expect(rateLimit("k", 3, 1000, 10).allowed).toBe(false);
    expect(rateLimit("k", 3, 1000, 1001).allowed).toBe(true);
  });

  it("neemt het adres dat de proxy toevoegde, niet wat de bezoeker verzint", () => {
    expect(clientIp("1.1.1.1, 203.0.113.9", 1)).toBe("203.0.113.9");
    expect(clientIp("vervalst, 1.1.1.1, 203.0.113.9", 2)).toBe("1.1.1.1");
    expect(clientIp(null, 1)).toBe("unknown");
    expect(clientIp("1.1.1.1", 0)).toBe("direct");
  });
});

describe("checkProductionEnv", () => {
  const good = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://x",
    NEXTAUTH_SECRET: "a".repeat(32),
    NEXTAUTH_URL: "https://layali.example",
    APP_URL: "https://layali.example",
  } as NodeJS.ProcessEnv;

  it("laat een volledige configuratie door", () => {
    expect(checkProductionEnv(good).errors).toEqual([]);
  });

  it("weigert een kort geheim, http of verschillende adressen", () => {
    expect(checkProductionEnv({ ...good, NEXTAUTH_SECRET: "kort" }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...good, APP_URL: "http://layali.example", NEXTAUTH_URL: "http://layali.example" }).errors.length).toBeGreaterThan(0);
    expect(checkProductionEnv({ ...good, APP_URL: "https://ander.example" }).errors).toHaveLength(1);
  });

  it("waarschuwt als de mails niet van een eigen domein komen", () => {
    expect(checkProductionEnv({ ...good, RESEND_API_KEY: "re_x", RESEND_FROM: "Layali <onboarding@resend.dev>" }).warnings.join(" ")).toMatch(/eigen domein/);
    expect(checkProductionEnv({ ...good, RESEND_API_KEY: "re_x", RESEND_FROM: "Layali <info@layali.be>" }).warnings.join(" ")).not.toMatch(/eigen domein/);
  });

  it("waarschuwt bij een Mollie-testsleutel", () => {
    expect(checkProductionEnv({ ...good, MOLLIE_API_KEY: "test_abc" }).warnings.join(" ")).toMatch(/testsleutel/);
  });
});

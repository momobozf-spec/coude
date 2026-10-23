import { describe, expect, it } from "vitest";
import { checkProductionEnv, guardApplies } from "@/lib/production-guard.mjs";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.abc",
  NEXT_PUBLIC_SITE_URL: "https://overnamemarkt.be",
  NEXT_PUBLIC_CONTACT_EMAIL: "momobozf@gmail.com",
  NEXT_PUBLIC_COMPANY_ADDRESS: "Straat 1, 1930 Zaventem",
};

describe("productie-guard", () => {
  it("geen fouten bij een echte configuratie", () => {
    expect(checkProductionEnv(good)).toEqual({ errors: [], warnings: [] });
  });
  it("weigert de placeholders uit .env.example", () => {
    const r = checkProductionEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://jouw-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "jouw-anon-key",
      NEXT_PUBLIC_SITE_URL: "https://jouwdomein.be",
      NEXT_PUBLIC_CONTACT_EMAIL: "info@jouwdomein.be",
      NEXT_PUBLIC_COMPANY_ADDRESS: "Zaventem",
    });
    expect(r.errors).toHaveLength(4);
    expect(r.warnings).toHaveLength(1);
  });
  it("weigert lokale Supabase, http en localhost", () => {
    expect(checkProductionEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).errors).toHaveLength(1);
  });
  it("weigert een service-role-sleutel als NEXT_PUBLIC_", () => {
    const r = checkProductionEnv({ ...good, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "x" });
    expect(r.errors.some((e) => e.includes("SERVICE_ROLE"))).toBe(true);
  });
  it("geldt voor Vercel-productiebuild en productiestart, niet voor previews of lokale builds", () => {
    expect(guardApplies({ VERCEL_ENV: "production" }, "build")).toBe(true);
    expect(guardApplies({ NODE_ENV: "production" }, "build")).toBe(false);
    expect(guardApplies({ NODE_ENV: "production", VERCEL_ENV: "preview" }, "start")).toBe(false);
    expect(guardApplies({ NODE_ENV: "production" }, "start")).toBe(true);
    expect(guardApplies({ NODE_ENV: "development" }, "start")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildCsp, maxBodyBytes, safeRedirectPath, sameOrigin } from "./security";

describe("safeRedirectPath", () => {
  const fb = "/nl/dossier";
  it("laat interne paden door", () => {
    expect(safeRedirectPath("/fr/check", fb)).toBe("/fr/check");
    expect(safeRedirectPath("/nl/account?paid=1", fb)).toBe("/nl/account?paid=1");
  });
  it("blokkeert open redirects", () => {
    for (const bad of [
      "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/%2F%2Fevil.com", "/%5Cevil.com",
      "javascript:alert(1)", "/\u0000x", "%2F%2Fevil.com", "", "evil.com", "/%E0%A4%A",
    ]) {
      expect(safeRedirectPath(bad, fb), bad).toBe(fb);
    }
  });
});

describe("sameOrigin", () => {
  it("aanvaardt eigen host en weigert vreemde", () => {
    expect(sameOrigin("https://huurklaar.be", null, "huurklaar.be")).toBe(true);
    expect(sameOrigin("https://evil.com", null, "huurklaar.be")).toBe(false);
    expect(sameOrigin("null", null, "huurklaar.be")).toBe(false);
    expect(sameOrigin(null, "https://huurklaar.be/nl/dossier", "huurklaar.be")).toBe(true);
    expect(sameOrigin(null, "https://huurklaar.be.evil.com/", "huurklaar.be")).toBe(false);
    expect(sameOrigin(null, null, "huurklaar.be")).toBe(false);
  });
});

describe("buildCsp", () => {
  it("is streng in productie", () => {
    const csp = buildCsp("abc", { dev: false, supabaseUrl: "https://x.supabase.co" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://x.supabase.co");
  });
});

describe("maxBodyBytes", () => {
  it("geeft per pad een limiet", () => {
    expect(maxBodyBytes("/api/inbound")).toBeGreaterThan(maxBodyBytes("/api/check"));
    expect(maxBodyBytes("/api/profile")).toBe(16 * 1024);
  });
});
